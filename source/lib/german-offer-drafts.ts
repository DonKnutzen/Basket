/** Operator-only diagnostic records. These are never verified sale offers. */
import {berlinDay} from './rewe-official-weekly';
import {germanPack,inferGermanExplicitPack,suggestGermanCategory,germanSourceUrl,germanDay} from './german-central-offers';
import {tentativeCorrectedPrice} from './german-base-price';

type Retailer='rewe'|'aldi-nord'|'penny';
export type GermanDraft={
 id:string;importId:string;retailer:Retailer;page:number;sourceFilename:string;sourceUrl:string;
 name:string;brand:string;variant:string;packSize:string;priceCents:number;
 priceKind:string;conditions:string;categoryHint:string;validFrom:string;validUntil:string;
 status:'review'|'unreadable';issues:string[];priceUsable:boolean;unitInferred:boolean;
 displayPriceCents:number;priceFromBase:boolean;
};
type Import={id:string;retailer:string;region:string;filename:string;source_url:string;valid_from:string;valid_until:string};
const fold=(s:string)=>s.toLocaleLowerCase('de').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const uncertainPrice=/Mehrere Verkaufspreise|Keine eindeutige Kachelgrenze|Grundpreis passt|Mehrere Mengen|Bedingter Preis|Keine eindeutige Packungsgröße|Niedrige OCR|OCR:|Preiszuordnung bestätigen|Mehrere Marken|Preisspalte nur|Preisraster/i;
const unsuitable=/\b(?:butterkeks\w*|butterkuchen|buttermilch|schokomilch|paprikachips|reispudding|tomatensosse|tomatensauce|kartoffelchips|kasecracker)\b/i;
const beverageExclusion=/\b(?:mentos|kaudragees|bonbon|kaugummi|fruchtgummi|gummibarchen|lutscher|cola geschmack|cola aromatisiert)\b/;
const asText=(x:unknown,max:number)=>typeof x==='string'?x.trim().slice(0,max):'';
const date=(x:unknown)=>germanDay(x)?x:'';
export function parseGermanDraft(raw:unknown,job:Import):GermanDraft|null{
 if(!raw||typeof raw!=='object'||!job||job.region!=='Kiel'||!['rewe','aldi-nord','penny'].includes(job.retailer))return null;
 const x=raw as Record<string,unknown>;
 if(x.status!=='review'&&x.status!=='unreadable')return null;
 const data=x.data;
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 const d=data as Record<string,unknown>;
 const id=asText(x.id,80),rawName=asText(d.name,250),brand=asText(d.brand,100);
 if(!id||!Number.isInteger(x.page)||(x.page as number)<1)return null;
 if(rawName.length<3&&x.status!=='unreadable')return null;
 const name=rawName.length>=3?rawName:`Unlesbarer Bereich auf Seite ${x.page}`;
 const cents=Number(d.priceCents);
 const priceCents=Number.isInteger(cents)&&cents>0&&cents<250000?cents:0;
 const rawIssues=Array.isArray(x.issues)?x.issues.filter(v=>typeof v==='string').slice(0,20) as string[]:[];
 const printedPack=asText(d.packSize,150),priceKind=asText(d.priceKind,20);
 const inferredPack=!printedPack?inferGermanExplicitPack(rawName):'';
 const packSize=printedPack||inferredPack,unitInferred=!!inferredPack;
 const issues=unitInferred?
  rawIssues.map(issue=>issue==='Keine eindeutige Packungsgröße erkannt'?'Einheit aus Produkttext erschlossen; Original prüfen':issue):
  rawIssues;
 const validFrom=date(d.validFrom)||job.valid_from,validUntil=date(d.validUntil)||job.valid_until;
 if(!germanDay(validFrom)||!germanDay(validUntil)||validFrom>validUntil)return null;
 const estimated=tentativeCorrectedPrice(priceCents,asText(d.basePrice,250),packSize,priceKind,String(x.status),issues);
 const printedPriceUsable=x.status==='review'&&rawName.length>=3&&priceCents>0&&!!germanPack(packSize)&&priceKind==='standard'&&!issues.some(v=>uncertainPrice.test(v));
 const priceUsable=printedPriceUsable||estimated!==null;
 const sourceUrl=germanSourceUrl(job.source_url)||'';
 const categoryHint=suggestGermanCategory([brand,name].filter(Boolean).join(' '))?.de||'';
 return {
  id,importId:job.id,retailer:job.retailer as Retailer,page:x.page as number,sourceFilename:job.filename,
  sourceUrl,name,brand,variant:asText(d.variant,100),packSize,priceCents,priceKind,
  conditions:asText(d.conditions,500),categoryHint,validFrom,validUntil,
  status:x.status,issues,unitInferred,
  // Drafts are never verified sale prices. A calculated display estimate must
  // never mutate or replace the raw OCR candidate price in the database.
  priceUsable,priceFromBase:estimated!==null,
  displayPriceCents:estimated??(printedPriceUsable?priceCents:0),
 };
}
function words(text:string){return fold(text).split(' ').filter(Boolean)}
/** Search only the operator's unverified PDF proposals, never the verified feed. */
export function matchGermanDrafts(name:string,drafts:readonly GermanDraft[],stores:readonly string[]=[],now=new Date()):GermanDraft[]{
 const query=fold(name);if(!query||query.length<2||unsuitable.test(query))return [];
 const category=suggestGermanCategory(name)?.de;
 const today=berlinDay(now);
 const requestedSize=name.match(/(?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:kg|g|ml|cl|l|Stück|St\.?)\b/i)?.[0];
 const requestedPack=requestedSize?germanPack(requestedSize):null;
 const queryWords=words(name.replace(/(?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:kg|g|ml|cl|l|Stück|St\.?)\b/gi,'')).flatMap(w=>w==='coke'?['coca','cola']:[w]);
 return drafts.filter(d=>{
  if(d.validFrom>today||d.validUntil<today)return false;
  if(stores.length&&!stores.includes(d.retailer==='aldi-nord'?'aldi':d.retailer))return false;
  const identity=fold([d.brand,d.name,d.variant].join(' '));
  if(unsuitable.test(identity))return false;
  if(category==='Cola'&&beverageExclusion.test(identity))return false;
  if(category==='Cola'&&!/(?:coca cola|pepsi|cola erfrischungsgetrank|cola getrank|cola zero|cola original)/.test(identity))return false;
  if(category&&d.categoryHint!==category)return false;
  if(!category&&!queryWords.every(w=>words(identity).includes(w)))return false;
  if(category&&queryWords.length>1&&!queryWords.every(w=>words(identity).includes(w)))return false;
  if(requestedPack&&d.packSize){
   const actual=germanPack(d.packSize);
   if(actual&&(actual.unit!==requestedPack.unit||Math.abs(actual.amount-requestedPack.amount)>.00001))return false;
  }
  return true;
 }).sort((a,b)=>Number(b.priceUsable)-Number(a.priceUsable)||a.retailer.localeCompare(b.retailer)||a.page-b.page);
}
export function searchGermanDraftCatalogue(search:string,drafts:readonly GermanDraft[],stores:readonly string[]=[],now=new Date()):GermanDraft[]{
 const text=fold(search),today=berlinDay(now);
 return drafts.filter(d=>d.validFrom<=today&&d.validUntil>=today&&(!stores.length||stores.includes(d.retailer==='aldi-nord'?'aldi':d.retailer))&&
 (!text||text.split(' ').every(w=>fold([d.brand,d.name,d.packSize,d.categoryHint].join(' ')).includes(w))))
 .sort((a,b)=>a.retailer.localeCompare(b.retailer)||a.page-b.page);
}

/** Human-readable but explicitly unverified: never an official price label. */
export function unverifiedOfferCount(count:number,de:boolean):string{
 return de?(count===1?'1 ungeprüftes Angebot':count+' ungeprüfte Angebote'):
  (count===1?'1 unverified offer':count+' unverified offers');
}

/** A readable headline drawn ONLY from printed product text.
 * Long OCR descriptions remain accessible in the expand-on-demand details.
 */
export function compactGermanDraftTitle(name:string,brand:string,maxLength=84):{title:string;full:string;truncated:boolean}{
 const cleanName=name.replace(/\s+/g,' ').trim(),cleanBrand=brand.replace(/\s+/g,' ').trim();
 const full=cleanBrand&& !cleanName.toLocaleLowerCase('de').startsWith(cleanBrand.toLocaleLowerCase('de'))
  ? cleanBrand+' · '+cleanName:cleanName;
 if(full.length<=maxLength)return {title:full,full,truncated:false};
 const edge=full.lastIndexOf(' ',maxLength-1);
 const cutoff=edge>=Math.max(24,Math.floor(maxLength*.55))?edge:maxLength-1;
 return {title:full.slice(0,cutoff).trimEnd()+'…',full,truncated:true};
}
