"""Sample metrics: missed names, duplicates and wrong prices count as failures."""
import re
import unicodedata

def fold(s):
    return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower().replace('ß','ss')).encode('ascii','ignore').decode())

def measure(expected, proposals):
    result={'referenceRegions':len(expected),'namesFound':0,'correctProductPricePairs':0,
            'wrongProductPricePairs':0,'brandsFound':0,'quantitiesPreserved':0,
            'requiresReview':len(proposals),'allFieldsCorrect':0,'misses':[]}
    claimed=set()
    for ref in expected:
        matches=[(i,o['data']) for i,o in enumerate(proposals)
                 if fold(ref['name']) in fold(o['data'].get('name',''))]
        if len(matches)!=1 or matches[0][0] in claimed:
            result['misses'].append(ref['name']);continue
        index,actual=matches[0];claimed.add(index);result['namesFound']+=1
        result['correctProductPricePairs']+=actual.get('priceCents')==ref['priceCents']
        result['wrongProductPricePairs']+=actual.get('priceCents',0)>0 and actual.get('priceCents')!=ref['priceCents']
        result['brandsFound']+=bool(ref.get('brand')) and fold(actual.get('brand',''))==fold(ref['brand'])
        size_ok=all(fold(s) in fold(actual.get('packSize','')) for s in ref['sizes'])
        result['quantitiesPreserved']+=size_ok
        brand_ok=not ref.get('brand') or fold(actual.get('brand',''))==fold(ref['brand'])
        result['allFieldsCorrect']+=size_ok and brand_ok and actual.get('priceCents')==ref['priceCents']
    return result

def target_99_met(results,independent=False,complete_pages=False):
    """A tiny development sample must never qualify for a production claim."""
    total=sum(r['referenceRegions'] for r in results)
    predicted=sum(r['requiresReview'] for r in results)
    return bool(independent and complete_pages and total>=100 and predicted>0 and
        sum(r['allFieldsCorrect'] for r in results)/predicted>=.99 and
        all(sum(r[k] for r in results)/total>=.99 for k in
            ('namesFound','correctProductPricePairs','quantitiesPreserved')) and
        sum(r['wrongProductPricePairs'] for r in results)==0)
