/**
 * Narrow, current-week source of public REWE market-price facts generated from
 * a user-supplied official flyer URL. NOT an authorized catalog/republication API.
 * Data intentionally has partial coverage; never invent a discount or SKU match.
 */
import {appPath} from './hosting';
export type RewePartialOffer={
 id:string;name:string;priceCents:number;packSize:string;
 store:'rewe';marketId:'561204';page:number;confidence:'category-only';
};
export type RewePartialData={
 schema:1;marketId:'561204';city:'Kiel';store:'rewe';validFrom:string;validUntil:string;
 checkedAt:string;sourceUrl:string;sourceType:'official-pdf';coverage:'partial';
 status:'partial'|'unavailable'|'expired';offers:RewePartialOffer[];
};
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const SOURCE_HOST='view.publitas.com';
const CATEGORIES=new Set(['Rispentomaten','Kartoffeln','Bananen','Äpfel','Gurken','Paprika','Butter','Milch','Käse','Eier','Pizza','Pasta','Kaffee','Joghurt','Reis','Brot','Mineralwasser']);
export function berlinDay(now=new Date()):string{
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
function day(x:unknown):x is string{
 return typeof x==='string'&&DAY.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
}
function checkSource(uri:string){
 try{const u=new URL(uri);return u.protocol==='https:'&&u.hostname===SOURCE_HOST&&u.pathname.startsWith('/89773/3478778/pdfs/')&&u.pathname.endsWith('.pdf')}catch{return false;}
}
export function parseReweWeeklyData(raw:unknown):RewePartialData|null{
 if(!raw||typeof raw!=='object')return null;
 const r=raw as Partial<RewePartialData>;
 if(r.schema!==1||r.marketId!=='561204'||r.city!=='Kiel'||r.store!=='rewe'||r.coverage!=='partial'||
    r.sourceType!=='official-pdf'||!day(r.validFrom)||!day(r.validUntil)||r.validFrom>r.validUntil||
    !day(r.checkedAt)||typeof r.sourceUrl!=='string'||!checkSource(r.sourceUrl)||
    !['partial','unavailable','expired'].includes(String(r.status))||!Array.isArray(r.offers)||r.offers.length>40)return null;
 const good=r.offers.every(o=>o&&o.store==='rewe'&&o.marketId==='561204'&&
   typeof o.id==='string'&&o.id.length<130&&CATEGORIES.has(o.name)&&Number.isInteger(o.priceCents)&&
   o.priceCents>=10&&o.priceCents<20000&&typeof o.packSize==='string'&&o.packSize.length<45&&
   Number.isInteger(o.page)&&o.page>=1&&o.page<=100&&o.confidence==='category-only');
 if(!good)return null;
 return r as RewePartialData;
}
const MATCH:Record<string,string>={
 'rispentomaten':'Rispentomaten','tomaten':'Rispentomaten',
 'kartoffeln':'Kartoffeln','kartoffel':'Kartoffeln','bananen':'Bananen','banane':'Bananen',
 'apfel':'Äpfel','äpfel':'Äpfel','gurke':'Gurken','gurken':'Gurken',
 'paprika':'Paprika','butter':'Butter','milch':'Milch','käse':'Käse','kaese':'Käse',
 'eier':'Eier','ei':'Eier','pizza':'Pizza','pasta':'Pasta','nudeln':'Pasta',
 'kaffee':'Kaffee','joghurt':'Joghurt','yogurt':'Joghurt','reis':'Reis',
 'brot':'Brot','mineralwasser':'Mineralwasser',
};
export function matchRewePartialOffers(name:string,data:RewePartialData|null,stores:readonly string[]=[],now=new Date()):RewePartialOffer[]{
 if(!data||data.status!=='partial'||(stores.length&&!stores.includes('rewe')))return [];
 const today=berlinDay(now);
 if(today<data.validFrom||today>data.validUntil||data.checkedAt>today)return [];
 // Generic-only matching: never claim a brand/variant/size is the same item.
 const key=name.toLocaleLowerCase('de').trim().replace(/\s+/g,' ');
 const match=MATCH[key];if(!match)return [];
 return data.offers.filter(o=>o.name===match);
}
const SRC=appPath('rewe-kiel-weekly.json');
let cached:{at:number;data:RewePartialData|null}|null=null;
let inFlight:Promise<RewePartialData|null>|null=null;
export async function fetchRewePartialData(fetcher:typeof fetch=fetch):Promise<RewePartialData|null>{
 if(cached&&Date.now()-cached.at<30*60*1000)return cached.data;
 if(inFlight)return inFlight;
 inFlight=(async()=>{
  try{
   const response=await fetcher(SRC,{cache:'no-cache'});
   if(!response.ok)throw Error('No current public REWE weekly price source');
   const d=parseReweWeeklyData(await response.json());
   cached={at:Date.now(),data:d};return d;
  }catch{cached={at:Date.now(),data:null};return null}
  finally{inFlight=null}
 })();
 return inFlight;
}
