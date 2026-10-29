"""Offline, geometry-first flyer proposals. NEVER authorizes publication.

Coordinates are PDF points. Vector panels / whitespace cuts constrain a tile;
price roles are evaluated inside that tile. Every proposal needs human review.
An undecidable layout stays visible with its source region, not a guessed fact.
"""
from __future__ import annotations
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path
import csv
import io
import datetime as dt
import shutil

VERSION = 'geometry-review-v1'
PRICE = re.compile(r'(?<![\d.,])(\d{1,3})[.,](\d{2})(?!\d)')
SIZE = re.compile(r'\b(?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?[\s-]*(?:kg|g|ml|cl|l|Stück|St\.?|Packungen?)\b', re.I)
BASE = re.compile(r'(?:\b(?:kg|liter|l)\s*=|/\s*(?:kg|l)\b|je\s*(?:kg|liter)\b)', re.I)
CONDITION = re.compile(r'bonus|app\b|coupon|mitglied|\bab\s|\b(?:kauf|beim|für|staffel|jeweils)\b', re.I)
BRANDS = ('Kerrygold','Weihenstephan','Milbona','Milsani','Gut Bio','Gut & Günstig','REWE Bio','REWE Beste Wahl','ja!','Lätta','Rama','Dallmayr','Barilla','Dr. Oetker','Mövenpick','Coca-Cola','Philadelphia','Arla','Landliebe',
 'Popp','Müller','Danone','YFood','Leerdammer','Wiltmann','Güldenhof','Gut drei Eichen','Ferrero','Alpenhain','Rougette','Haribo','Nestlé','Mars','Lorenz','Trolli','Herta','Monster')

@dataclass(frozen=True)
class Box:
    text: str
    rect: tuple[float, float, float, float]
    size: float
    struck: bool = False

def union(boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))

def contains(outer, inner, tolerance=2):
    return outer[0]-tolerance<=inner[0] and outer[1]-tolerance<=inner[1] and outer[2]+tolerance>=inner[2] and outer[3]+tolerance>=inner[3]

def area(r):
    return max(0,r[2]-r[0])*max(0,r[3]-r[1])

def price_cents(text):
    match=PRICE.search(text)
    return int(match[1])*100+int(match[2]) if match else None

def quantity(text):
    """Keep the printed alternatives; never turn 2 l / 4 l into one size."""
    found=[re.sub(r'(?<=\d)-(?=[a-zA-Z])',' ',m.group(0)) for m in SIZE.finditer(text)]
    unique=list(dict.fromkeys(found))
    return ' / '.join(unique), len(unique)>1

def unit_check(cents, pack, printed):
    """Compare explicitly printed €/kg or €/l; no historical imputation."""
    m=re.fullmatch(r'(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)',pack.strip(),re.I)
    p=PRICE.search(printed)
    if not m or not p:return None
    value=Decimal(m[1].replace(',','.'))
    if value<=0:return False
    if m[2].lower() in ('g','ml'):value/=1000
    expected=(Decimal(cents)/value).quantize(Decimal('1'),rounding=ROUND_HALF_UP)
    return abs(int(expected)-(int(p[1])*100+int(p[2])))<=2

def text_boxes(page):
    drawings=page.get_drawings()
    invisible=[(s['font'],tuple(s['bbox']),''.join(chr(c[0]) for c in s['chars'])) for s in page.get_texttrace() if s['opacity']==0 or s['type']==3]
    strikes=[]
    for d in drawings:
        if d.get('color') is None:continue
        for item in d.get('items',[]):
            if item[0]=='l':
                p,q=item[1:3]
                if abs(p.y-q.y)<2:strikes.append((min(p.x,q.x),p.y,max(p.x,q.x),q.y))
    boxes=[];images=[]
    for block in page.get_text('dict')['blocks']:
        if block['type']==1:
            images.append(tuple(block['bbox']));continue
        for line in block.get('lines',[]):
            for span in line['spans']:
                t=span['text'].strip()
                if not t:continue
                r=tuple(span['bbox'])
                # Publitas embeds invisible JSON for visual assets. It is not
                # printed product evidence and must not contaminate a tile.
                if any(span['font']==font and t in text and contains(rect,r,5) for font,rect,text in invisible):continue
                struck=any(s[0]<=r[0]+3 and s[2]>=r[2]-3 and r[1]+(r[3]-r[1])*.2<=s[1]<=r[1]+(r[3]-r[1])*.8 for s in strikes)
                boxes.append(Box(t,r,span['size'],struck))
    return boxes,images,drawings

