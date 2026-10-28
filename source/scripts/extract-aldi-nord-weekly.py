#!/usr/bin/env python3
"""Read bounded weekly price facts from ALDI Nord's publicly visible offer page.
Only one HTML GET per run; no PDF download, product-catalog crawl, images, login,
protection bypass, or shopping-list transmission. Do not imply a reuse licence.
"""
from __future__ import annotations
from collections import Counter
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo
import json
import re
import sys
import urllib.request

URL = "https://www.aldi-nord.de/angebote.html"
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "aldi-nord-kiel-weekly.json")
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
LIMIT_BYTES = 1_300_000
MAX_OFFERS = 50
BERLIN = ZoneInfo("Europe/Berlin")

# Match advertised product names only (never arbitrary longDescription text).
CATEGORIES = (
    ("Aubergine",r"\bauberginen?\b"),
    ("Kartoffeln",r"\bkartoffeln?\b|\bspeisekartoffeln\b"),
    ("Bananen",r"\bbananen?\b"),
    ("Äpfel",r"\bäpfel\b|\bapfel\b"),
    ("Tomaten",r"\btomaten\b|\btomate\b|\brispentomaten\b"),
    ("Gurken",r"\bgurken?\b|\bsalatgurken?\b"),
    ("Paprika",r"\bpaprika\b"),
    ("Avocado",r"\bavocados?\b"),
    ("Brokkoli",r"\bbrokkoli\b"),
    ("Karotten",r"\bkarotten?\b|\bmöhren?\b"),
    ("Zwiebeln",r"\bzwiebeln?\b"),
    ("Champignons",r"\bchampignons?\b"),
    ("Spinat",r"\bspinat\b"),
    ("Zucchini",r"\bzucchini\b"),
    ("Ingwer",r"\bingwer\b"),
    ("Milch",r"\bvollmilch\b|\bfrischmilch\b|\bh.milch\b"),
    ("Butter",r"\bbutter\b"),
    ("Eier",r"\beier\b|\beierpackung\b"),
    ("Käse",r"\bkäse\b|\bgouda\b|\bmozzarella\b"),
    ("Joghurt",r"\bjoghurt\b|\byogurt\b"),
    ("Brot",r"\bbrot\b|\bbrötchen\b"),
    ("Pizza",r"\bpizza\b"),
    ("Nudeln",r"\bnudeln?\b|\bspaghetti\b|\bpasta\b"),
    ("Reis",r"\breis\b"),
    ("Kaffee",r"\bkaffee\b"),
    ("Mehl",r"\bmehl\b"),
    ("Zucker",r"\bzucker\b"),
    ("Schokolade",r"\bschokolade\b|\bschoko.?tafel\b"),
    ("Mineralwasser",r"\bmineralwasser\b"),
    ("Lachs",r"\blachs\b"),
    ("Hackfleisch",r"\bhackfleisch\b|\brinderhack\b"),
    ("Hähnchen",r"\bhähnchen\b"),
    ("Salat",r"\bsalat\b|\bkopfsalat\b"),
)
PATTERNS = [(name,re.compile(pattern,re.IGNORECASE)) for name,pattern in CATEGORIES]
def day(raw: object) -> str:
    if not isinstance(raw,str) or not DAY.fullmatch(raw):return ""
    try:return datetime.strptime(raw,"%Y-%m-%d").date().isoformat()
    except ValueError:return ""
def stamp_day(raw: object) -> str:
    try:return datetime.fromtimestamp(int(raw), BERLIN).date().isoformat()
    except (TypeError,ValueError,OverflowError):return ""

