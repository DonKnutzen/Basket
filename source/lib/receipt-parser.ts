import {catalogExactProduct} from './product-catalog';
import {receiptDate} from './receipt-date';
import {newId,normalize,inferCategory,toCents,type ReceiptDraft,type Product,type BasketData} from './types';
export function newLine(){return {id:newId(),label:'',name:'',quantity:'1',amount:'',category:'Other',packSize:''}}
// Order matters: the first chain found in the receipt header wins, so longer names come first.
const STORES=['Atlantic Superstore','Real Canadian Superstore','No Frills','Walmart','Sobeys','Costco','Gateway','Giant Tiger','Food Basics','Shoppers Drug Mart','Dollarama','Bulk Barn','Save Easy','Lawtons','Metro','IGA','Provigo','Maxi','Loblaws','FreshCo','REWE Center','REWE','Aldi Nord','Aldi Süd','Aldi','Lidl','EDEKA','Netto','Penny','Kaufland','Globus','HIT','tegut','Denns Biomarkt','Alnatura','Rossmann','famila','NSLC','Foodland','Independent','Superstore'];
// Register abbreviations seen on Loblaw, Sobeys and Walmart receipts. Whole words only.
const ABBREVIATIONS:Record<string,string>={chkn:'chicken',chk:'chicken',mlk:'milk',grnd:'ground',grd:'ground',bf:'beef',brst:'breast',bnls:'boneless',sknls:'skinless',blk:'black',wht:'white',brd:'bread',chs:'cheese',ched:'cheddar',yog:'yogurt',ygrt:'yogurt',choc:'chocolate',crm:'cream',ckie:'cookie',ckies:'cookies',crkr:'cracker',crkrs:'crackers',jce:'juice',ornge:'orange',lrg:'large',btr:'butter',marg:'margarine',saus:'sausage',trky:'turkey',bcn:'bacon',mshrm:'mushroom',mshrms:'mushrooms',grn:'green',veg:'vegetable',frz:'frozen',swt:'sweet',pots:'potatoes',bnna:'banana',bnnas:'bananas'};
// Strip register noise around a product label: leading PLU/UPC codes, inline
// UPCs with Walmart flags (006259801047 F) and Loblaw/Sobeys tax flags (MRJ, HMRJ).
function cleanLabel(label:string){return label.replace(/^\d{4,14}\s+/,'').replace(/\s+\d{6,14}\s*[A-Z]{0,2}$/,'').replace(/\s+[A-Z]?MRJ\b/,'').trim()}
function expandAbbreviations(name:string){return name.split(' ').map(w=>ABBREVIATIONS[w.toLowerCase()]||w).join(' ')}
export function parseReceipt(text:string,products:Product[]=[],aliases:BasketData['aliases']=[]):ReceiptDraft{
 const raw=text.split(/\r?\n/).map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);
 const header=raw.slice(0,8).join('\n');
 let store=STORES.find(s=>new RegExp('(?:^|[^a-z])'+s+'(?:$|[^a-z])','i').test(header))||raw.slice(0,3).find(l=>/[a-z]{3}/i.test(l)&&!/[\d@$]/.test(l)&&l.length<60)||'';
 if(store==='Superstore'&&/\b(NS|NB|PE|NL|nova scotia|halifax|dartmouth|bedford|sackville)\b/i.test(text))store='Atlantic Superstore';
 const d:ReceiptDraft={id:newId(),store,date:'',total:'',tax:'0.00',currency:'',lines:[],rawText:text};
 const country=/\b(canada|nova scotia|quebec|ontario|halifax|dartmouth|sobeys|no frills|superstore|nslc)\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i.test(text)?'CA':/\b(deutschland|germany|rewe|edeka|kaufland|alnatura|aldi|lidl|penny|netto|gmbh|kiel)\b/i.test(text)?'DE':'';
 d.country=country;d.currency=/\bCAD\b/i.test(text)?'CAD':/€|\bEUR\b/i.test(text)?'EUR':country==='CA'?'CAD':country==='DE'?'EUR':'';
 d.dateEvidence=receiptDate(text,country,store);d.date=d.dateEvidence.date;
 let lastItemIndex=-2,pendingQuantity:{n:number;unit:number}|null=null;

 let tax=0,total:number|undefined,subtotal:number|undefined;d.warnings=[];d.unassignedAdjustments=[];let pending='';let pendingIndex=0;let ended=false;
 const amountText=(n:number)=>(n/100).toFixed(2);
 let index=-1;
 for(const line of raw){index++;
 // "2 @ $5.99" / "2 Stk x 0,89": a pack count printed above or below its item line.
 const countLine=line.match(/^(\d{1,3})\s*(?:stk|st|pcs|pc|ea)?\.?\s*[@x×]\s*[$€]?\s*(\d+[.,]\d{2})\s*(?:€|eur)?(?:\s*\/\s*[a-z]+)?$/i);
 if(countLine&&!ended){const n=Number(countLine[1]),unit=receiptCents(countLine[2]),last=d.lines[d.lines.length-1];
  if(last&&lastItemIndex===index-1&&last.quantity==='1'&&Math.abs(toCents(last.amount)-n*unit)<=1){last.quantity=String(n);last.sourceLines=[...(last.sourceLines||[]),index+1]}
  else pendingQuantity={n,unit};
  pending='';continue}
 let m=line.match(/^(.+?)\s+(-?\$?(?:\d{1,3}(?:[.,]\d{3})+|\d{1,6})[.,]\d{2})\s*(?:€|EUR|CAD)?\s*[A-Z*]{0,4}$/i);if(!m&&pending&&/^-?[$€]?\d+(?:[.,]\d{3})*[.,]\d{2}\s*(?:€|EUR|CAD)?$/.test(line))m=[line,pending,line.replace(/\s*(?:€|EUR|CAD)$/,'')] as RegExpMatchArray;
 if(!m){
  // Walmart prints the weight below the item: "1.090 kg @ 1 kg /1.30".
  const weight=line.match(/^(\d+[.,]\d+)\s*(kg|lb)\s*@/i),last=d.lines[d.lines.length-1];
  if(weight&&last&&lastItemIndex===index-1&&!last.measuredQuantity){last.measuredQuantity=weight[1].replace(',','.');last.measuredUnit=weight[2].toLowerCase() as 'kg'|'lb';pending='';continue}
  const plain=cleanLabel(line);
  if(!ended&&/^[a-zäöüé][a-zäöüé0-9 %&.'/-]{2,70}$/i.test(plain)&&!/^(www|tel|phone|thank|merci|danke|cashier|kasse|receipt|rewe|sobeys|walmart|no frills)/i.test(plain)){pending=plain;pendingIndex=index}else pending='';continue}
 let label=cleanLabel(m[1]),amount=receiptCents(m[2]);if(!Number.isFinite(amount))continue;
 if(/^(?:[a-z]\s*=\s*)?(hst|gst|pst|qst|tps|tvq|tax\b|mwst|ust|vat)/i.test(label)){if(d.country!=='DE')tax+=amount;pending='';continue}if(/^sub[ -]?total/i.test(label)){subtotal=amount;ended=true;pending='';continue}if(/^(total|summe|gesamt|zu zahlen|balance due|amount due|grand total)\b(?!\s*(savings|saved|discount|items?|number))/i.test(label)){total=amount;ended=true;pending='';continue}
 const regular=label.match(/^(?:regular price|normalpreis|prix regulier)\s+(.+)$/i);
 if(regular){const matches=d.lines.filter(l=>normalize(l.label)===normalize(regular[1])||normalize(l.name)===normalize(regular[1]));if(matches.length===1&&amount>=toCents(matches[0].amount)){matches[0].regularPrice=amountText(amount);matches[0].sourceLines=[...(matches[0].sourceLines||[]),index+1]}else d.warnings.push('Regular price could not be uniquely associated: '+line);pending='';continue}
 const discount=label.match(/^(?:discount|rabatt|rabais|coupon|member savings|loyalty discount|scene\+?\s*savings|instant savings|sale savings|savings|preisvorteil|ersparnis|aktionsrabatt)(?:\s+(.+))?$/i);
 if(discount){
  const target=discount[1]?.trim();let candidates=target?d.lines.filter(l=>normalize(l.label)===normalize(target)||normalize(l.name)===normalize(target)):[];
  // Item-level savings are printed directly beneath the item they reduce; coupons may cover the whole basket.
  if(!target&&amount<0&&/savings|rabatt|preisvorteil|ersparnis/i.test(label)&&lastItemIndex===index-1&&d.lines.length)candidates=[d.lines[d.lines.length-1]];
  if(amount<0&&candidates.length===1){const l=candidates[0],paid=toCents(l.amount),reduction=-amount;if(reduction<=paid){const alreadyIncluded=l.regularPrice!==undefined&&toCents(l.regularPrice)-paid===reduction;l.regularPrice=l.regularPrice||l.amount;l.discount=amountText(toCents(l.discount||'0')+reduction);l.amount=alreadyIncluded?l.amount:amountText(paid-reduction);l.saleStatus='reduced';l.sourceLines=[...(l.sourceLines||[]),index+1]}else{d.unassignedAdjustments.push({label,amount:amountText(amount),sourceLine:index+1});d.warnings.push('Discount exceeds the associated item price.')}}
  else{d.unassignedAdjustments.push({label,amount:amountText(amount),sourceLine:index+1});d.warnings.push('Discount cannot be uniquely assigned: '+line)}pending='';continue;
 }
 if(amount<0)d.warnings.push('Negative purchase/return position: '+line);
 if(ended){pending='';continue}
 if(pending&&/^\d+\s*[@x×]/i.test(label)){label=pending+' '+label;pending=''}
 else if(pending&&/^\d+(?:[.,]\d+)?\s*(kg|g|lb)\b/i.test(label)){label=pending+' '+label;pending=''}
 else if(pending&&/^\d{5,14}$/.test(label)){label=pending;pending=''}
 if(/^total\s+(savings|saved|discount|items?|number)|^(cash|change|debit|credit|visa|mastercard|amex|tender|payment|approved|auth|terminal|trans\b|you saved|savings|points|rewards|coupon|discount|rabais|items?\b|articles?\b|tel\b|phone|www\.|thank|merci|receipt|invoice|cashier)/i.test(label)||!/[a-z]/i.test(label)||/^\d+\s*[@x]\s*\d/i.test(label))continue;
 let name=expandAbbreviations(label),quantity='1';const count=name.match(/\b(\d+)\s*[@x×]\s*\d+[.,]\d{2}/i);if(count){quantity=count[1];name=name.slice(0,count.index).trim()}const qty=name.match(/^(\d+)\s*x\s+(.+)/i);if(qty){quantity=qty[1];name=qty[2]}
 if(pendingQuantity&&quantity==='1'&&Math.abs(amount-pendingQuantity.n*pendingQuantity.unit)<=1)quantity=String(pendingQuantity.n);pendingQuantity=null;
 const pack=name.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|g|lb|ml|l)\b/i);const weighed=!!pack&&/[x×@]\s*\d|\/\s*(kg|lb)/i.test(label);
 if(pack){name=name.slice(0,pack.index).trim()+(!weighed?name.slice((pack.index||0)+pack[0].length):'');name=name.trim()}
 const quality=/\b(bio|organic|org)\b/i.test(name)?'organic':undefined;
 const canonical=catalogExactProduct(name.replace(/\b(bio|organic|org)\b/ig,'').trim());if(canonical)name=canonical.en;
 const alias=aliases.find(a=>a.store===normalize(d.store)&&a.label===normalize(label));const p=products.find(p=>p.id===alias?.productId)||products.find(p=>normalize(p.name)===normalize(name)&&!p.packSize&&!p.brand&&!p.variant&&!p.quality);
 d.lines.push({id:newId(),sourceLines:pendingIndex===index-1?[pendingIndex+1,index+1]:[index+1],label,name:p?.name||name.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase()),quantity,amount:(amount/100).toFixed(2),category:p?.category||inferCategory(name),packSize:pack&&!weighed?pack[1]+' '+pack[2]:p?.packSize||'',brand:p?.brand,variant:p?.variant,quality:quality||p?.quality,measuredQuantity:pack&&weighed?pack[1].replace(',','.'):undefined,measuredUnit:pack&&weighed?pack[2].toLowerCase() as 'kg'|'g'|'lb':undefined,matched:!!p});lastItemIndex=index;pending='';}
 d.tax=(tax/100).toFixed(2);d.total=total!==undefined?amountText(total):'';if(total===undefined)d.warnings.push('No printed final total was recognized.');if(!d.lines.length)d.warnings.push('No purchased item was recognized.');if(d.total&&difference(d)!==0)d.warnings.push('Printed total differs from recognized positions; no balancing item was invented.');return d;
}
export function difference(d:ReceiptDraft){return toCents(d.total||'0')-toCents(d.tax||'0')-d.lines.reduce((s,l)=>s+(toCents(l.amount)||0),0)}

export function receiptCents(text:string){const value=text.replace(/[$€\s]/g,'');const decimal=value.match(/[.,](\d{2})$/);if(!decimal)return NaN;const whole=value.slice(0,-3).replace(/[.,]/g,'');return /^-?\d+$/.test(whole)?Number(whole)*100+(whole.startsWith('-')?-1:1)*Number(decimal[1]):NaN}