def ocr_boxes(page):
    """Tesseract is used only when the text layer is missing/unusable."""
    if not shutil.which('tesseract'):raise RuntimeError('Tesseract with German language data is required for this page')
    scale=min(2.5,2400/max(page.rect.width,page.rect.height))
    pix=page.get_pixmap(matrix=__import__('fitz').Matrix(scale,scale),alpha=False)
    with tempfile.TemporaryDirectory() as tmp:
        p=Path(tmp)/'page.png';pix.save(p)
        result=subprocess.run(['tesseract',str(p),'stdout','-l','deu+eng','--psm','11','tsv'],capture_output=True,text=True,encoding='utf-8',timeout=150,check=True)
    boxes=[];uncertain=False
    # Keep word boxes so price typography and split Euro/cents remain observable.
    for row in csv.DictReader(io.StringIO(result.stdout),delimiter='\t'):
        text=(row.get('text') or '').strip()
        if not text:continue
        x,y,w,h=(float(row[k])/scale for k in ('left','top','width','height'))
        boxes.append(Box(text,(x,y,x+w,y+h),h))
        if float(row.get('conf','0'))<65:uncertain=True
    return boxes,uncertain

def whitespace_tiles(rect, objects, depth=0):
    """Recursive XY cut on actual occupied geometry, not PDF text order."""
    if len(objects)<3 or depth>6:return [rect]
    choices=[]
    for axis in (0,1):
        intervals=sorted((max(rect[axis],r[axis]),min(rect[axis+2],r[axis+2])) for r in objects)
        merged=[]
        for a,b in intervals:
            if merged and a<=merged[-1][1]+2:merged[-1][1]=max(merged[-1][1],b)
            else:merged.append([a,b])
        for left,right in zip(merged,merged[1:]):
            gap=right[0]-left[1]
            split=(left[1]+right[0])/2
            minimum=12 if axis==0 else 18
            if gap>=minimum and rect[axis]+55<split<rect[axis+2]-55:
                choices.append((gap/(rect[axis+2]-rect[axis]),axis,split))
    if not choices:return [rect]
    _,axis,split=max(choices)
    a=list(rect);a[axis+2]=split
    b=list(rect);b[axis]=split
    result=[]
    for sub in (tuple(a),tuple(b)):
        result+=whitespace_tiles(sub,[o for o in objects if contains(sub,o,0)],depth+1)
    return result

def price_anchors(boxes):
    """Read explicit decimals and aligned Euro / superscript-cent pairs."""
    result=[];used=set()
    for i,b in enumerate(boxes):
        if BASE.search(b.text):continue
        if re.search(r'\b(?:Mo|Di|Mi|Do|Fr|Sa|So)\.?\s*\d{1,2}\.\d{1,2}\.',b.text,re.I):continue
        for m in PRICE.finditer(b.text):
            nearby=[c.text for c in boxes if c is not b and abs(c.rect[0]-b.rect[0])<35 and 0<=c.rect[1]-b.rect[1]<25]
            if re.search(r'Pfand',b.text,re.I):role='deposit'
            elif 'Bonus' in nearby and b.size<20:role='bonus-credit'
            elif b.struck:role='regular'
            elif re.search(r'UVP|statt|bisher',b.text,re.I):role='regular'
            else:role='selling'
            result.append({'cents':int(m[1])*100+int(m[2]),'rect':b.rect,'size':b.size,'role':role,'indices':{i}})
            used.add(i)
    for i,euro in enumerate(boxes):
        if i in used or not re.fullmatch(r'\d{1,3}[.,]?',euro.text) or euro.size<17:continue
        matches=[]
        for j,cent in enumerate(boxes):
            if i==j or j in used or not re.fullmatch(r'\d{2}',cent.text):continue
            if -euro.size*.4<=cent.rect[0]-euro.rect[2]<=euro.size*.8 and cent.rect[0]>euro.rect[0] and abs(cent.rect[1]-euro.rect[1])<euro.size*.6 and .3<=cent.size/euro.size<=1.05:
                matches.append((j,cent))
        if len(matches)==1:
            j,cent=matches[0]
            result.append({'cents':int(euro.text.rstrip('.,'))*100+int(cent.text),'rect':union([euro.rect,cent.rect]),'size':euro.size,'role':'regular' if euro.struck or cent.struck else 'selling','indices':{i,j}})
            used.update((i,j))
    return result

