/** Germany only. Receipt identities and the Canadian providers are untouched. */
import {catalogExactProduct,catalogProduct} from './product-catalog';
import {berlinDay} from './rewe-official-weekly';

export type GermanProduct={name:string;brand:string;variant?:string;category:string;packSize:string;
 priceCents:number;currency:'EUR';basePrice?:string;regularPrice?:string;conditions:string;
 priceKind:'standard'|'multi'|'from'|'loyalty'|'tiered';minQuantity:number;validFrom:string;validUntil:string};
export type GermanOffer=GermanProduct&{id:string;importId:string;retailer:'rewe'|'aldi-nord'|'penny';region:'Kiel';marketId:'561204'|null;
 page:number;bbox:number[];sourceUrl:string;sourceStatus:'checked-at-import'|'unavailable';sourceCheckedAt:string|null;
 sourceFilename:string;validationStatus:'verified';testOnly?:boolean};
export type GermanMatch={offer:GermanOffer;kind:'exact'|'category'|'alternative'};
export const germanStoreName=(s:string)=>s==='rewe'?'REWE · Holtenauer Str. 69–71':s==='aldi-nord'?'ALDI Nord · Region Kiel':s==='penny'?'PENNY · Region Kiel':'Unbekannter Händler';
export function untilBerlinMidnight(now=new Date()){
 const today=berlinDay(now),nextUtc=Date.parse(today+'T00:00:00Z')+86400000;
 let low=nextUtc-4*3600000,high=nextUtc+3600000;
 while(high-low>1){const mid=Math.floor((high+low)/2);if(berlinDay(new Date(mid))===today)low=mid;else high=mid}
 return Math.max(1,high-now.valueOf());
}
const fold=(s:string)=>s.toLocaleLowerCase('de').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
export const GERMAN_STAPLE_CATEGORIES=['Milch','Joghurt','Käse'];
const staples:Record<string,string>={milch:'Milch',milk:'Milch',joghurt:'Joghurt',jogurt:'Joghurt',yogurt:'Joghurt',kase:'Käse',kaese:'Käse',cheese:'Käse',tomate:'Tomaten'};
const productCategoryWords:Record<string,string>={rispentomate:'Tomaten',rispentomaten:'Tomaten'};
export function germanCategoryExact(name:string){const staple=staples[fold(name)];return staple?{de:staple}:catalogExactProduct(name)}
export function suggestGermanCategory(name:string){return germanCategoryExact(name)||(/\b(?:cola|coke|pepsi)\b/.test(fold(name))?{de:'Cola'}:undefined)||(/\b(?:red bull|redbull)\b/.test(fold(name))?{de:'Energydrink'}:undefined)||catalogProduct(name)||fold(name).split(' ').map(w=>staples[w]||productCategoryWords[w]).filter(Boolean).map(de=>({de}))[0]}
function categoryParent(name:string){if(['Naturjoghurt','Griechischer Joghurt','Fruchtjoghurt'].includes(name))return 'Joghurt';if(['Vollmilch','H-Milch','Fettarme Milch'].includes(name))return 'Milch';return name}
export function germanDay(value:unknown):value is string{
 if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T12:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===value;
}
/** No generated product URL or untested PDF page fragment. */
export function germanSourceUrl(raw:string){
 try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==='443')&&
 (
 (u.hostname==='penny-publish.blaetterkatalog.de'&&/^\/frontend\/catalogs\/\d{1,12}\/\d{1,3}\/pdf\/complete\.pdf$/i.test(u.pathname)&&!u.search)
 ||(['view.publitas.com','magazine.aldi-nord.de','www.aldi-nord.de','www.rewe.de'].includes(u.hostname)&&/(?:\.pdf|\/GetPDF\.ashx)$/i.test(u.pathname))
 )?u.href:null}catch{return null}
}
export function parseGermanOffer(raw:unknown):GermanOffer|null{
 if(!raw||typeof raw!=='object')return null;
 const x=raw as GermanOffer;
 if(x.validationStatus!=='verified'||(x.testOnly!==undefined&&typeof x.testOnly!=='boolean')||x.currency!=='EUR'||x.region!=='Kiel'||
  !['rewe','aldi-nord','penny'].includes(x.retailer)||x.retailer==='rewe'&&x.marketId!=='561204'||(x.retailer==='aldi-nord'||x.retailer==='penny')&&x.marketId!==null||
  typeof x.id!=='string'||typeof x.importId!=='string'||typeof x.name!=='string'||x.name.length<2||x.name.length>250||
  typeof x.brand!=='string'||typeof x.category!=='string'||!germanCategoryExact(x.category)||typeof x.packSize!=='string'||
  !Number.isInteger(x.priceCents)||x.priceCents<=0||x.priceCents>250000||
  !Number.isInteger(x.minQuantity)||x.minQuantity<1||x.minQuantity>1000||
  !['standard','multi','from','loyalty','tiered'].includes(x.priceKind)||typeof x.conditions!=='string'||
  x.priceKind!=='standard'&&x.conditions.trim().length<3||x.priceKind==='multi'&&x.minQuantity<2||
  !germanDay(x.validFrom)||!germanDay(x.validUntil)||x.validFrom>x.validUntil||
  !Number.isInteger(x.page)||x.page<1||!Array.isArray(x.bbox)||x.bbox.length!==4||!x.bbox.every(Number.isFinite)||
  !['checked-at-import','unavailable'].includes(x.sourceStatus)||typeof x.sourceUrl!=='string'||
  x.sourceStatus==='checked-at-import'&&!germanSourceUrl(x.sourceUrl))return null;
 return x;
}
export type GermanPackUnit='kg'|'l'|'piece'|'bundle'|'tray'|'net'|'pack';
export function germanPack(raw:string):{amount:number;unit:GermanPackUnit}|null{
 const m=raw.trim().match(/^(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|Stück|St\.?|Bund|Schale|Netz|Packung)$/i);
 if(!m)return null;
 let amount=Number(m[1]||1)*Number(m[2].replace(',','.'));const u=m[3].toLowerCase();
 if(u==='g'||u==='ml')amount/=1000;else if(u==='cl')amount/=100;
 const unit:GermanPackUnit=['g','kg'].includes(u)?'kg':['l','ml','cl'].includes(u)?'l':
  u==='bund'?'bundle':u==='schale'?'tray':u==='netz'?'net':u==='packung'?'pack':'piece';
 return amount>0?{amount,unit}:null;
}
/** Infer missing sales units solely when the printed name explicitly says
 * "Stück", "kg-Preis" etc. Never guess typical supermarket package sizes. */
