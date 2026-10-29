#!/usr/bin/env python3
"""Central queue runner. Bounded download chunks, one page at a time, checkpoints.
Only its GitHub Actions OIDC identity can call the service-key gateway.
Local analysis: --pdf FILE --out DIR --from YYYY-MM-DD --until YYYY-MM-DD.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import os
import re
from pathlib import Path
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import fitz
from german_flyer_layout import analyze_page, save_evidence, page_quality_counts, VERSION
from german_flyer_vision import configured_client, analyze_visual_page, VERSION as VISION_VERSION

CHUNK=8*1024*1024

class Gateway:
    def __init__(self):
        self.url=os.environ['FLYER_WORKER_URL'];self.token='';self.token_at=0
    def identity(self):
        if time.monotonic()-self.token_at>180 or not self.token:
            url=os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']+'&audience=basket-flyer-worker'
            req=urllib.request.Request(url,headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
            with urllib.request.urlopen(req,timeout=30) as res:self.token=json.load(res)['value']
            self.token_at=time.monotonic()
        return self.token
    def call(self,action,job=None,body=None,key=None,raw=None):
        query={'action':action}
        if job:query['import']=job['id']
        if key:query['key']=key
        data=raw if raw is not None else json.dumps(body or {}).encode()
        method='GET' if action=='download' else 'POST'
        req=urllib.request.Request(self.url+'?'+urllib.parse.urlencode(query),data=None if method=='GET' else data,method=method,
          headers={'Authorization':'Bearer '+self.identity(),'Content-Type':'image/png' if raw else 'application/json'})
        # A page failure is checkpointed; never print tokens, PDF text or names.
        with urllib.request.urlopen(req,timeout=90) as res:
            return res.read(CHUNK+1) if action=='download' else json.load(res)

def source_available(url):
    """Check an operator URL only on official source hosts; no arbitrary SSRF."""
    if not url:return False
    # cdn.ipaper.io was observed on the ordinary official ALDI PDF redirect.
    trusted={'view.publitas.com','magazine.aldi-nord.de','www.aldi-nord.de','www.rewe.de','cdn.ipaper.io','penny-publish.blaetterkatalog.de'}
    def allowed(u):
        try:
            p=urllib.parse.urlparse(u)
            if p.hostname=='penny-publish.blaetterkatalog.de':
                return (p.scheme=='https' and p.port in (None,443) and not p.username and not p.password
                    and not p.query and not p.fragment
                    and re.fullmatch(r'/frontend/catalogs/[0-9]{1,12}/[0-9]{1,3}/pdf/complete[.]pdf',p.path,re.I) is not None)
            return p.scheme=='https' and p.hostname in trusted and p.port in (None,443) and not p.username and not p.password
        except ValueError:return False
    if not allowed(url):return False
    class Redirects(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,req,fp,code,msg,headers,newurl):
            if not allowed(newurl):raise ValueError('Unapproved source redirect')
            return super().redirect_request(req,fp,code,msg,headers,newurl)
    for method in ('HEAD','GET'):
        try:
            headers={'User-Agent':'BasketSourceCheck/1.0'}
            if method=='GET':headers['Range']='bytes=0-15'
            request=urllib.request.Request(url,method=method,headers=headers)
            with urllib.request.build_opener(Redirects()).open(request,timeout=12) as r:
                if r.status in (200,206) and 'pdf' in r.headers.get('Content-Type','').lower():
                    return method=='HEAD' or r.read(5)==b'%PDF-'
        except (ValueError,urllib.error.URLError,TimeoutError):pass
    return False

def analyze(page, start, until, vision=None):
    # An enabled vision failure is a failed page, never an unnoticed fallback
    # to the very geometry guesses that image recognition is meant to replace.
    return analyze_visual_page(page, start, until, vision) if vision else analyze_page(page, start, until)


def local(pdf_path,out,valid_from,valid_until,vision=None):
    out.mkdir(parents=True,exist_ok=True)
    report={'parser':VISION_VERSION if vision else VERSION,'pages':[]}
    with fitz.open(pdf_path) as pdf:
        if pdf.needs_pass:raise ValueError('Password-protected PDF')
        for number,page in enumerate(pdf,1):
            try:
                save_evidence(page,tuple(page.rect),out/f'page-{number}.png')
                result=analyze(page,valid_from,valid_until,vision)
                for candidate in result['offers']:
                    save_evidence(page,candidate['bbox'],out/f'{number}-{candidate["key"]}.png')
            except Exception as e:result={'status':'failed','error':type(e).__name__+': '+str(e)[:200]}
            result['page']=number;report['pages'].append(result)
            print('PAGE',number,result['status'],'candidates',len(result.get('offers',[])))
    # The local QA summary is derived from each page, not a claim that all
    # products in the printed flyer were recognized. No guessed prices.
    keys=('regions','withPrice','withoutPack','inferredUnit','ambiguousPrice','unreadable')
    report['quality']={k:sum(page_quality_counts(p)[k] for p in report['pages']) for k in keys}
    report['quality']['failedPages']=[p['page'] for p in report['pages'] if p['status']!='done']
    (out/'analysis.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('REVIEW COUNTS',json.dumps(report['quality'],sort_keys=True))

def process(api,job,vision=None):
    with tempfile.TemporaryDirectory(prefix='basket-flyer-') as tmp:
        folder=Path(tmp);path=folder/'flyer.pdf';digest=hashlib.sha256();size=0
        with path.open('wb') as file:
            for index in range(job['chunk_count']):
                blob=api.call('download',job,key=f'{job["id"]}/chunks/{index:04d}')
                expected=min(CHUNK,job['byte_size']-size)
                if len(blob)!=expected:raise ValueError('Upload chunk size mismatch')
                file.write(blob);digest.update(blob);size+=len(blob)
        if size!=job['byte_size'] or digest.hexdigest()!=job['sha256']:raise ValueError('PDF checksum mismatch; upload incomplete')
        with fitz.open(path) as pdf:
            if pdf.needs_pass or not 1<=len(pdf)<=1000:raise ValueError('Encrypted or unsupported PDF page count')
            metadata=api.call('metadata',job,{'totalPages':len(pdf),'sourceAvailable':source_available(job['source_url'])})
            done={p['page'] for p in metadata['pages'] if p['status']=='done'}
            quality={key:0 for key in ('regions','withPrice','withoutPack','inferredUnit','ambiguousPrice','unreadable')}
            for number in range(1,len(pdf)+1):
                if number in done:continue
                page=pdf[number-1]
                page_image_key=None
                try:
                    key=f'{job["id"]}/evidence/page-{number}.png'
                    image=folder/'evidence.png';save_evidence(page,tuple(page.rect),image)
                    api.call('evidence',job,key=key,raw=image.read_bytes());page_image_key=key
                    result=analyze(page,str(job['valid_from']),str(job['valid_until']),vision)
                    result['imageKey']=page_image_key
                    for c in result['offers']:
                        key=f'{job["id"]}/evidence/{number}-{c["key"]}.png'
                        save_evidence(page,c['bbox'],image)
                        api.call('evidence',job,key=key,raw=image.read_bytes());c['cropKey']=key
                        # Evidence text is private and never included in public snapshots.
                        c['data']['evidence']=c.pop('evidence')
                    api.call('page',job,{'page':number,'payload':result})
                    metrics=page_quality_counts(result)
                    for key in quality:quality[key]+=metrics[key]
                    print('PAGE',number,'of',len(pdf),'checkpointed',
                          'proposals',metrics['regions'],'needs-unit',metrics['withoutPack'],
                          'price-ambiguous',metrics['ambiguousPrice'])
                except Exception as error:
                    # DB/lease errors must abort; only extraction errors are marked
                    # as page failures. A lost lease cannot be written around.
                    if isinstance(error,urllib.error.HTTPError):raise
                    # A global call limit or missing service cannot be cured by
                    # calling again on every remaining page. Checkpoint this
                    # page, then release the job for explicit retry.
                    api.call('page',job,{'page':number,'payload':{'status':'failed',
                        'width':page.rect.width,'height':page.rect.height,'imageKey':page_image_key,
                        'error':type(error).__name__+': '+str(error)[:200],'offers':[]}})
                    if vision:raise
        # These counts cover newly processed pages only; resumed pages were
        # checkpointed earlier and must never be mistaken for zero candidates.
        print('REVIEW SUMMARY (new pages only)',json.dumps(quality,sort_keys=True),
              'resumed-pages',len(done))
        print('FINISH',api.call('finish',job))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--pdf',type=Path);parser.add_argument('--out',type=Path)
    parser.add_argument('--from',dest='start');parser.add_argument('--until')
    args=parser.parse_args()
    vision=configured_client()
    print('RECOGNITION',VISION_VERSION if vision else VERSION)
    if args.pdf:
        dt.date.fromisoformat(args.start);dt.date.fromisoformat(args.until)
        return local(args.pdf,args.out,args.start,args.until,vision)
    api=Gateway();started=time.monotonic()
    for source in api.call('sources'):
        api.call('source-status',body={'id':source['id'],'available':source_available(source['source_url'])})
    while time.monotonic()-started<45*60:
        jobs=api.call('claim')
        if not jobs:print('Queue empty');return
        job=jobs[0]
        try:process(api,job,vision)
        except Exception as error:
            print('IMPORT FAILED',type(error).__name__)
            api.call('fail',job,{'error':type(error).__name__+': '+str(error)[:200]})
            if vision:raise SystemExit('Vision import incomplete; inspect failed page before retry')

if __name__=='__main__':main()