class NextJson(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_tag = False
        self.parts = []
    def handle_starttag(self,tag,attrs):
        if tag=="script" and dict(attrs).get("id")=="__NEXT_DATA__":
            self.in_tag=True
    def handle_endtag(self,tag):
        if tag=="script":self.in_tag=False
    def handle_data(self,data):
        if self.in_tag:self.parts.append(data)

def extract(html: bytes, today: str) -> list[dict]:
    parser=NextJson()
    parser.feed(html.decode("utf-8",errors="replace"))
    raw="".join(parser.parts)
    if not raw or len(raw)>1_200_000:raise RuntimeError("No bounded structured offer data")
    page=json.loads(raw)
    raw_api=page["props"]["pageProps"]["apiData"]
    if not isinstance(raw_api,str) or len(raw_api)>950_000:raise RuntimeError("Unsupported offer data")
    api=json.loads(raw_api)
    if not isinstance(api,list):raise RuntimeError("Offer payload is not a list")
    maps=[entry[1].get("res",{}).get("algoliaDataMap",{})
          for entry in api if isinstance(entry,list) and len(entry)>1 and entry[0]=="OFFER_GET" and isinstance(entry[1],dict) and
          isinstance(entry[1].get("res"),dict)]
    if len(maps)!=1 or not isinstance(maps[0],dict):raise RuntimeError("Offer schema changed")
    found=[]
    for item in maps[0].values():
        if not isinstance(item,dict) or item.get("isAvailable") is not True or item.get("isRecall") is True or item.get("isComingSoon") is True:
            continue
        name=item.get("name")
        if not isinstance(name,str) or not name.strip() or len(name)>100:continue
        match=next((category for category,regex in PATTERNS if regex.search(name)),None)
        if not match:continue
        # Prevent prepared meals and special breads being mistaken for the
        # staple ingredients shoppers actually wrote on their lists.
        if match=="Hähnchen" and not re.match(r"^Hähnchen(?:[- ]|$)",name,re.I):continue
        if match=="Brot" and not re.match(r"^(?:Brot|Vollkornbrot|Toastbrot|Weizenbrot|Roggenbrot)(?:[- ]|$)",name,re.I):continue
        if match=="Reis" and not re.match(r"^(?:Reis|Sushi-Reis|Basmati.?Reis|Jasmin.?Reis|Langkorn.?Reis)(?:[- ]|$)",name,re.I):continue
        # A flavour such as "Red Paprika" is not a fresh bell pepper.
        produce={"Aubergine","Kartoffeln","Bananen","Äpfel","Tomaten","Gurken","Paprika","Avocado","Brokkoli","Karotten","Zwiebeln","Champignons","Spinat","Zucchini","Ingwer"}
        if match in produce:
            tree=item.get("hierarchicalCategories")
            lvl0=tree.get("lvl0",[]) if isinstance(tree,dict) else []
            if not isinstance(lvl0,list) or not any(isinstance(c,str) and "Obst & Gemüse" in c for c in lvl0):
                continue
        promos=item.get("promotionPrices")
        if not isinstance(promos,list):continue
        active=[]
        for p in promos:
            if not isinstance(p,dict):continue
            start=day(p.get("validFromLocalDate")) or stamp_day(p.get("validFrom"))
            end=day(p.get("validUntilLocalDate")) or stamp_day(p.get("validUntil"))
            price=p.get("priceValue")
            if not start or not end or start>end or not(start<=today<=end):continue
            if isinstance(price,bool) or not isinstance(price,(float,int)) or not 0.09<=price<=250:continue
            cents=round(price*100)
            if abs(price*100-cents)>0.005:continue
            active.append((start,end,cents))
        if len(set(active))!=1:continue
        start,end,cents=active[0]
        identity=str(item.get("objectID",""))
        if not identity.isdigit() or len(identity)>15:continue
        pack=item.get("salesUnit","")
        if not isinstance(pack,str):pack=""
        # This is a category/price lead, not proof a differently branded SKU matches.
        found.append({
            "id":f"aldi:nord:{identity}:{start}",
            "category":match,"name":name.strip(),
            "brand":str(item.get("brandName") or "")[:70],
            "packSize":pack.strip()[:70],"priceCents":cents,
            "validFrom":start,"validUntil":end,
            "store":"aldi","confidence":"category-only"
        })
    found.sort(key=lambda row:(row["category"],row["priceCents"],row["id"]))
    result=[];counts=Counter()
    for row in found:
        if counts[row["category"]]>=3:continue
        result.append(row);counts[row["category"]]+=1
        if len(result)>=MAX_OFFERS:break
    return result

def main() -> None:
    today=datetime.now(BERLIN).date().isoformat()
    result={"schema":1,"region":"Kiel","store":"aldi","checkedAt":today,
            "sourceUrl":URL,"coverage":"partial","status":"unavailable","offers":[]}
    try:
        req=urllib.request.Request(URL,headers={"User-Agent":"BasketPersonalOfferSourceCheck/1.0"})
        with urllib.request.urlopen(req,timeout=25) as res:
            if res.status!=200 or "text/html" not in res.headers.get("Content-Type",""):
                raise RuntimeError("Official HTML unavailable")
            data=res.read(LIMIT_BYTES+1)
        if len(data)>LIMIT_BYTES:raise RuntimeError("Official HTML exceeded bounded size")
        offers=extract(data,today)
        result["offers"]=offers
        result["status"]="partial" if offers else "unavailable"
        print("Active limited ALDI Nord grocery offer categories",len(offers))
        for o in offers[:10]:print("CHECK",o["category"],o["name"],o["priceCents"],o["validUntil"])
    except Exception as exc:
        print("Offer source unavailable:",type(exc).__name__,str(exc)[:120])
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

if __name__=="__main__":
    main()
