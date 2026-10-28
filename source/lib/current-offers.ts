/**
 * Basket's on-demand offer checker. No scraping or collection of retailer
 * catalogues: only documented public, reusable third-party API endpoints.
 * No historical prices are promoted to deals.
 */
export type OfferCountry='CA'|'DE';
export type OfferRegion={country:OfferCountry;province:string;postalCode:string;stores:string[]};
export type Deal={id:string;name:string;storeId:string;store:string;priceCents:number;regularCents?:number;currency:'CAD'|'EUR';validFrom:string;validUntil:string;observedAt:string;sourceUrl:string;packSize:string;loyalty:boolean;provider:'bidou'};
export const OFFER_STORES=[
 {id:'walmart',name:'Walmart',country:'CA'},
 {id:'maxi',name:'Maxi',country:'CA'},
 {id:'iga',name:'IGA',country:'CA'},
 {id:'metro',name:'Metro',country:'CA'},
 {id:'superc',name:'Super C',country:'CA'},
 {id:'provigo',name:'Provigo',country:'CA'},
 {id:'nofrills',name:'No Frills',country:'CA'},
 {id:'superstore',name:'Atlantic Superstore',country:'CA'},
 {id:'sobeys',name:'Sobeys',country:'CA'},
 {id:'rewe',name:'REWE',country:'DE'},
 {id:'edeka',name:'EDEKA',country:'DE'},
 {id:'lidl',name:'Lidl',country:'DE'},
 {id:'aldi',name:'ALDI',country:'DE'},
 {id:'penny',name:'PENNY',country:'DE'},
 {id:'kaufland',name:'Kaufland',country:'DE'},
] as const;
export const DEFAULT_OFFER_REGION:OfferRegion={country:'CA',province:'NS',postalCode:'',stores:[]};
const CA_PROVINCES=new Set(['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT']);
export const OFFER_PROVINCES=[...CA_PROVINCES];
export function restoreOfferRegion(input:string|null):OfferRegion{
 try{
  const d=JSON.parse(input||'{}'),country:OfferCountry=d.country==='DE'?'DE':'CA';
  const province=country==='DE'?'':CA_PROVINCES.has(d.province)?d.province:'NS';
  const postal=(typeof d.postalCode==='string'?d.postalCode.trim().toUpperCase():'').slice(0,9);
  const ids=new Set(OFFER_STORES.filter(s=>s.country===country).map(s=>s.id));
  const stores=Array.isArray(d.stores)?[...new Set<string>(d.stores.filter((s:unknown):s is string=>typeof s==='string'&&ids.has(s)))]:[];
  return {country,province,postalCode:postal,stores};
 }catch{return {...DEFAULT_OFFER_REGION};}
}
export function storeChoices(region:OfferRegion){return OFFER_STORES.filter(s=>s.country===region.country);}
export function providerAvailable(region:OfferRegion){
 return region.country==='CA'&&(region.province==='QC'||region.province==='ON') &&
   (!region.stores.length || region.stores.some(s=>supportedStores(region).includes(s)));
}
function supportedStores(region:OfferRegion):string[]{
 return region.province==='QC'?['walmart','maxi','iga','metro','superc','provigo']:['nofrills','superstore'];
}
function normalize(s:string){return s.toLocaleLowerCase('fr').replace(/œ/g,'oe').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
const TERMS:Record<string,string>={milk:'lait',milch:'lait',butter:'beurre',eggs:'oeufs',eier:'oeufs',egg:'oeuf',bread:'pain',brot:'pain',apple:'pomme',apfel:'pomme',bananas:'banane',banana:'banane',bananen:'banane',tomatoes:'tomate',tomaten:'tomate',tomato:'tomate',cheese:'fromage',kaese:'fromage',kase:'fromage',kasee:'fromage'};
export function offerSearchTerm(name:string){const key=normalize(name);return TERMS[key]||key;}
function matches(query:string,result:string):boolean{
 const q=normalize(query),r=normalize(result),parts=q.split(' ');
 if(!q||!r)return false;
 if(!parts.every(p=>r.split(' ').includes(p)||r.split(' ').includes(p+'s')))return false;
 // A generic milk request is not chocolate, powdered or plant milk.
 if((q==='lait'||q==='milk'||q==='milch')&&/\b(chocolat|chocolate|soya|soja|avoine|amande|coco|vanille|poudre|condense)\b/.test(r))return false;
 if(q==='pomme'&&/\bpommes? de terre\b/.test(r))return false;
 return true;
}
function text(v:unknown):string{return typeof v==='string'?v.trim().slice(0,180):'';}
function entries(v:unknown):unknown[]{return Array.isArray(v)?v:[];}
function obj(v:unknown):Record<string,unknown>{return v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};}
function list(v:unknown):unknown[]{
 if(Array.isArray(v))return v;
 const record=obj(v);
 for(const key of ['products','results','items','data','prix','prices','offres','offers','enseignes','stores']){
  if(Array.isArray(record[key]))return record[key] as unknown[];
  if(record[key]&&typeof record[key]==='object'){const nested=listDepthOne(record[key]);if(nested.length)return nested;}
 }
 return [];
}
function listDepthOne(v:unknown):unknown[]{const o=obj(v);for(const key of ['items','products','results','offers','prices','stores'])if(Array.isArray(o[key]))return o[key] as unknown[];return [];}
function field(r:Record<string,unknown>,...names:string[]):unknown{for(const n of names)if(r[n]!==undefined&&r[n]!==null)return r[n];}
function isoDay(v:unknown):string{
 const value=text(v).slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)return '';
 return value;
}
function cents(v:unknown):number|null{
 const n=typeof v==='number'?v:typeof v==='string'&&/^\d+(?:[.,]\d{1,2})?$/.test(v.trim())?Number(v.replace(',','.')):NaN;
 return Number.isFinite(n)&&n>0&&n<100000?Math.round(n*100):null;
}
function localDay(now:Date,province:string){
 return new Intl.DateTimeFormat('sv-SE',{timeZone:province==='QC'?'America/Montreal':'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
function supportedName(store:unknown,region:OfferRegion){
 const s=normalize(text(store));const ids=supportedStores(region);
 return ids.find(id=>{
  if(id==='superstore')return s.includes('superstore')||s.includes('rcss');
  if(id==='nofrills')return s.replace(/ /g,'').includes('nofrills');
  return s===id||s.startsWith(id+' ');
 })||'';
}
function safeSource(url:unknown):string{
 const candidate=text(url);
 try{const u=new URL(candidate);return u.protocol==='https:'&&
  (u.hostname==='bidou.store'||u.hostname.endsWith('.bidou.store')||
   ['walmart.ca','iga.net','metro.ca','maxi.ca','superc.ca','provigo.ca','nofrills.ca','realcanadiansuperstore.ca','loblaws.ca'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))?u.toString():'';}catch{return '';}
}
/** Reject partial/expired/old or non-promotional data instead of guessing. */
export function normalizeBidouDeal(row:unknown,productName:string,region:OfferRegion,now=new Date()):Deal|null{
 if(!providerAvailable(region))return null;
 const r=obj(row),product=obj(field(r,'product','produit'));
 const name=text(field(r,'name','nom','product_name','productName','titre'))||text(field(product,'name','nom','product_name'));
 const store=text(field(r,'store','enseigne','retailer','banner','merchant'));
 const storeId=supportedName(store,region);
 if(!storeId||region.stores.length&&!region.stores.includes(storeId)||!matches(offerSearchTerm(productName),name))return null;
 const priceCents=cents(field(r,'promo_price','sale_price','price','prix_promo','prix','current_price'));
 const regularCents=cents(field(r,'regular_price','original_price','prix_regulier','prix_regular','was_price'));
 const validFrom=isoDay(field(r,'valid_from','validFrom','start_date','date_debut','starts_at'));
 const validUntil=isoDay(field(r,'valid_until','validUntil','end_date','date_fin','ends_at'));
 const observedAt=isoDay(field(r,'observed_at','observedAt','date_releve','updated_at','fetched_at','date'));
 const day=localDay(now,region.province);
 // Require both real offer-validity bounds and a recent dated source observation.
 if(!priceCents||!validFrom||!validUntil||!observedAt||
    validFrom>day||validUntil<day||validFrom>validUntil||
    observedAt>day||(Date.parse(day)-Date.parse(observedAt))/86400000>7)return null;
 const explicitPromotion=field(r,'is_promotion','on_sale','sale','is_special','promotion')===true;
 if(!(regularCents!==null&&regularCents>priceCents)&&!explicitPromotion)return null;
 const sourceUrl=safeSource(field(r,'source_url','url','product_url','retailer_url','lien'))||'https://bidou.store/en/api';
 const storeName=OFFER_STORES.find(s=>s.id===storeId)?.name||store;
 const packSize=text(field(r,'size','format','pack_size','quantity'));
 const loyalty=field(r,'loyalty_only','member_only','carte_fidelite')===true;
 return {id:'bidou:'+storeId+':'+normalize(name)+':'+validUntil,name,storeId,store:storeName,priceCents,
  ...(regularCents!==null&&regularCents>priceCents?{regularCents}:{}),currency:'CAD',validFrom,validUntil,observedAt,sourceUrl,packSize,loyalty,provider:'bidou'};
}
export type OfferFetch=(url:string,init?:RequestInit)=>Promise<Pick<Response,'ok'|'json'>>;
export async function lookupActiveOffers(productName:string,region:OfferRegion,fetcher:OfferFetch=fetch,now=new Date()):Promise<Deal[]>{
 if(!providerAvailable(region))return [];
 const query=offerSearchTerm(productName).slice(0,65);if(query.length<2)return [];
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),8000);
 try{
  // On-demand query for one requested product, not a retailer catalogue crawl.
  const search=new URL('https://bidou.store/api/v1/products');
  search.searchParams.set('q',query);search.searchParams.set('province',region.province);search.searchParams.set('limit','8');
  const sr=await fetcher(search.toString(),{signal:ctrl.signal});if(!sr.ok)return [];
  const candidates=list(await sr.json()).map(obj).filter(x=>matches(query,text(field(x,'name','nom','product_name','titre'))));
  const product=candidates[0],upc=text(field(product||{},'upc','code','barcode','code_barres'));
  if(!/^\d{4,14}$/.test(upc))return [];
  const pr=await fetcher('https://bidou.store/api/v1/prices/'+encodeURIComponent(upc)+'?province='+region.province,{signal:ctrl.signal});
  if(!pr.ok)return [];
  const body=await pr.json();const result=list(body);
  const nested=obj(body);
  const offers=result.length?result:list(field(nested,'data','product','result'));
  return offers.slice(0,50).map(row=>normalizeBidouDeal(row,productName,region,now)).filter((d):d is Deal=>d!==null).sort((a,b)=>a.priceCents-b.priceCents);
 }finally{clearTimeout(timer);}
}
const CACHE_PREFIX='basket-offer-lookups-v1:';
const inFlight=new Map<string,Promise<Deal[]>>();
let lastRequest=0,chain:Promise<unknown>=Promise.resolve();
export function checkOffers(productName:string,region:OfferRegion):Promise<Deal[]>{
 if(!providerAvailable(region))return Promise.resolve([]);
 const key=CACHE_PREFIX+JSON.stringify([offerSearchTerm(productName),region.province,[...region.stores].sort()]);
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.at && Date.now()-saved.at<60*60*1000&&Array.isArray(saved.deals))return Promise.resolve(saved.deals.filter((d:Deal)=>d.validUntil>=localDay(new Date(),region.province)));}catch{}
 const existing=inFlight.get(key);if(existing)return existing;
 const promise=chain.catch(()=>{}).then(async()=>{const delay=Math.max(0,750-(Date.now()-lastRequest));if(delay)await new Promise(resolve=>setTimeout(resolve,delay));lastRequest=Date.now();const deals=await lookupActiveOffers(productName,region);try{localStorage.setItem(key,JSON.stringify({at:Date.now(),deals}));}catch{}return deals;}).finally(()=>inFlight.delete(key));
 chain=promise.catch(()=>{});inFlight.set(key,promise);return promise;
}
