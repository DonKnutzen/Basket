import {catalogExactProduct} from './product-catalog';
import {receiptDate} from './receipt-date';
import {newId,normalize,inferCategory,toCents,type ReceiptDraft,type Product,type BasketData} from './types';
export function newLine(){return {id:newId(),label:'',name:'',quantity:'1',amount:'',category:'Other',packSize:''}}
export function parseReceipt(text:string,products:Product[]=[],aliases:BasketData['aliases']=[]):ReceiptDraft{
 const raw=text.split(/\r?\n/).map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);
 const stores=['Atlantic Superstore','No Frills','Walmart','Sobeys','Costco','Gateway','Giant Tiger','Food Basics','Metro','IGA','Provigo','Maxi','Loblaws','FreshCo','REWE Center','REWE','Aldi Nord','Aldi Süd','Aldi','Lidl','EDEKA','Netto','Penny','Kaufland','Globus','HIT','tegut','Denns Biomarkt','Alnatura','NSLC','Foodland','Independent'];
 const d:ReceiptDraft={id:newId(),store:stores.find(s=>text.toLowerCase().includes(s.toLowerCase()))||raw.slice(0,3).find(l=>/[a-z]{3}/i.test(l)&&!/[\d@$]/.test(l)&&l.length<60)||'',date:'',total:'',tax:'0.00',currency:'',lines:[],rawText:text};
 const country=/\b(canada|nova scotia|quebec|ontario|halifax|sobeys|no frills|atlantic superstore|nslc)\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i.test(text)?'CA':/\b(deutschland|germany|rewe|edeka|kaufland|alnatura)\b/i.test(text)?'DE':'';
 d.country=country;d.currency=/\bCAD\b/i.test(text)?'CAD':/€|\bEUR\b/i.test(text)?'EUR':country==='CA'?'CAD':country==='DE'?'EUR':'';
 d.dateEvidence=receiptDate(text,country);d.date=d.dateEvidence.date;

 let tax=0,total=0,subtotal=0;
 for(const line of raw){const m=line.match(/^(.+?)\s+(-?\$?\d{1,6}[.,]\d{2})\s*(?:€|EUR|CAD)?\s*[A-Z*]{0,3}$/i);if(!m)continue;const label=m[1].replace(/^\d{5,14}\s+/,'').trim(),amount=toCents(m[2].replace('$',''));if(!Number.isFinite(amount))continue;
 if(/^(hst|gst|pst|qst|tps|tvq|tax\b)/i.test(label)){tax+=amount;continue}if(/^sub[ -]?total/i.test(label)){subtotal=amount;continue}if(/^(total|balance due|amount due|grand total)\b/i.test(label)){total=amount;continue}
 if(/^(cash|change|debit|credit|visa|mastercard|amex|tender|payment|approved|auth|terminal|trans\b|you saved|savings|points|rewards|coupon|discount|rabais|items?\b|articles?\b|tel\b|phone|www\.|thank|merci|receipt|invoice|cashier)/i.test(label)||amount<0||!/[a-z]/i.test(label)||/^\d+\s*[@x]\s*\d/i.test(label))continue;
 let name=label,quantity='1';const qty=name.match(/^(\d+)\s*x\s+(.+)/i);if(qty){quantity=qty[1];name=qty[2]}
 const pack=name.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|g|lb|ml|l)\b/i);const weighed=!!pack&&/[x×@]\s*\d|\/\s*(kg|lb)/i.test(label);
 if(pack){name=name.slice(0,pack.index).trim()+(!weighed?name.slice((pack.index||0)+pack[0].length):'');name=name.trim()}
 const quality=/\b(bio|organic|org)\b/i.test(name)?'organic':undefined;
 const canonical=catalogExactProduct(name.replace(/\b(bio|organic|org)\b/ig,'').trim());if(canonical)name=canonical.en;
 const alias=aliases.find(a=>a.store===normalize(d.store)&&a.label===normalize(label));const p=products.find(p=>p.id===alias?.productId)||products.find(p=>normalize(p.name)===normalize(name)&&!p.packSize&&!p.brand&&!p.variant&&!p.quality);
 d.lines.push({id:newId(),label,name:p?.name||name.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase()),quantity,amount:(amount/100).toFixed(2),category:p?.category||inferCategory(name),packSize:pack&&!weighed?pack[1]+' '+pack[2]:p?.packSize||'',brand:p?.brand,variant:p?.variant,quality:quality||p?.quality,measuredQuantity:pack&&weighed?pack[1].replace(',','.'):undefined,measuredUnit:pack&&weighed?pack[2].toLowerCase() as 'kg'|'g'|'lb':undefined,matched:!!p});}
 d.tax=(tax/100).toFixed(2);d.total=total?(total/100).toFixed(2):subtotal?((subtotal+tax)/100).toFixed(2):'';return d;
}
export function difference(d:ReceiptDraft){return toCents(d.total||'0')-toCents(d.tax||'0')-d.lines.reduce((s,l)=>s+(toCents(l.amount)||0),0)}
