#!/usr/bin/env python3
"""Extract a small, conservatively matched set of REWE grocery offer facts.
Runs in GitHub Actions, never in the shopper's browser. No PDF is published.
No anti-bot bypass, no crawling, no embedded credentials, one explicitly supplied
official Publitas PDF per advertised week. Ambiguous associations are excluded.
"""
from __future__ import annotations
import datetime as dt
import json
import re
import sys
import urllib.request
from urllib.parse import urlparse, parse_qs, unquote
from pathlib import Path
from zoneinfo import ZoneInfo

MARKET = "561204"
CONFIG = Path("source/config/rewe-kiel-current-flyer.json")
OUTPUT = Path(sys.argv[1] if len(sys.argv) > 1 else "rewe-kiel-weekly.json")
SOURCE_PATTERN = re.compile(r"^/89773/\d+/pdfs/[a-f0-9-]{36}\.pdf$", re.I)
FILENAME_PATTERN = re.compile(r"rewe_(?P<year>20\d{2})_wk(?P<week>\d{1,2})_561204_v\d+\.pdf", re.I)

def checked_iso_date(value: object) -> dt.date:
    if not isinstance(value,str) or not re.fullmatch(r"20\d{2}-\d{2}-\d{2}",value):
        raise ValueError("Invalid ISO date")
    return dt.date.fromisoformat(value)

def load_source_config(path: Path | None = None) -> dict:
    """A human must explicitly supply *each* dated, market-specific flyer link.

    No guessed URL, URL discovery, CORS bypass, or future-week PDF reuse.
    """
    raw=json.loads((path if path is not None else CONFIG).read_text(encoding="utf-8"))
    if not isinstance(raw,dict) or raw.get("schema")!=1 or raw.get("marketId")!=MARKET or raw.get("city")!="Kiel" or raw.get("suppliedBy")!="market-link-manually-provided":
        raise ValueError("Wrong market or missing manual provenance")
    week=raw.get("week")
    if not isinstance(week,str) or not re.fullmatch(r"20\d{2}-W\d{2}",week):
        raise ValueError("Invalid week")
    start=checked_iso_date(raw.get("validFrom"))
    end=checked_iso_date(raw.get("validUntil"))
    if start>end or (end-start).days>7 or start.weekday()!=0:
        raise ValueError("Invalid weekly date range")
    iso=start.isocalendar()
    if week!=f"{iso.year}-W{iso.week:02d}" or end.isocalendar()[:2] != (iso.year,iso.week):
        raise ValueError("The supplied date range does not belong to the declared ISO week")
    url=raw.get("sourceUrl")
    if not isinstance(url,str) or len(url)>1200:
        raise ValueError("No bounded official URL supplied")
    parsed=urlparse(url)
    if parsed.scheme!="https" or parsed.netloc.lower()!="view.publitas.com" or parsed.username or parsed.password or not SOURCE_PATTERN.fullmatch(parsed.path) or parsed.fragment:
        raise ValueError("Not an approved official flyer PDF URL")
    disposition=parse_qs(parsed.query,keep_blank_values=True).get("response-content-disposition",[])
    if len(disposition)!=1:
        raise ValueError("Official flyer filename is required to validate market and week")
    flyer_filename=unquote(disposition[0])
    matched=FILENAME_PATTERN.search(flyer_filename)
    if not matched or int(matched["year"])!=iso.year or int(matched["week"])!=iso.week:
        raise ValueError("Flyer filename does not match REWE market 561204 and the requested week")
    if set(parse_qs(parsed.query,keep_blank_values=True))!={"response-content-disposition"}:
        raise ValueError("Unexpected PDF query arguments")
    return {"sourceUrl":url,"marketId":MARKET,"validFrom":start.isoformat(),
            "validUntil":end.isoformat(),"week":week}

PRODUCTS = (
    ("Rispentomaten", r"\brispentomaten\b"),
    ("Kartoffeln", r"\bkartoffeln?\b"),
    ("Bananen", r"\bbananen?\b"),
    ("Äpfel", r"\bäpfel\b|\bapfel\b"),
    ("Gurken", r"\bsalatgurken?\b|\bgurken?\b"),
    ("Paprika", r"\bpaprika\b"),
    ("Butter", r"\bbutter\b"),
    ("Milch", r"\bvollmilch\b|\bfrischmilch\b|\bh.milch\b"),
    ("Käse", r"\breibekäse\b|\bschnittkäse\b|\bgouda\b"),
    ("Eier", r"\beier\b"),
    ("Pizza", r"\bpizza\b"),
    ("Pasta", r"\bpasta\b|\bspaghetti\b|\bnudeln\b"),
    ("Kaffee", r"\bkaffee\b"),
    ("Joghurt", r"\bjoghurt\b|\byogurt\b"),
    ("Reis", r"\breis\b(?!pudding)"),
    ("Brot", r"\bbrot\b"),
    ("Mineralwasser", r"\bmineralwasser\b"),
)
COMPILED = tuple((name, re.compile(pattern, re.I)) for name, pattern in PRODUCTS)
PRICE = re.compile(r"^(\d{1,3})[.,](\d{2})$")
SIZE = re.compile(r"\b(?:\d+(?:[.,]\d+)?\s*[- ]?\s*(?:kg|g|ml|l|stk|st\.|stück)|\d+\s*x\s*\d+\s*g)\b", re.I)
PROMO = {"knaller", "aktion"}
BLOCK = re.compile(r"^(?:bonus|uvp|pfand|\d+[,.]\d{2}\s*€|\d+\s*%)$", re.I)

