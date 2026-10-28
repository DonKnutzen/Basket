/**
 * Private, manually reviewed flyer prices. The original PDF/image and OCR text
 * NEVER leave the device; only reviewed entries are saved to localStorage.
 * Flyer prices are not evidence of a discount against a regular price.
 */
export type FlyerStore='rewe'|'aldi'|'lidl'|'edeka'|'penny'|'kaufland';
export const FLYER_STORES:ReadonlyArray<{id:FlyerStore;name:string}>=[
 {id:'rewe',name:'REWE'},{id:'aldi',name:'ALDI Nord'},{id:'lidl',name:'Lidl'},
 {id:'edeka',name:'EDEKA'},{id:'penny',name:'PENNY'},{id:'kaufland',name:'Kaufland'},
];
export type FlyerPrice={
 id:string;name:string;priceCents:number;packSize:string;store:FlyerStore;
 validFrom:string;validUntil:string;region:'Kiel';sourceFile:string;importedAt:string;
};
export type FlyerCandidate={name:string;price:string;packSize:string;line:string};
export const FLYER_STORAGE_KEY='basket-private-de-flyers-v1';
export const FLYER_CHANGED_EVENT='basket-private-flyers-changed';
const ISO=/^\d{4}-\d{2}-\d{2}$/;
export function isDay(day:string):boolean{
 if(!ISO.test(day))return false;
 const d=new Date(day+'T12:00:00Z');
 return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===day;
}
export function priceCents(input:string):number|null{
 const s=input.trim().replace(/\s*(?:€|EUR)\s*/gi,'');
 if(!/^\d{1,4}[,.]\d{2}$/.test(s))return null;
 const n=Number(s.replace(',','.'));return n>0&&n<10000?Math.round(n*100):null;
}
const BAD=/\b(?:statt|ersparnis|gespart|rabatt|discount|unverbindlich|grundpreis|literpreis|kilopreis|pro\s+kg|je\s+kg|je\s+liter|pfand|mwst|kontakt|telefon|angebotspreise)\b/i;
const SIZE=/\b(\d+(?:[,.]\d+)?\s*(?:kg|g|ml|l|st\.?|stk\.?|stück|pack|er)(?:\s*[x×]\s*\d+)?|\d+\s*[x×]\s*\d+(?:[,.]\d+)?\s*(?:g|kg|ml|l))\b/i;
/**
 * Conservative heuristic: only read a product/price when they occur on the
 * same OCR/PDF text line. Never treat a separated price column as proven.
 * All candidates remain unchecked pending an explicit user review.
 */