def price_column_cells(rect, selling):
    """Split a large printed panel only when its price badges form clear columns.

    Different prices inside one column remain together for human review (for
    example PENNY's standard and app prices). A nearby product's price must
    never be assigned by nearest-neighbour guessing.
    """
    positions=sorted((a['rect'][0]+a['rect'][2])/2 for a in selling if contains(rect,a['rect']))
    if len(positions)<4:return []
    gaps=[(right-left,index) for index,(left,right) in enumerate(zip(positions,positions[1:]))]
    gap,index=max(gaps,default=(0,0))
    if gap<75 or index<1 or len(positions)-index-1<2:return []
    cut=(positions[index]+positions[index+1])/2
    if cut-rect[0]<75 or rect[2]-cut<75:return []
    return [(rect[0],rect[1],cut,rect[3]),(cut,rect[1],rect[2],rect[3])]

def printed_date_ranges(text,year):
    """Propose printed German ranges. A missing year still needs confirmation."""
    weekday=r'(?:(?:Mo|Di|Mi|Do|Fr|Sa|So)\.?\s*)?'
    pattern=weekday+r'(\d{1,2})\.(\d{1,2})\.(?:\s*(20\d{2}))?\s*(?:bis|[–—-])\s*'+weekday+r'(\d{1,2})\.(\d{1,2})\.(?:\s*(20\d{2}))?'
    found=[]
    for m in re.finditer(pattern,text,re.I):
        try:
            start=dt.date(int(m[3] or year),int(m[2]),int(m[1]))
            end=dt.date(int(m[6] or year),int(m[5]),int(m[4]))
            if end<start and start.month==12 and end.month==1:end=end.replace(year=end.year+1)
            if 0<=(end-start).days<=62:
                value={'from':str(start),'until':str(end),'printed':m.group(0),'yearFromImport':not bool(m[3] and m[6])}
                if not any(x['from']==value['from'] and x['until']==value['until'] for x in found):found.append(value)
        except ValueError:pass
    return found

