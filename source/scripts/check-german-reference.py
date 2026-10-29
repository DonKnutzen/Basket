"""Measure a SMALL labelled development sample; never report whole-flyer accuracy.
Usage: python scripts/check-german-reference.py --pdf-dir /private/fixtures
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import fitz
from german_flyer_layout import analyze_page

def fold(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower().replace('ß','ss')).encode('ascii','ignore').decode())
parser=argparse.ArgumentParser();parser.add_argument('--pdf-dir',type=Path,required=True);parser.add_argument('--out',type=Path);args=parser.parse_args()
references=json.loads((Path(__file__).resolve().parents[1]/'tests/german-flyer-reference.json').read_text(encoding='utf8'))
report={'sample':'19 manually checked development regions, not held out','retailers':[]}
for source in references['sources']:
 path=args.pdf_dir/source['filename']
 if hashlib.file_digest(path.open('rb'),'sha256').hexdigest()!=source['sha256']:raise ValueError('Reference PDF checksum differs')
 with fitz.open(path) as pdf:
  if len(pdf)!=source['pages']:raise ValueError('Wrong PDF version')
  result=analyze_page(pdf[source['referencePage']-1],source['validFrom'],source['validUntil'])
 metrics={'retailer':source['retailer'],'referenceRegions':len(source['offers']),'namesFound':0,'correctProductPricePairs':0,'wrongProductPricePairs':0,'brandsFound':0,'quantitiesPreserved':0,'requiresReview':len(result['offers']),'misses':[]}
 for expected in source['offers']:
  matches=[o['data'] for o in result['offers'] if fold(expected['name']) in fold(o['data']['name'])]
  if len(matches)!=1:metrics['misses'].append(expected['brand']+' '+expected['name']);continue
  actual=matches[0];metrics['namesFound']+=1
  metrics['correctProductPricePairs']+=actual['priceCents']==expected['priceCents']
  metrics['wrongProductPricePairs']+=actual['priceCents']!=expected['priceCents'] and actual['priceCents']>0
  metrics['brandsFound']+=fold(actual['brand'])==fold(expected['brand'])
  metrics['quantitiesPreserved']+=all(fold(s) in fold(actual['packSize']) for s in expected['sizes'])
 report['retailers'].append(metrics)
print(json.dumps(report,ensure_ascii=False,indent=2))
if args.out:args.out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
if any(m['wrongProductPricePairs'] for m in report['retailers']):raise SystemExit('Regression: incorrect product-price pairing in the labelled sample')