def entries(pdf_data: bytes) -> list[dict]:
    import fitz
    result = []
    pdf = fitz.open(stream=pdf_data, filetype="pdf")
    for index, page in enumerate(pdf):
        lines = [re.sub(r"\s+", " ", line).strip() for line in page.get_text().splitlines()]
        lines = [line for line in lines if line]
        for pos in range(1, len(lines)):
            match = PRICE.fullmatch(lines[pos])
            if not match or lines[pos-1].casefold() not in PROMO:
                continue
            cents = int(match[1])*100+int(match[2])
            if cents < 10 or cents > 20000:
                continue
            # Only a small local context. More than one product/category in the
            # same context cannot be uniquely bound to this printed price.
            context = lines[max(0,pos-9):pos-1]
            if not context: continue
            chunks = " ".join(context).lower()
            matched = [name for name, pat in COMPILED if pat.search(chunks)]
            if len(matched) != 1: continue
            product = matched[0]
            # Product keyword must occur close to price marker.
            positions = [i for i, line in enumerate(context) if dict(COMPILED)[product].search(line)]
            if not positions or len(context)-1-max(positions) > 6: continue
            # Treat only printed promotional tags, never unit prices, bonus or
            # loyalty points as offers. Size can be absent rather than guessed.
            sizes = [m.group(0) for line in context[max(0,max(positions)-1):] for m in SIZE.finditer(line)]
            size = sizes[0] if sizes else ""
            result.append({"id":f"rewe:{MARKET}:{index+1}:{product.casefold()}:{cents}",
                "name":product,"priceCents":cents,"packSize":size[:40],
                "store":"rewe","marketId":MARKET,"page":index+1,"confidence":"category-only"})
    pdf.close()
    unique = {}
    for row in result:
        key=(row["name"],row["priceCents"])
        # Suppress conflicting prices for a category rather than picking a
        # possibly unrelated variant. Real pack identity is not established.
        unique.setdefault(key,row)
    by_name={}
    for row in unique.values(): by_name.setdefault(row["name"],[]).append(row)
    # Multiple prices with same category are possible; preserve the fact but
    # exclude them from automatic matches until richer SKU context exists.
    return sorted([rows[0] for rows in by_name.values() if len(rows)==1],
                  key=lambda r:r["name"])[:35]

def main():
    # Date checks prevent publishing stale source data; an expired config is
    # treated as inactive rather than searching for a replacement.
    today=dt.datetime.now(ZoneInfo('Europe/Berlin')).date().isoformat()
    config=load_source_config()
    source=config["sourceUrl"]
    valid_from,valid_until=config["validFrom"],config["validUntil"]
    output={"schema":1,"marketId":MARKET,"city":"Kiel","store":"rewe",
            "validFrom":valid_from,"validUntil":valid_until,"checkedAt":today,
            "sourceUrl":source,"sourceType":"official-pdf","coverage":"partial",
            "status":"expired" if today>valid_until else "unavailable","offers":[]}
    if valid_from<=today<=valid_until:
        try:
            req=urllib.request.Request(source,headers={"User-Agent":"BasketPersonalWeeklyFlyerReader/1.0"})
            with urllib.request.urlopen(req,timeout=45) as res:
                if res.status!=200 or "pdf" not in res.headers.get("content-type",""):
                    raise RuntimeError("Official PDF unavailable")
                declared=int(res.headers.get("content-length","0"))
                if declared>28_000_000:raise RuntimeError("PDF exceeds bounded size")
                data=res.read(28_000_001)
                if len(data)>28_000_000 or not data.startswith(b"%PDF-"):
                    raise RuntimeError("Invalid or oversized PDF")
            offers=entries(data)
            output["offers"]=offers
            output["status"]="partial" if offers else "unavailable"
            print("Conservative, ambiguous-prices-excluded matches:",len(offers))
            for row in offers:print("MATCH",row["name"],row["priceCents"],"page",row["page"])
        except Exception as error:
            print("Source unavailable:",type(error).__name__,str(error)[:120])
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Stored small price-fact summary, not source PDF:",OUTPUT)

if __name__=="__main__":main()