export function extractFlyerCandidates(raw:string):FlyerCandidate[]{
 const found:FlyerCandidate[]=[];const seen=new Set<string>();
 const rows=raw.split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
 for(const line of rows.slice(0,900)){
  if(line.length>210||BAD.test(line)||/https?:|www\.|gültig|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag/i.test(line))continue;
  const hits=[...line.matchAll(/(?:€\s*)?\d{1,4}[,.]\d{2}\s*(?:€|EUR)?/gi)];
  if(hits.length!==1)continue; // multiple prices => ambiguous old / new
  const match=hits[0];const cents=priceCents(match[0]);
  if(cents===null)continue;
  const before=line.slice(0,match.index).replace(/[\s\-–:|]+$/,'').trim();
  const after=line.slice((match.index||0)+match[0].length).trim();
  if(after&& !/^(?:\*|\d+\s*%|inkl\.?\s*mwst\.?|\/\s*(?:stück|stk))$/i.test(after))continue;
  if(before.length<3||before.length>100||!/[a-zäöü]{3}/i.test(before)||/^\d+[\s,.]/.test(before))continue;
  const size=before.match(SIZE)?.[0]||'';
  const name=before.replace(/\s+(?:nur|jetzt|aktion|preis)\s*$/i,'').trim();
  if(BAD.test(name)||!name)continue;
  const key=(name.toLocaleLowerCase('de')+'|'+cents).normalize('NFKC');
  if(seen.has(key))continue;
  seen.add(key);found.push({name,price:(cents/100).toFixed(2).replace('.',','),packSize:size,line});
  if(found.length>=80)break;
 }
 return found;
}
export function validFlyerPrice(x:unknown):x is FlyerPrice{
 if(!x||typeof x!=='object')return false;
 const a=x as Record<string,unknown>;
 return typeof a.id==='string'&&a.id.length<=150&&typeof a.name==='string'&&a.name.trim().length>=2&&a.name.length<=110&&
 typeof a.priceCents==='number'&&Number.isInteger(a.priceCents)&&a.priceCents>0&&a.priceCents<1000000&&
 typeof a.packSize==='string'&&a.packSize.length<=50&&
 FLYER_STORES.some(s=>s.id===a.store)&&a.region==='Kiel'&&
 typeof a.validFrom==='string'&&typeof a.validUntil==='string'&&isDay(a.validFrom)&&isDay(a.validUntil)&&a.validFrom<=a.validUntil&&
 typeof a.sourceFile==='string'&&a.sourceFile.length<=130&&typeof a.importedAt==='string'&&isDay(a.importedAt);
}
export function readPrivateFlyers(storage:{getItem:(key:string)=>string|null},now:string):FlyerPrice[]{
 if(!isDay(now))return [];
 try{
  const data=JSON.parse(storage.getItem(FLYER_STORAGE_KEY)||'[]');
  if(!Array.isArray(data))return [];
  return data.filter(validFlyerPrice).filter((o:FlyerPrice)=>o.validUntil>=now).slice(-300);
 }catch{return []}
}
export function writePrivateFlyers(storage:{setItem:(key:string,value:string)=>void},newEntries:FlyerPrice[],oldEntries:FlyerPrice[],now:string){
 if(!isDay(now)||newEntries.some(x=>!validFlyerPrice(x)))throw new Error('Invalid flyer price');
 const values=new Map<string,FlyerPrice>();
 for(const o of [...oldEntries,...newEntries]){
  if(!validFlyerPrice(o)||o.validUntil<now)continue;
  const key=[o.store,o.region,o.name.toLocaleLowerCase('de'),o.packSize,o.priceCents,o.validFrom,o.validUntil].join('|');
  values.set(key,o);
 }
 const all=[...values.values()].slice(-300);
 storage.setItem(FLYER_STORAGE_KEY,JSON.stringify(all));
 return all.length;
}
function tokens(s:string):string[]{
 return s.toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss')
  .replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
}
const STOP=new Set(['bio','frisch','frische','der','die','das','und','von','mit','ohne','packung','original','marke']);
/** Conservative broad item matching; never claim that a SKU or pack size is identical. */
export function flyerMatches(item:string,prices:FlyerPrice[],today:string,chosenStores:readonly string[]=[]):FlyerPrice[]{
 if(!isDay(today))return [];
 const want=tokens(item).filter(t=>!STOP.has(t));
 if(!want.length)return [];
 return prices.filter(p=>{
  if(today<p.validFrom||today>p.validUntil||chosenStores.length&&!chosenStores.includes(p.store))return false;
  const available=tokens(p.name);
  return want.every(w=>{
   if(available.includes(w))return true;
   if(w==='milch')return available.some(a=>['vollmilch','h-milch','frischmilch','fettarme','landmilch'].includes(a))&&!available.some(a=>/schoko|soja|hafer|mandel/.test(a));
   if(w==='eier')return available.includes('ei')||available.includes('eiern');
   if(w==='kartoffeln')return available.includes('kartoffel');
   if(w==='äpfel'||w==='apfel')return available.includes('apfel')||available.includes('aepfel');
   return false;
  });
 }).sort((a,b)=>a.priceCents-b.priceCents);
}
