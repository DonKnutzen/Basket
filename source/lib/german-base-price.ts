/** A mathematically derived estimate, never a validated sale price.
 * Uses only an explicitly printed base price and one unambiguous pack amount.
 */
import {germanPack} from './german-central-offers';

export function priceFromPrintedBase(basePrice:string,packSize:string):number|null{
 const pack=germanPack(packSize);
 if(!pack||!['kg','l'].includes(pack.unit))return null;
 const cleaned=basePrice.replace(/\s+/g,' ');
 const candidates=[...cleaned.matchAll(/\b(?:1\s*)?(kg|liter|l)\s*=\s*(\d{1,4}(?:[.,]\d{1,2})?)(?!\d)/gi)];
 if(candidates.length!==1)return null;
 const unit=candidates[0][1].toLowerCase()==='kg'?'kg':'l';
 if(pack.unit!==unit)return null;
 const value=Number(candidates[0][2].replace(',','.'));
 const cents=Math.round(pack.amount*value*100);
 // Do not show tiny deposit-like amounts, unsupported or absurd prices.
 return Number.isFinite(cents)&&cents>=1&&cents<=100000?cents:null;
}
/** A base-price calculation can help only if the sole blocking reason was
 * a contradictory sale-price extraction; other OCR/layout ambiguities still
 * suppress the proposed amount completely.
 */
export function tentativeCorrectedPrice(
 sourcePriceCents:number,basePrice:string,packSize:string,
 priceKind:string,status:string,issues:readonly string[]
):number|null{
 if(status!=='review'||priceKind!=='standard'||sourcePriceCents<=0)return null;
 if(!issues.some(s=>s.includes('Grundpreis passt rechnerisch nicht zu Preis / Menge')))return null;
 if(issues.some(s=>/Mehrere Verkaufspreise|Mehrere Mengen|Keine eindeutige Kachelgrenze|Preisspalte nur|Preisraster|Bedingter Preis|Niedrige OCR|OCR:|Preiszuordnung bestätigen|Mehrere Marken|nicht lesbar/i.test(s)))return null;
 const corrected=priceFromPrintedBase(basePrice,packSize);
 if(corrected===null||corrected===sourcePriceCents)return null;
 return corrected;
}
