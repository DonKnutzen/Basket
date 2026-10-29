"""Opt-in real-source regression on the two explicitly documented PDF fixtures.
No discovery, no publication, no PDF/crop workflow artifacts. Hashes are pinned.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import urllib.request
import fitz
from german_flyer_layout import analyze_page

parser=argparse.ArgumentParser();parser.add_argument('--download',action='store_true');parser.add_argument('--pdf-dir',type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
fixtures=json.loads((root/'tests/german-flyer-reference.json').read_text(encoding='utf8'))['sources']
with tempfile.TemporaryDirectory(prefix='basket-real-pdf-test-') as temp:
 folder=args.pdf_dir or Path(temp)
 if args.download:
  for source in fixtures:
   path=folder/source['filename'];digest=hashlib.sha256();size=0
   request=urllib.request.Request(source['sourceUrl'],headers={'User-Agent':'BasketExplicitFixtureVerification/1.0'})
   with urllib.request.urlopen(request,timeout=60) as response,path.open('wb') as target:
    if response.status!=200 or 'pdf' not in response.headers.get('Content-Type','').lower():raise ValueError('Fixture unavailable; no protection bypass')
    while block:=response.read(8*1024*1024):
     size+=len(block)
     if size>250*1024*1024:raise ValueError('Fixture too large')
     target.write(block);digest.update(block)
   if digest.hexdigest()!=source['sha256']:raise ValueError('Fixture hash changed; manual revalidation required')
 report=[]
 for source in fixtures:
  path=folder/source['filename']
  with path.open('rb') as stream:
   if hashlib.file_digest(stream,'sha256').hexdigest()!=source['sha256']:raise ValueError('Wrong fixture')
  record={'retailer':source['retailer'],'totalPages':source['pages'],'pagesDone':0,'reviewRegions':0,'ocrPages':[],'failedPages':[]}
  with fitz.open(path) as pdf:
   if len(pdf)!=source['pages']:raise ValueError('Wrong page count')
   for index,page in enumerate(pdf,1):
    try:
     data=analyze_page(page,source['validFrom'],source['validUntil']);record['pagesDone']+=1;record['reviewRegions']+=len(data['offers'])
     if data['ocr']:record['ocrPages'].append(index)
    except Exception as e:record['failedPages'].append({'page':index,'error':type(e).__name__+': '+str(e)[:180]})
  report.append(record)
 print('REAL_PDF_PAGE_RESULTS',json.dumps(report),flush=True)
 subprocess.run([sys.executable,str(root/'scripts/check-german-reference.py'),'--pdf-dir',str(folder)],check=True)
 if any(r['failedPages'] for r in report):raise SystemExit('At least one page failed; a production import must not be published')