export function inferGermanExplicitPack(name:string):string{
 const text=name.replace(/\s+/g,' ').trim();
 const kilo=/\b(?:kg[\s-]*Preis|Preis\s*(?:je|pro)\s*kg|je\s+kg)\b/i.test(text);
 const piece=/\b(?:Stück|Stk\.?)\b/i.test(text);
 if(kilo&&piece)return '';
 if(kilo)return '1 kg';
 const match=text.match(/(?:^|[,;]|\s)\s*(Stück|Stk\.?|Bund|Schale|Netz|Packung)\s*[.;]?\s*$/i);
 if(!match)return '';
 const u=match[1].toLowerCase().replace(/\.$/,'');
 return '1 '+(u==='stk'?'Stück':u[0].toUpperCase()+u.slice(1));
}
const forbidden=/\b(?:butterkeks\w*|schokomilch|paprikachips|reispudding|tomatensosse|tomatensauce|kartoffelchips|kasecracker)\b/;
function requestedDrinkVariant(text:string){return fold(text).match(/\b(?:zero|cherry|vanilla|light|diet|sugarfree|zuckerfrei|original)\b/)?.[0]||null}
const categoryExclusions:Record<string,RegExp>={
 Butter:/keks|teig|geback|kuchen|sauce|buttermilch/,
 Milch:/schoko|kakao|pudding|milchreis/,
 Paprika:/chips|gewurz|pulver|sauce|snack/,
 Reis:/pudding|milchreis|sauce|waffel/,
 Tomaten:/sauce|sosse|mark|ketchup|suppe/,
 Kartoffeln:/chips|puffer|puree|snack/,
 Käse:/cracker|sosse|kuchen/,
};
const removeSize=(s:string)=>s.replace(/(?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:kg|g|ml|cl|l|stück|st\.?)\b/gi,'').trim();
export function matchCentralGermanOffers(name:string,offers:readonly GermanOffer[],stores:readonly string[]=[],now=new Date()):GermanMatch[]{
 const query=fold(name);if(!query||forbidden.test(query))return [];
 const exactCategory=germanCategoryExact(name),category=exactCategory||suggestGermanCategory(name);
 if(!category)return [];
 const queryWithoutSize=removeSize(name),size=name.match(/(?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:kg|g|ml|cl|l|Stück|St\.?)\b/i)?.[0];
 const requestedPack=size?germanPack(size):null;
 const today=berlinDay(now);const result:GermanMatch[]=[];
 for(const offer of offers){
  if(offer.validFrom>today||offer.validUntil<today||stores.length&&!stores.includes(offer.retailer==='aldi-nord'?'aldi':offer.retailer))continue;
  const offerCategory=germanCategoryExact(offer.category);
  if(!offerCategory||offerCategory.de!==category.de&&!(staples[query]&&categoryParent(offerCategory.de)===category.de))continue;
  if(['Cola','Energydrink'].includes(category.de)){
   const variant=requestedDrinkVariant(name);
   if(variant&&!fold([offer.brand,offer.name,offer.variant].filter(Boolean).join(' ')).split(' ').includes(variant))continue;
  }
  if(forbidden.test(fold(offer.name))||categoryExclusions[category.de]?.test(fold(offer.name)))continue;
  if(exactCategory){result.push({offer,kind:'category'});continue}
  // A specific brand/variant query must be present word-for-word in evidence.
  // This deliberately avoids fuzzy matches for unrelated foods and brands.
  const words=fold(queryWithoutSize).replace(/\bcoke\b/g,'coca cola').replace(/\bredbull\b/g,'red bull').split(' ').filter(Boolean);
  const identity=' '+fold([offer.brand,offer.name,offer.variant,offer.category].filter(Boolean).join(' '))+' ';
  if(!words.every(w=>identity.includes(' '+w+' ')))continue;
  const pack=germanPack(offer.packSize);
  const samePack=!!requestedPack&&!!pack&&requestedPack.unit===pack.unit&&Math.abs(requestedPack.amount-pack.amount)<.00001;
  result.push({offer,kind:size&&!samePack?'alternative':'exact'});
 }
 return result.sort((a,b)=>{
  const rank={exact:0,category:1,alternative:2};if(a.kind!==b.kind)return rank[a.kind]-rank[b.kind];
  // Compare actual unit prices only for standard prices of known, single packs.
  const x=germanPack(a.offer.packSize),y=germanPack(b.offer.packSize);
  if(x&&y&&x.unit===y.unit&&a.offer.priceKind==='standard'&&b.offer.priceKind==='standard')return a.offer.priceCents/x.amount-b.offer.priceCents/y.amount||a.offer.id.localeCompare(b.offer.id);
  return a.offer.retailer.localeCompare(b.offer.retailer)||a.offer.name.localeCompare(b.offer.name);
 });
}

