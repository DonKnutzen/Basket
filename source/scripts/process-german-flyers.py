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
from german_flyer_layout import analyze_page, save_evidence, page_quality_counts, VERSION

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

def local(pdf_path,out,valid_from,valid_until):
    import fitz
    out.mkdir(parents=True,exist_ok=True)
    digest=hashlib.sha256()
    with pdf_path.open('rb') as source:
        for chunk in iter(lambda:source.read(CHUNK),b''):digest.update(chunk)
    report={'schemaVersion':1,'parser':VERSION,'sha256':digest.hexdigest(),
            'validFrom':valid_from,'validUntil':valid_until,'pages':[]}
    with fitz.open(pdf_path) as pdf:
        if pdf.needs_pass or not 1<=len(pdf)<=1000:raise ValueError('Encrypted or unsupported PDF page count')
        report['totalPages']=len(pdf)
        for number,page in enumerate(pdf,1):
            try:
                result=analyze_page(page,valid_from,valid_until)
                save_evidence(page,tuple(page.rect),out/f'page-{number}.png')
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
    report['quality']['emptyPages']=[p['page'] for p in report['pages']
        if p['status']=='done' and not p.get('offers')]
    report['quality']['reviewPages']=[p['page'] for p in report['pages']
        if p['status']!='done' or not p.get('offers') or any(
            o.get('issues') or o.get('status')=='unreadable' or
            not o['data'].get('priceCents') or not o['data'].get('packSize')
            for o in p.get('offers',[]))]
    report['processingStatus']='failed' if report['quality']['failedPages'] else 'processed'
    # Processing every page is NOT proof of recognizing every food product.
    # Keep this explicit even when no parser issue was detected.
    report['requiresOriginalReview']=True
    (out/'analysis.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('REVIEW COUNTS',json.dumps(report['quality'],sort_keys=True))
    return 1 if report['quality']['failedPages'] else 0

def process(api,job):
    import fitz
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
                try:
                    result=analyze_page(page,str(job['valid_from']),str(job['valid_until']))
                    key=f'{job["id"]}/evidence/page-{number}.png'
                    image=folder/'evidence.png';save_evidence(page,tuple(page.rect),image)
                    api.call('evidence',job,key=key,raw=image.read_bytes());result['imageKey']=key
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
                    api.call('page',job,{'page':number,'payload':{'status':'failed','error':type(error).__name__+': '+str(error)[:200],'offers':[]}})
        # These counts cover newly processed pages only; resumed pages were
        # checkpointed earlier and must never be mistaken for zero candidates.
        print('REVIEW SUMMARY (new pages only)',json.dumps(quality,sort_keys=True),
              'resumed-pages',len(done))
        print('FINISH',api.call('finish',job))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--pdf',type=Path);parser.add_argument('--out',type=Path)
    parser.add_argument('--from',dest='start');parser.add_argument('--until')
    args=parser.parse_args()
    if args.pdf:
        if not all((args.out,args.start,args.until)):
            parser.error('--pdf requires --out, --from and --until')
        try:
            start=dt.date.fromisoformat(args.start);end=dt.date.fromisoformat(args.until)
        except ValueError:parser.error('Dates must use YYYY-MM-DD')
        if end<start:parser.error('--until must not precede --from')
        if not args.pdf.is_file():parser.error('--pdf must refer to an existing file')
        return local(args.pdf,args.out,args.start,args.until)
    if args.out or args.start or args.until:
        parser.error('--out, --from and --until require --pdf; queue mode takes no local arguments')
    api=Gateway();started=time.monotonic()
    for source in api.call('sources'):
        api.call('source-status',body={'id':source['id'],'available':source_available(source['source_url'])})
    while time.monotonic()-started<45*60:
        jobs=api.call('claim')
        if not jobs:print('Queue empty');return
        job=jobs[0]
        try:process(api,job)
        except Exception as error:
            print('IMPORT FAILED',type(error).__name__)
            api.call('fail',job,{'error':type(error).__name__+': '+str(error)[:200]})

if __name__=='__main__':raise SystemExit(main())

