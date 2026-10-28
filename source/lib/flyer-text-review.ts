/**
 * Format local PDF/OCR output for human review. Never guesses an offer from
 * a unit price or an OCR fragment. This is display-only data; it is not saved.
 */
export const FLYER_PAGE_MARKER=(page:number)=>'[[BASKET_FLYER_PAGE:'+page+']]';
export const FLYER_OCR_MARKER='[[BASKET_FLYER_OCR]]';
const PAGE=/^\[\[BASKET_FLYER_PAGE:(\d{1,4})\]\]$/;
const PRICE=/(?:€\s*)?\d{1,4}[,.]\d{2}(?:\s*(?:€|EUR))?/gi;
export type FlyerTextLine={number:number;value:string;source:'pdf'|'ocr';hasPrice:boolean};
export type FlyerTextPage={number:number;lines:FlyerTextLine[]};
export type FlyerTextSegment={value:string;price:boolean};
/** Splits only price-shaped fragments; may also highlight unit prices. */
export function flyerTextSegments(value:string):FlyerTextSegment[]{
 const fragments:FlyerTextSegment[]=[];let last=0;
 for(const m of value.matchAll(PRICE)){
  const start=m.index||0,end=start+m[0].length;
  const before=value[start-1]||'',after=value[end]||'';
  if(/[\d.,]/.test(before)||/[\d.,]/.test(after))continue;
  if(start>last)fragments.push({value:value.slice(last,start),price:false});
  fragments.push({value:m[0],price:true});last=end;
 }
 if(last<value.length)fragments.push({value:value.slice(last),price:false});
 return fragments.length?fragments:[{value,price:false}];
}
export function flyerTextPages(raw:string):FlyerTextPage[]{
 const pages:FlyerTextPage[]=[];let current:FlyerTextPage={number:1,lines:[]};let mode:'pdf'|'ocr'='pdf';
 for(const line of raw.split(/\r?\n/)){
  const clean=line.replace(/\s+/g,' ').trim();if(!clean)continue;
  const page=clean.match(PAGE);
  if(page){
   if(current.lines.length)pages.push(current);
   current={number:Number(page[1]),lines:[]};mode='pdf';continue;
  }
  if(clean===FLYER_OCR_MARKER){mode='ocr';continue}
  // Bound per-line memory use and number of displayed rows on iOS devices.
  if(current.lines.length>=600)continue;
  current.lines.push({number:current.lines.length+1,value:clean.slice(0,400),
   source:mode,hasPrice:flyerTextSegments(clean).some(s=>s.price)});
 }
 if(current.lines.length)pages.push(current);
 return pages;
}
export function findFlyerTextLines(page:FlyerTextPage,query:string,pricesOnly:boolean):FlyerTextLine[]{
 const normalized=query.trim().toLocaleLowerCase('de');
 return page.lines.filter(line=>(!pricesOnly||line.hasPrice)&&
  (!normalized||line.value.toLocaleLowerCase('de').includes(normalized)));
}