def analyze_page(page, valid_from, valid_until):
    boxes,images,drawings=text_boxes(page)
    letters=''.join(b.text for b in boxes)
    ocr=len(re.findall(r'[A-Za-zÄÖÜäöüß]',letters))<25 or letters.count('\ufffd')>max(3,len(letters)*.02)
    ocr_uncertain=False
    if ocr:boxes,ocr_uncertain=ocr_boxes(page)
    date_hints=printed_date_ranges(' '.join(b.text for b in sorted(boxes,key=lambda b:(b.rect[1],b.rect[0]))),int(valid_from[:4]))
    page_from,page_until=valid_from,valid_until
    if len(date_hints)==1 and date_hints[0]['from']<=valid_until and date_hints[0]['until']>=valid_from:
        page_from=max(valid_from,date_hints[0]['from']);page_until=min(valid_until,date_hints[0]['until'])
    page_rect=tuple(page.rect)
    panels=[]
    for d in drawings:
        # Closed, rectangular vector backgrounds are layout evidence. A glyph,
        # price badge or a page-sized background is not a product tile.
        items=d.get('items',[])
        # Include rounded rectangular panels (four corners and four edges).
        curved=2<=sum(item[0]=='c' for item in items)<=8 and 2<=sum(item[0]=='l' for item in items)<=8
        if curved and d.get('fill') is not None:
            r=tuple(d['rect'])
            if r[2]-r[0]>=85 and r[3]-r[1]>=65 and area(r)<area(page_rect)*.8 and contains(page_rect,r):panels.append(r)
        for item in items:
            if item[0]=='re':
                r=tuple(item[1])
                if r[2]-r[0]>=85 and r[3]-r[1]>=65 and area(r)<area(page_rect)*.8 and contains(page_rect,r):panels.append(r)
    objects=[b.rect for b in boxes]+[r for r in images if area(r)<area(page_rect)*.6]
    tiles=whitespace_tiles(page_rect,objects) if objects else [page_rect]
    anchors=price_anchors(boxes)
    selling=[a for a in anchors if a['role']=='selling']
    # Repeated price badges supply a column/row grid when no panel boundary is
    # printed. This is a review region, not evidence that a nearest name matches.
    columns=[]
    for a in sorted(selling,key=lambda a:a['rect'][2]):
        if columns and abs(columns[-1][-1]['rect'][2]-a['rect'][2])<18:columns[-1].append(a)
        else:columns.append([a])
    grid=[]
    if 2<=len(columns)<=4:
        right_edges=[min(page_rect[2],max(a['rect'][2] for a in col)+12) for col in columns]
        for index,col in enumerate(columns):
            left=page_rect[0] if index==0 else right_edges[index-1]
            bottom_edges=sorted({round(a['rect'][3]+12,0) for a in col})
            for bottom in bottom_edges:
                prior=[b for b in bottom_edges if b<bottom-35]
                grid.append((left,max(prior) if prior else page_rect[1],right_edges[index],min(bottom,page_rect[3])))
    regions={}
    for anchor in anchors:
        if anchor['role']!='selling':continue
        possible=[r for r in panels if contains(r,anchor['rect']) and sum(contains(r,b.rect) for b in boxes)>=3]
        if possible:
            r=min(possible,key=area);segmented=True
            if sum(contains(r,a['rect']) for a in selling)>1:
                cell=next((cell for cell in grid if contains(cell,anchor['rect'])),None)
                if cell:
                    r=(max(r[0],cell[0]),max(r[1],cell[1]),min(r[2],cell[2]),min(r[3],cell[3]))
                else:
                    column=next((cell for cell in price_column_cells(r,selling) if contains(cell,anchor['rect'])),None)
                    if column:r=column
        else:
            r=next((r for r in grid if contains(r,anchor['rect'])),None)
            if r is None:r=next((r for r in tiles if contains(r,anchor['rect'])),page_rect)
            segmented=area(r)<area(page_rect)*.6
        key=tuple(round(v,1) for v in r)
        regions.setdefault(key,{'anchors':[],'segmented':segmented})['anchors'].append(anchor)
    # Text-only / unreadable pages are still accounted for and shown in admin.
    offers=[]
    for rect,region in regions.items():
        inside=sorted([b for b in boxes if contains(rect,b.rect)],key=lambda b:(round(b.rect[1]/4),b.rect[0]))
        text='\n'.join(b.text for b in inside)
        prices=region['anchors']
        issues=[]
        if not region['segmented']:issues.append('Keine eindeutige Kachelgrenze; Originalbereich prüfen')
        if rect not in panels and any(contains(panel,rect) for panel in panels):issues.append('Preisspalte nur als Prüfbereich getrennt; Produkt und Preis am Original bestätigen')
        if rect in grid:issues.append('Kachelgrenze aus wiederholtem Preisraster vorgeschlagen')
        if ocr:issues.append('OCR: Buchstaben, Mengen und Preisziffern prüfen')
        if ocr_uncertain:issues.append('Niedrige OCR-Zuverlässigkeit')
        if len(prices)!=1:issues.append('Mehrere Verkaufspreise / Produkte im selben Bereich')
        # A proposal in an ambiguous tile must not silently choose a price.
        cents=prices[0]['cents'] if len(prices)==1 else 0
        raw_price_indices=set().union(*(p['indices'] for p in anchors if contains(rect,p['rect'])))
        name_parts=[]
        for b in inside:
            if boxes.index(b) in raw_price_indices or PRICE.search(b.text) or BASE.search(b.text) or SIZE.search(b.text):continue
            if b.size>20:continue
            if re.fullmatch(r'[\d\W]+|knaller|aktion|angebot|REWE|ALDI|Nord',b.text,re.I):continue
            if CONDITION.search(b.text):continue
            if len(re.findall('[A-Za-zÄÖÜäöüß]',b.text))>=2:name_parts.append(b.text)
        name=' '.join(name_parts).strip()[:250]
        brands=[b for b in BRANDS if re.search(r'(?<!\w)'+re.escape(b)+r'(?!\w)',name,re.I)]
        brand=brands[0] if len(brands)==1 else ''
        if len(brands)>1:issues.append('Mehrere Marken im selben Bereich; Varianten getrennt prüfen')
        # Preserve all original product words. Category and brand remain separate.
        if brand:name=re.sub(re.escape(brand),'',name,count=1,flags=re.I).strip(' ·-') or name
        if not brand:issues.append('Marke nicht eindeutig als Text erkannt')
        # ALDI prints pack size and unit price on the same line. Remove only
        # the unit-price suffix, retaining e.g. "250-g-Packung" before it.
        pack_text='\n'.join(b.text[:BASE.search(b.text).start()].rstrip(' (') if BASE.search(b.text) else b.text for b in inside)
        pack,ambiguous=quantity(pack_text)
        if ambiguous:issues.append('Mehrere Mengen / Größen: Preiszuordnung bestätigen')
        base='; '.join(b.text for b in inside if BASE.search(b.text))
        regular=[p['cents'] for p in anchors if p['role']=='regular' and contains(rect,p['rect'])]
        conditions='; '.join(b.text for b in inside if CONDITION.search(b.text))[:500]
        kind='standard';minimum=1
        multi=re.search(r'(\d+)\s*(?:Packungen|Stück|Artikel)?\s*(?:für|zum Preis von)\s*\d+[.,]\d{2}',text,re.I)
        if multi:kind='multi';minimum=int(multi[1]);conditions=multi.group(0)+'; '+conditions
        elif re.search(r'bonus|app\b|coupon|mitglied',text,re.I):kind='loyalty'
        elif re.search(r'\bab\s*\d+[.,]\d{2}',text,re.I):kind='from'
        elif re.search(r'staffel|ab\s+\d+\s+(?:stück|pack)',text,re.I):kind='tiered'
        if kind!='standard':issues.append('Bedingter Preis: Bedingungen und Gesamtpreis bestätigen')
        if base and cents and unit_check(cents,pack,base) is False:issues.append('Grundpreis passt rechnerisch nicht zu Preis / Menge')
        if not pack:issues.append('Keine eindeutige Packungsgröße erkannt')
        if not name:issues.append('Produktbezeichnung nicht lesbar')
        issues.append('Angebotszeitraum mit dem Prospekt abgleichen')
        if date_hints:issues.append('Gedruckter Seitenzeitraum: '+', '.join(x['from']+' – '+x['until'] for x in date_hints))
        key=hashlib.sha256(json.dumps(rect).encode()).hexdigest()[:24]
        offers.append({'key':key,'bbox':rect,'issues':issues,'status':'review' if name and cents else 'unreadable',
            'data':{'name':name,'brand':brand,'variant':'','category':'','packSize':pack[:150],
             'priceCents':cents,'currency':'EUR','basePrice':base[:250],
             'regularPrice':f'{regular[0]/100:.2f}' if len(regular)==1 else '',
             'conditions':conditions,'priceKind':kind,'minQuantity':minimum,
             'validFrom':page_from,'validUntil':page_until},
            'evidence':{'text':text,'prices':[{'cents':p['cents'],'bbox':p['rect'],'role':p['role']} for p in anchors if contains(rect,p['rect'])]}})
    return {'status':'done','width':page.rect.width,'height':page.rect.height,'ocr':ocr,'offers':offers,'dateHints':date_hints}

def save_evidence(page, rect, destination, max_edge=1700):
    import fitz
    r=fitz.Rect(rect)&page.rect
    scale=min(2.0,max_edge/max(r.width,r.height))
    page.get_pixmap(matrix=fitz.Matrix(scale,scale),clip=r,alpha=False).save(destination)
