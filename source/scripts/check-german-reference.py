"""Measure labelled pages, including misses. Optional 99% target gate."""
import argparse
import hashlib
import json
from pathlib import Path
import fitz
from german_flyer_layout import analyze_page
from german_reference_metrics import measure,target_99_met

parser=argparse.ArgumentParser()
parser.add_argument('--pdf-dir',type=Path,required=True)
parser.add_argument('--out',type=Path)
parser.add_argument('--require-target',action='store_true',help='Require the independently labelled 99%% target, not only the development regression floor')
args=parser.parse_args()
references=json.loads((Path(__file__).resolve().parents[1]/'tests/german-flyer-reference.json').read_text(encoding='utf8'))
report={'sample':references['note'],'retailers':[]}
regressions=[]
for source in references['sources']:
    path=args.pdf_dir/source['filename']
    with path.open('rb') as stream:
        if hashlib.file_digest(stream,'sha256').hexdigest()!=source['sha256']:raise ValueError('Reference PDF checksum differs')
    with fitz.open(path) as pdf:
        if len(pdf)!=source['pages']:raise ValueError('Wrong PDF version')
        sections=[{'page':source['referencePage'],'offers':source['offers']},*source.get('extraPages',[])]
        for section in sections:
            result=analyze_page(pdf[section['page']-1],source['validFrom'],source['validUntil'])
            metrics={'retailer':source['retailer'],'page':section['page'],**measure(section['offers'],result['offers'])}
            minimum=section.get('minimumCorrectProductPricePairs',len(section['offers']))
            if metrics['wrongProductPricePairs'] or metrics['correctProductPricePairs']<minimum or metrics['quantitiesPreserved']<section.get('minimumQuantities',len(section['offers'])):
                regressions.append({'retailer':source['retailer'],'page':section['page'],'minimumCorrectPairs':minimum})
            report['retailers'].append(metrics)
metrics=report['retailers'];total=sum(r['referenceRegions'] for r in metrics)
report['summary']={'referenceRegions':total,
    **{k:sum(r[k] for r in metrics) for k in ('namesFound','correctProductPricePairs','wrongProductPricePairs','quantitiesPreserved')},
    'productPriceRecall':sum(r['correctProductPricePairs'] for r in metrics)/total if total else 0,
    'target99SamplePassed':target_99_met(metrics,references.get('independentEvaluation') is True,references.get('completePageAnnotations') is True)}
print(json.dumps(report,ensure_ascii=False,indent=2))
if args.out:args.out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
if regressions:raise SystemExit('Reference regression: '+json.dumps(regressions))
if args.require_target and not report['summary']['target99SamplePassed']:
    raise SystemExit('99% target not proven: need >=100 independently labelled products on complete pages and >=99% name, price-pair and quantity recall with zero observed wrong price pairs')