export function compactGermanOfferMatches(matches:readonly GermanMatch[],maxOffers=5):GermanMatch[]{
 // A single cheapest-price badge hides bigger packs and other retailers.
 // Show one regular and one conditional offer per store instead; every badge
 // includes pack size so a 1.25 L bottle is not mistaken for a 2 L bottle.
 const ordered:GermanMatch[]=[];
 const stores=[...new Set(matches.map(m=>m.offer.retailer))];
 for(const store of stores){
  const group=matches.filter(m=>m.offer.retailer===store);
  const regular=group.find(m=>m.offer.priceKind==='standard');
  const conditional=group.find(m=>m.offer.priceKind!=='standard');
  if(regular)ordered.push(regular);
  if(conditional)ordered.push(conditional);
 }
 return ordered.slice(0,maxOffers);
}

/**
 * The same operator-reviewed offer can be available through both the
 * published feed and the private preview during a refresh. Published facts
 * always win; never render the same flyer tile twice.
 *
 * Distinct prices, loyalty conditions, product variants and pack sizes
 * remain independent offers (e.g. PENNY 0,99 € App vs 1,19 € standard).
 */
/** Product titles already containing the printed brand must not repeat it. */
export function germanOfferDisplayName(offer:Pick<GermanOffer,'brand'|'name'>):string{
 const brand=fold(offer.brand),name=fold(offer.name);
 return brand&&name.startsWith(brand+' ')?offer.name:[offer.brand,offer.name].filter(Boolean).join(' · ');
}
export function mergeGermanOfferSources(published:readonly GermanOffer[],preview:readonly GermanOffer[]):GermanOffer[]{
 const ids=new Set<string>(),fingerprints=new Set<string>(),result:GermanOffer[]=[];
 for(const o of [...published,...preview]){
  const signature=[
   o.retailer,o.importId,o.brand,o.name,o.variant||'',o.packSize,o.priceCents,
   o.priceKind,o.minQuantity,o.conditions,o.validFrom,o.validUntil,
  ].map(x=>fold(String(x))).join('|');
  if(ids.has(o.id)||fingerprints.has(signature))continue;
  ids.add(o.id);fingerprints.add(signature);result.push(o);
 }
 return result;
}
