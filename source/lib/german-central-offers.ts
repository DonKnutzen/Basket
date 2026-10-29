/** Germany only. Receipt identities and the Canadian providers are untouched. */
import {catalogExactProduct,catalogProduct} from './product-catalog';
import {berlinDay} from './rewe-official-weekly';

export type GermanProduct={name:string;brand:string;variant?:string;category:string;packSize:string;
 priceCents:number;currency:'EUR';basePrice?:string;regularPrice?:string;conditions:string;
 priceKind:'standard'|'multi'|'from'|'loyalty'|'tiered';minQuantity:number;validFrom:string;validUntil:string};
export type GermanOffer=GermanProduct&{id:string;importId:string;retailer:'rewe'|'aldi-nord';region:'Kiel';marketId:'561204'|null;
 page:number;bbox:number[];sourceUrl:string;sourceStatus:'checked-at-import'|'unavailable';sourceCheckedAt:string|null;
 sourceFilename:string;validationStatus:'verified'};
export type GermanMatch={offer:GermanOffer;kind:'exact'|'category'|'alternative'};
export const germanStoreName=(s:string)=>s==='rewe'?'REWE · Holtenauer Str. 69–71':'ALDI Nord · Region Kiel';
export function untilBerlinMidnight(now=new Date()){
 const today=berlinDay(now),nextUtc=Date.parse(today+'T00:00:00Z')+86400000;
 let low=nextUtc-4*3600000,high=nextUtc+3600000;
 while(high-low>1){const mid=Math.floor((high+low)/2);if(berlinDay(new Date(mid))===today)low=mid;else high=mid}
 return Math.max(1,high-now.valueOf());
}
const fold=(s:string)=>s.toLocaleLowerCase('de').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
export const GERMAN_STAPLE_CATEGORIES=['Milch','Joghurt','Käse'];
const staples:Record<string,string>={milch:'Milch',milk:'Milch',joghurt:'Joghurt',jogurt:'Joghurt',yogurt:'Joghurt',kase:'Käse',kaese:'Käse',cheese:'Käse'};
export function germanCategoryExact(name:string){const staple=staples[fold(name)];return staple?{de:staple}:catalogExactProduct(name)}
export function suggestGermanCategory(name:string){return germanCategoryExact(name)||catalogProduct(name)||fold(name).split(' ').map(w=>staples[w]).filter(Boolean).map(de=>({de}))[0]}
function categoryParent(name:string){if(['Naturjoghurt','Griechischer Joghurt','Fruchtjoghurt'].includes(name))return 'Joghurt';if(['Vollmilch','H-Milch','Fettarme Milch'].includes(name))return 'Milch';return name}
export function germanDay(value:unknown):value is string{
 if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T12:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===value;
}
/** No generated product URL or untested PDF page fragment. */
export function germanSourceUrl(raw:string){
 try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==='443')&&
 ['view.publitas.com','magazine.aldi-nord.de','www.aldi-nord.de','www.rewe.de'].includes(u.hostname)&&
 /(?:\.pdf|\/GetPDF\.ashx)$/i.test(u.pathname)?u.href:null}catch{return null}
}
export function parseGermanOffer(raw:unknown):GermanOffer|null{
 if(!raw||typeof raw!=='object')return null;
 const x=raw as GermanOffer;
 if(x.validationStatus!=='verified'||x.currency!=='EUR'||x.region!=='Kiel'||
  !['rewe','aldi-nord'].includes(x.retailer)||x.retailer==='rewe'&&x.marketId!=='561204'||x.retailer==='aldi-nord'&&x.marketId!==null||
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
export function germanPack(raw:string):{amount:number;unit:'kg'|'l'|'piece'}|null{
 const m=raw.trim().match(/^(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|Stück|St\.?)$/i);
 if(!m)return null;
 let amount=Number(m[1]||1)*Number(m[2].replace(',','.'));const u=m[3].toLowerCase();
 if(u==='g'||u==='ml')amount/=1000;else if(u==='cl')amount/=100;
 return amount>0?{amount,unit:['g','kg'].includes(u)?'kg':['l','ml','cl'].includes(u)?'l':'piece'}:null;
}
const forbidden=/\b(?:butterkeks\w*|schokomilch|paprikachips|reispudding|tomatensosse|tomatensauce|kartoffelchips|kasecracker)\b/;
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
  if(offer.validFrom>today||offer.validUntil<today||stores.length&&!stores.includes(offer.retailer==='aldi-nord'?'aldi':'rewe'))continue;
  const offerCategory=germanCategoryExact(offer.category);
  if(!offerCategory||offerCategory.de!==category.de&&!(staples[query]&&categoryParent(offerCategory.de)===category.de))continue;
  if(forbidden.test(fold(offer.name))||categoryExclusions[category.de]?.test(fold(offer.name)))continue;
  if(exactCategory){result.push({offer,kind:'category'});continue}
  // A specific brand/variant query must be present word-for-word in evidence.
  // This deliberately avoids fuzzy matches for unrelated foods and brands.
  const words=fold(queryWithoutSize).split(' ').filter(Boolean);
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
