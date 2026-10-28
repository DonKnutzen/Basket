import {catalogExactProduct} from './product-catalog';
import {normalize,toCents,type PriceLine,type DraftLine} from './types';
export type PriceObservation={sourceLines?:number[];country?:string;branch?:string;brand?:string;variant?:string;quality?:string;measuredQuantity?:string;measuredUnit?:'kg'|'g'|'lb'|'L'|'mL'|'piece';regularCents?:number;discountCents?:number;saleStatus?:'unknown'|'normal'|'advertised'|'reduced'};
// Quantities are fixed-point integers with six decimal places; money stays in cents.
function decimal(value:string){if(!/^\d+(?:[.,]\d{1,6})?$/.test(value))return null;const [a,b='']=value.replace(',','.').split('.');return BigInt(a)*BigInt(1000000)+BigInt(b.padEnd(6,'0'))}
function quantity(value:string,unit:string){const n=decimal(value);if(n===null||n<=BigInt(0))return null;switch(unit.toLowerCase()){case 'kg':return {n,d:BigInt(1000000),unit:'kg'};case 'g':return {n,d:BigInt(1000000000),unit:'kg'};case 'lb':return {n:n*BigInt(45359237),d:BigInt(100000000000000),unit:'kg'};case 'l':return {n,d:BigInt(1000000),unit:'L'};case 'ml':return {n,d:BigInt(1000000000),unit:'L'};case 'piece':return {n,d:BigInt(1000000),unit:'piece'};default:return null}}
export function comparisonBasis(line:Pick<PriceLine,'quantity'|'packSize'|'amountCents'> & PriceObservation){
 let q=line.measuredQuantity&&line.measuredUnit?quantity(line.measuredQuantity,line.measuredUnit):null;
 if(!q){const pack=line.packSize.trim().match(/^(\d+(?:[.,]\d{1,6})?)\s*(kg|g|lb|l|ml)$/i);const count=decimal(String(line.quantity));
  if(pack&&count){q=quantity(pack[1],pack[2]);if(q)q={...q,n:q.n*count,d:q.d*BigInt(1000000)}}
 }
 // Unknown pack sizes cannot be compared across different products as pieces.
 if(!q){const count=decimal(String(line.quantity));if(!count||count<=BigInt(0))return null;q={n:count,d:BigInt(1000000),unit:'recorded unit'}}
 const cents=BigInt(line.amountCents)*q.d;
 return {unit:q.unit,cents:Number((cents+q.n/BigInt(2))/q.n),n:q.n,d:q.d};
}
export function observationFromDraft(line:DraftLine):PriceObservation{
 const regularCents=line.regularPrice?.trim()?toCents(line.regularPrice):undefined;
 const discountCents=line.discount?.trim()?toCents(line.discount):undefined;
 if(regularCents!==undefined&&(!Number.isSafeInteger(regularCents)||regularCents<toCents(line.amount)))throw Error('Check the evidenced regular line price.');
 if(discountCents!==undefined&&(!Number.isSafeInteger(discountCents)||discountCents<0))throw Error('Check the evidenced discount.');
 if(regularCents!==undefined&&discountCents!==undefined&&regularCents-discountCents!==toCents(line.amount))throw Error('Regular price minus discount must equal the paid line total.');
 if(line.measuredQuantity&&!quantity(line.measuredQuantity,line.measuredUnit||''))throw Error('Check the measured amount and unit.');
 const reduced=regularCents!==undefined&&regularCents>toCents(line.amount)||discountCents!==undefined&&discountCents>0;
 if(line.saleStatus==='normal'&&reduced)throw Error('A normal price cannot have an evidenced reduction.');
 if(line.saleStatus==='reduced'&&!reduced)throw Error('A reduced price needs an evidenced regular price or discount.');
 return {sourceLines:Array.isArray(line.sourceLines)?line.sourceLines.filter(n=>Number.isInteger(n)&&n>0&&n<=10000).slice(0,100):undefined,brand:line.brand?.trim()||undefined,variant:line.variant?.trim()||undefined,quality:line.quality?.trim()||undefined,measuredQuantity:line.measuredQuantity||undefined,measuredUnit:line.measuredQuantity?line.measuredUnit:undefined,regularCents,discountCents,saleStatus:reduced?'reduced':line.saleStatus||'unknown'};
}
export function readObservation(raw:unknown):PriceObservation{try{const value=JSON.parse(String(raw));return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}}
export function productNameKey(name:string){return normalize(catalogExactProduct(name)?.en||name)}
export function productIdentity(line:{name:string;packSize:string}&PriceObservation){const base=productNameKey(line.name)+'|'+normalize(line.packSize);return line.brand||line.variant||line.quality?base+'|'+JSON.stringify([normalize(line.brand||''),normalize(line.variant||''),normalize(line.quality||'')]):base}
export function history(lines:PriceLine[]){return [...lines].filter(l=>l.quantity>0&&l.amountCents>=0).sort((a,b)=>b.date.localeCompare(a.date))}
export function comparableLines(lines:PriceLine[],reference:PriceLine){const basis=comparisonBasis(reference);return history(lines).filter(l=>l.currency===reference.currency&&(l.country||'')===(reference.country||'')&&productNameKey(l.productName)===productNameKey(reference.productName)&&normalize(l.brand||'')===normalize(reference.brand||'')&&normalize(l.variant||'')===normalize(reference.variant||'')&&normalize(l.quality||'')===normalize(reference.quality||'')&&comparisonBasis(l)?.unit===basis?.unit&&(basis?.unit!=='recorded unit'||l.productId===reference.productId))}
export function cheapest(lines:PriceLine[]){return history(lines).reduce<PriceLine|undefined>((best,line)=>{const a=comparisonBasis(line),b=best&&comparisonBasis(best);return a&&(!b||BigInt(line.amountCents)*a.d*b.n<BigInt(best!.amountCents)*b.d*a.n)?line:best},undefined)}
export function weightedAverage(lines:PriceLine[]){if(!lines.length)return null;const reference=lines[0],group=comparableLines(lines,reference);let n=BigInt(0),d=BigInt(1),total=BigInt(0);for(const line of group){const q=comparisonBasis(line);if(!q)continue;n=n*q.d+q.n*d;d*=q.d;const gcd=(a:bigint,b:bigint):bigint=>b?gcd(b,a%b):a;const g=gcd(n,d);n/=g;d/=g;total+=BigInt(line.amountCents)}return n?{cents:Number((total*d+n/BigInt(2))/n),unit:comparisonBasis(reference)!.unit}:null}
