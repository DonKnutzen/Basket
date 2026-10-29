/** Operator-only diagnostic records. These are never verified sale offers. */
import {berlinDay} from './rewe-official-weekly';
import {germanPack,suggestGermanCategory,germanSourceUrl,germanDay} from './german-central-offers';

type Retailer='rewe'|'aldi-nord'|'penny';
export type GermanDraft={
 id:string;importId:string;retailer:Retailer;page:number;sourceFilename:string;sourceUrl:string;
 name:string;brand:string;variant:string;packSize:string;priceCents:number;
 priceKind:string;conditions:string;categoryHint:string;validFrom:string;validUntil:string;
 status:'review'|'unreadable';issues:string[];priceUsable:boolean;
};
type Import={id:string;retailer:string;region:string;filename:string;source_url:string;valid_from:string;valid_until:string};
const fold=(s:string)=>s.toLocaleLowerCase('de').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const uncertainPrice=/Mehrere Verkaufspreise|Keine eindeutige Kachelgrenze|Grundpreis passt|Mehrere Mengen|Bedingter Preis|Keine eindeutige Packungsgröße|Niedrige OCR|OCR:|Preiszuordnung bestätigen/i;
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
 const id=asText(x.id,80),name=asText(d.name,250),brand=asText(d.brand,100);
 if(!id||name.length<3||!Number.isInteger(x.page)||(x.page as number)<1)return null;
 const cents=Number(d.priceCents);
 const priceCents=Number.isInteger(cents)&&cents>0&&cents<250000?cents:0;
 const issues=Array.isArray(x.issues)?x.issues.filter(v=>typeof v==='string').slice(0,20) as string[]:[];
 const packSize=asText(d.packSize,150),priceKind=asText(d.priceKind,20);
 const validFrom=date(d.validFrom)||job.valid_from,validUntil=date(d.validUntil)||job.valid_until;
 if(!germanDay(validFrom)||!germanDay(validUntil)||validFrom>validUntil)return null;
 const sourceUrl=germanSourceUrl(job.source_url)||'';
 const categoryHint=suggestGermanCategory([brand,name].filter(Boolean).join(' '))?.de||'';
 return {
  id,importId:job.id,retailer:job.retailer as Retailer,page:x.page as number,sourceFilename:job.filename,
  sourceUrl,name,brand,variant:asText(d.variant,100),packSize,priceCents,priceKind,
  conditions:asText(d.conditions,500),categoryHint,validFrom,validUntil,
  status:x.status,issues,
  priceUsable:x.status==='review'&&priceCents>0&&!!germanPack(packSize)&&priceKind==='standard'&&!issues.some(v=>uncertainPrice.test(v)),
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
