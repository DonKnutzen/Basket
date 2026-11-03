import {catalogExactProduct} from './product-catalog';
import {receiptDate} from './receipt-date';
import {newId,normalize,inferCategory,receiptCategory,toCents,type ReceiptDraft,type Product,type BasketData} from './types';
export function newLine(){return {id:newId(),label:'',name:'',quantity:'1',amount:'',category:'Other',packSize:''}}
// Order matters: the first chain found in the receipt header wins, so longer names come first.
const FUEL_STATIONS=['Irving','Esso','Petro-Canada','Shell','Ultramar','Circle K','Pioneer','Costco Gas','Aral','JET','TotalEnergies','Avia','Agip','HEM','Orlen','Westfalen','Star Tankstelle'];
const TAKEOUT_PLACES=['Tim Hortons','McDonald\'s','McDonalds','Subway','A&W','Wendy\'s','Wendys','Burger King','KFC','Popeyes','Starbucks','Domino\'s','Dominos','Pizza Hut','Pizza Pizza','Greco','Mary Brown\'s','Harvey\'s','Dairy Queen','Taco Bell','Chipotle','Five Guys','Freshii','DoorDash','SkipTheDishes','Skip The Dishes','Uber Eats','Lieferando','Wolt'];
// Restaurant receipts without a known chain name still say how the food was served.
const TAKEOUT_HINT=/\b(dine[- ]?in|take[- ]?out|to go|eat[- ]?in|zum mitnehmen|au(?:ss|ß)er haus|gratuity|trinkgeld|table\s*#?\s*\d+|server\s*:)/i;
const STORES=[...FUEL_STATIONS,...TAKEOUT_PLACES,'Atlantic Superstore','Real Canadian Superstore','No Frills','Walmart','Sobeys','Costco','Gateway','Giant Tiger','Food Basics','Shoppers Drug Mart','Dollarama','Bulk Barn','Save Easy','Lawtons','Metro','IGA','Provigo','Maxi','Loblaws','FreshCo','REWE Center','REWE','Aldi Nord','Aldi Süd','Aldi','Lidl','EDEKA','Netto','Penny','Kaufland','Globus','HIT','tegut','Denns Biomarkt','Alnatura','Rossmann','famila','NSLC','Foodland','Independent','Superstore'];
// Register abbreviations seen on Loblaw, Sobeys and Walmart receipts. Whole words only.
const ABBREVIATIONS:Record<string,string>={chkn:'chicken',chk:'chicken',mlk:'milk',grnd:'ground',grd:'ground',bf:'beef',brst:'breast',bnls:'boneless',sknls:'skinless',blk:'black',wht:'white',brd:'bread',chs:'cheese',ched:'cheddar',yog:'yogurt',ygrt:'yogurt',choc:'chocolate',crm:'cream',ckie:'cookie',ckies:'cookies',crkr:'cracker',crkrs:'crackers',jce:'juice',ornge:'orange',lrg:'large',btr:'butter',marg:'margarine',saus:'sausage',trky:'turkey',bcn:'bacon',mshrm:'mushroom',mshrms:'mushrooms',grn:'green',veg:'vegetable',frz:'frozen',swt:'sweet',pots:'potatoes',bnna:'banana',bnnas:'bananas',chse:'cheese',dnr:'dinner'};
// Strip register noise around a product label: leading PLU/UPC codes, inline
// UPCs with Walmart flags (006259801047 F) and Loblaw/Sobeys tax flags (MRJ, HMRJ).
// Loblaw prints a pack count before the UPC: "(2)06148306079 ROOSTER SUSHI MRJ".
function cleanLabel(label:string){return label.replace(/^(?:\(\d{1,3}\))?\d{4,14}[\s/]+/,'').replace(/\s+\d{6,14}\s*[A-Z]{0,2}$/,'').replace(/\s+[A-Z]?MRJ\b/,'').replace(/\s+H?MRU?$/,'').replace(/(?<!\d)\s+[a-z]$/,'').trim()}
// Photo OCR reads table texture and fingers beside the paper as short junk words,
// separated from the print by wide gaps: "— eas        ARCP: ($2.50)      -1.00 | —.".
const JUNK_CHAR=/[~—–=|_[\]{}§“”"‘’^`<>«»¦£\\]/;
const junkEdge=(t:string)=>JUNK_CHAR.test(t[0])||JUNK_CHAR.test(t[t.length-1]);
// Judged on its real words only: "~~ TOTAL STORE REWARD" is content, "“STR ee" is not.
function junkSegment(s:string){const words=s.split(' ').filter(t=>t&&/[A-Za-z0-9€$@&%#*+]/.test(t)&&!junkEdge(t));if(!words.length)return true;const w=words.join(' ');if(/\d/.test(w))return false;return w.length===1||/[a-z]/.test(w)&&words.every(t=>t.length<=3)}
// Inside prices only: O→0, l/I→1, S→5, B→8.
const PRICE_DIGITS:Record<string,string>={O:'0',o:'0',l:'1',I:'1',S:'5',B:'8'};
const priceDigits=(s:string)=>s.replace(/[OolISB]/g,c=>PRICE_DIGITS[c]);
export function cleanOcrLine(line:string){
 const segments=line.trim().split(/\s{3,}/);
 while(segments.length>1&&junkSegment(segments[0])&&!(segments.length===2&&/^-?[$€]?\d+[.,]\d{2}$/.test(segments[1])))segments.shift();
 while(segments.length>1&&(junkSegment(segments[segments.length-1])||!/\d/.test(segments[segments.length-1])&&segments[segments.length-1].length<=5))segments.pop();
 const tokens=segments.join(' ').split(/\s+/).filter(t=>/[A-Za-z0-9$€@&%#*()+\-/]/.test(t));
 while(tokens.length>1&&junkEdge(tokens[0]))tokens.shift();
 // A single stray character right after a price ("2.00 4", "2.50 &") is noise or a tax flag; the parser needs neither.
 while(tokens.length>1&&(junkEdge(tokens[tokens.length-1])||tokens.length>2&&tokens[tokens.length-1].length===1&&/^-?[$€]?\d+[.,]\d{2}$/.test(tokens[tokens.length-2])))tokens.pop();
 return tokens.map((t,i)=>i<tokens.length-3?t:t.replace(/^(-?[$€]?)([\dOolISB]{1,4})([.,])([\dOolISB]{2})$/,(m,sign,whole,dot,cents)=>/\d/.test(whole+cents)?sign+priceDigits(whole)+dot+priceDigits(cents):m)).join(' ')
  // "4. 00" (large fonts) and "BANANAS1.29" (missing gap), with optional tax flags after the price.
  .replace(/(\d[.,]) (\d{2})(?=(?: [A-Z*]{1,4}){0,2}$)/,'$1$2').replace(/([A-Za-z])(-?\d{1,4}[.,]\d{2})(?=(?: [A-Z*]{1,4}){0,2}$)/,'$1 $2')
  // OCR reads "lb" as "1b" after a weight or unit price: "0.1 1b", "21b Bag", "$20.00/1b".
  .replace(/(\d ?|\/)1b\b/g,'$1lb');
}
// A wrapped item name continues on the next line: "Sausage -" / "(Manual" above, "Weight) 2.00" below.
const openParens=(s:string)=>(s.match(/\(/g)||[]).length-(s.match(/\)/g)||[]).length;
const continues=(above:string,below:string)=>/[-,&(]$/.test(above)||openParens(above)>0||/^\(/.test(below)||openParens(below)<0;
// Lost decimal points are restored only with evidence: a Loblaw tax flag right before
// the number ("CRUS MRJ 400") or a count line whose unit price explains it ("1@ $3.29 ea 329").
function restoreDecimal(line:string,notes:string[]){
 const flagged=line.match(/^(.*\bH?MRJ) (\d{3,4})$/),counted=line.match(/^(\d{1,3}) ?@ ?\$?(\d+[.,]\d{2})((?: ?ea)?) (\d{3,5})$/);
 const expected=counted?Number(counted[1])*receiptCents(counted[2]):NaN;
 // "1@ $3.29 ea 319": one digit misread; count × unit price is printed on the same line.
 if(counted&&String(expected).length===counted[4].length&&[...counted[4]].filter((c,i)=>c!==String(expected)[i]).length===1){notes.push('OCR misread the line total, using count × unit price: '+line);return line.slice(0,-counted[4].length)+(expected/100).toFixed(2)}
 const digits=flagged?flagged[2]:counted&&expected===Number(counted[4])?counted[4]:'';
 if(!digits)return line;
 notes.push('Decimal point inferred from OCR, check this price: '+line);
 return line.slice(0,-digits.length)+digits.slice(0,-2)+'.'+digits.slice(-2);
}
function edits(a:string,b:string){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const next=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=row[j];row[j]=next}}return row[b.length]}
// Digits Tesseract confuses on thermal print. Only suggested, never applied.
const DIGIT_SWAPS=[['0','8'],['0','6'],['0','9'],['1','7'],['1','4'],['3','8'],['5','6'],['5','8'],['6','8'],['8','9']].flatMap(([a,b])=>[[a,b],[b,a]]);
function suggestFix(d:ReceiptDraft){
 const diff=difference(d);if(!diff)return;
 for(const l of d.lines){const s=l.amount;for(let i=0;i<s.length;i++)for(const [from,to] of DIGIT_SWAPS)if(s[i]===from){const alt=s.slice(0,i)+to+s.slice(i+1);if(toCents(alt)-toCents(s)===diff)return `Possible OCR misread: ${l.label} ${s} → ${alt}? Check the receipt.`}}
 const extra=d.lines.find(l=>toCents(l.amount)===-diff);if(extra)return `Line may not be a purchase: ${extra.label} ${extra.amount}. Check the receipt.`;
 if(diff>0)return `Possibly a missed item or fee of ${(diff/100).toFixed(2)}. Check the receipt.`;
}
// Fuel: the grade names a line, the litres come from the line or a "Litres: 40.123" field.
const FUEL_GRADE=/\b(regular|unleaded|premium|supreme|ultimate|v-?power|mid-?grade|plus|diesel|super(?:\s*plus|\s*e10|\s*e5)?|e10|e5|benzin|bleifrei|gasoline|petrol)\b/i;
// generic=false ignores plain "fuel"/"gas" so an explicit grade elsewhere on the receipt wins.
function fuelGrade(text:string,generic=true){const t=text.toLowerCase();return /diesel/.test(t)?'Diesel':/super\s*plus|premium|supreme|ultimate|v-?power/.test(t)?'Premium gasoline':/mid-?grade|\bplus\b/.test(t)?'Mid-grade gasoline':/e10/.test(t)?'Super E10':/\bsuper\b|\be5\b/.test(t)?'Super E5':/regular|unleaded|bleifrei|benzin|gasoline|petrol/.test(t)||generic&&/\bgas\b|fuel|kraftstoff/.test(t)?'Regular gasoline':''}
function fuelLitres(label:string,text:string){const m=label.match(/(\d+[.,]\d{1,3})\s*(?:l|litres?|liters?|ltr)\b/i)||text.match(/(?:litres?|liters?|volume|menge|ltr)\s*:?\s*(\d+[.,]\d{1,3})/i)||text.match(/(\d+[.,]\d{2,3})\s*(?:l|litres?|liters?|ltr)\b/i);return m?m[1].replace(',','.'):undefined}
function expandAbbreviations(name:string){return name.split(' ').map(w=>ABBREVIATIONS[w.toLowerCase()]||w).join(' ')}
export function parseReceipt(text:string,products:Product[]=[],aliases:BasketData['aliases']=[]):ReceiptDraft{
 // Large total fonts often OCR with a space after the decimal point: "TOTAL 21. 78".
 const ocrNotes:string[]=[];
 const lostPrice=new Set<string>();const raw=text.split(/\r?\n/).map(l=>{const c=restoreDecimal(cleanOcrLine(l),ocrNotes);if(/\S\s{3,}[A-Z$§]{1,3}\s*$/.test(l)&&!/\d[.,]\s?\d{2}/.test(l))lostPrice.add(c);return c}).filter(Boolean);
 const header=raw.slice(0,8).join('\n');
 let store=STORES.find(s=>new RegExp('(?:^|[^a-z])'+s+'(?:$|[^a-z])','i').test(header))||raw.slice(0,3).find(l=>/[a-z]{3}/i.test(l)&&!/[\d@$]/.test(l)&&l.length<60)||'';
 if(store==='Superstore'&&/\b(NS|NB|PE|NL|nova scotia|halifax|dartmouth|bedford|sackville|atlantic)\b|\(\s*902\s*\)/i.test(text))store='Atlantic Superstore';
 const d:ReceiptDraft={id:newId(),store,date:'',total:'',tax:'0.00',currency:'',lines:[],rawText:text};
 const country=/\b(canada|nova scotia|quebec|ontario|halifax|dartmouth|sobeys|no frills|superstore|nslc)\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i.test(text)?'CA':/\b(deutschland|germany|rewe|edeka|kaufland|alnatura|aldi|lidl|penny|netto|gmbh|kiel|aral|tankstelle|mwst)\b/i.test(text)?'DE':'';
 d.country=country;d.currency=/\bCAD\b/i.test(text)?'CAD':/€|\bEUR\b/i.test(text)?'EUR':country==='CA'?'CAD':country==='DE'?'EUR':'';
 d.dateEvidence=receiptDate(text,country,store);d.date=d.dateEvidence.date;
 const lostLines:ReceiptDraft['lines']=[];let lastItemIndex=-2,pendingQuantity:{n:number;unit:number}|null=null;
 const takeout=TAKEOUT_PLACES.includes(store)||TAKEOUT_HINT.test(text);
 const fuelReceipt=FUEL_STATIONS.includes(store)||FUEL_GRADE.test(text)&&/\b(pump|säule|saule|zapfs\w*|litres?|liters?|ltr|price\s*\/\s*l)\b/i.test(text);

 let tax=0,total:number|undefined,subtotal:number|undefined;d.warnings=[...ocrNotes];d.unassignedAdjustments=[];let pending='';let pendingIndex=0;let ended=false;
 const amountText=(n:number)=>(n/100).toFixed(2);
 let index=-1;
 for(const line of raw){index++;
 // "2 @ $5.99" / "2 Stk x 0,89": a pack count printed above or below its item line.
 const countLine=line.match(/^(\d{1,3})\s*(?:stk|st|pcs|pc|ea)?\.?\s*[@x×]\s*[$€]?\s*(\d+[.,]\d{2})\s*(?:€|eur)?(?:\s*\/\s*[a-z]+)?$/i);
 if(countLine&&!ended){const n=Number(countLine[1]),unit=receiptCents(countLine[2]),last=d.lines[d.lines.length-1];
  if(last&&lastItemIndex===index-1&&last.quantity==='1'&&Math.abs(toCents(last.amount)-n*unit)<=1){last.quantity=String(n);last.sourceLines=[...(last.sourceLines||[]),index+1]}
  else pendingQuantity={n,unit};
  pending='';continue}
 // Loblaw limit notes between an item and its count line: "$1.00 lmt 6, $2.00 ea".
 if(/^[$€]?\d+[.,]\d{2}\s+(?:[lI1T|]?mt|limit)\b/i.test(line))continue;
 let m=line.match(/^(.+?)\s+(-?\$?(?:\d{1,3}(?:[.,]\d{3})+|\d{1,6})[.,]\d{2})\s*(?:€|EUR|CAD)?(?:\s*[A-Z*]{1,4}){0,2}$/i);if(!m&&pending&&/^-?[$€]?\d+(?:[.,]\d{3})*[.,]\d{2}\s*(?:€|EUR|CAD)?$/.test(line))m=[line,pending,line.replace(/\s*(?:€|EUR|CAD)$/,'')] as RegExpMatchArray;
 // OCR may garble a lone price into letters ("$3.50" -> "SD"): keep the item, its price is derived from the subtotal below.
 const lost=!m&&!ended&&!/^-?[$€]?\d+[.,]\d{2}$/.test(raw[index+1]||'')&&lostPrice.has(line)&&line.match(/^(\d{1,2}\s+[a-z].{2,60})$/i);if(lost){m=[line,lost[1],'0.00'] as RegExpMatchArray;pending=''}
 if(!m){
  // Walmart prints the weight below the item: "1.090 kg @ 1 kg /1.30".
  const weight=line.match(/^(\d+[.,]\d+)\s*(kg|lb)\s*@/i),last=d.lines[d.lines.length-1];
  if(weight&&last&&lastItemIndex===index-1&&!last.measuredQuantity){last.measuredQuantity=weight[1].replace(',','.');last.measuredUnit=weight[2].toLowerCase() as 'kg'|'lb';pending='';continue}
  const plain=cleanLabel(line);
  // Restaurant and market registers print the count or weight first and wrap long names: "1 Hulled Sunflower Seeds, 910g - Organic".
  if(!ended&&/^[a-zäöüé0-9(][a-zäöüé0-9 %&.,'’()@$/-]{2,90}$/i.test(plain)&&/[a-zäöüé]{3}/i.test(plain)&&!/^(www|tel|phone|thank|merci|danke|cashier|kasse|receipt|rewe|sobeys|walmart|no frills)/i.test(plain)){pending=pending&&pendingIndex===index-1&&continues(pending,plain)?pending+' '+plain:plain;pendingIndex=index}else pending='';continue}
 let label=cleanLabel(m[1]),amount=receiptCents(m[2]);if(!Number.isFinite(amount))continue;
 if(/^(?:[a-z]\s*=\s*)?(hst|gst|pst|qst|tps|tvq|tax\b|mwst|ust|vat)/i.test(label)){// Included tax (fuel, German VAT) is already part of the line totals.
  if(d.country!=='DE'&&!/incl|inkl|included|enthalten|^(?:[a-z]\s*=\s*)?(mwst|ust)/i.test(label))tax+=amount;pending='';continue}
 if(/^(price\s*\/\s*l(?:itre|iter)?|price per lit(?:re|er)|ppl|preis\s*\/\s*l|grundpreis|unit price)\s*:?$/i.test(label)){pending='';continue}// Keywords may follow up to two short junk words and read 0 for O: "A a SUBTOTAL", "T0TAL".
 const key=label.replace(/0/g,'O').replace(/^(?:\S{1,3} ){0,2}(?=\S{5})/,''),lastWord=key.split(' ').pop()!.toUpperCase();
 if(/^sub[ -]?total|^\S+ sub[ -]?total$/i.test(key)){subtotal=amount;ended=true;pending='';continue}
 const fuzzyTotal=total===undefined&&key.split(' ').length<=3&&!/sav|item|disc|point|reward|number/i.test(key)&&(edits(lastWord,'TOTAL')<=1||d.country==='DE'&&key.split(' ').length===1&&edits(lastWord,'SUMME')<=2&&amount*100>=d.lines.reduce((s,l)=>s+Math.round(+l.amount*100),0)||subtotal!==undefined&&amount>=subtotal&&edits(lastWord,'TOTAL')<=2);
 if(fuzzyTotal||/^(total|summe|gesamt|zu zahlen|balance due|amount due|grand total)\b(?!\s*(savings|saved|discount|items?|number))/i.test(key)){if(total===undefined||amount)total=amount;ended=true;pending='';continue}
 const regular=label.match(/^(?:regular price|normalpreis|prix regulier)\s+(.+)$/i);
 if(regular){const matches=d.lines.filter(l=>normalize(l.label)===normalize(regular[1])||normalize(l.name)===normalize(regular[1]));if(matches.length===1&&amount>=toCents(matches[0].amount)){matches[0].regularPrice=amountText(amount);matches[0].sourceLines=[...(matches[0].sourceLines||[]),index+1]}else d.warnings.push('Regular price could not be uniquely associated: '+line);pending='';continue}
 const discount=label.match(/^(?:discount|rabatt|rabais|coupon|arcp:?|member savings|loyalty discount|scene\+?\s*savings|instant savings|sale savings|savings|preisvorteil|ersparnis|aktionsrabatt)(?:\s+(.+))?$/i);
 if(discount){
  // "ARCP: ($2.50) -1.00" repeats the regular price in brackets instead of naming the item.
  // OCR may add a stray letter: "ARCP: ($2. 50) L -1.00".
  const target=discount[1]?.replace(/\(\s*[$€]?\d+[.,]\s?\d{2}\s*\)/,'').replace(/(?:^|\s)\S(?=\s|$)/g,'').trim();let candidates=target?d.lines.filter(l=>normalize(l.label)===normalize(target)||normalize(l.name)===normalize(target)):[];
  // Item-level savings are printed directly beneath the item they reduce; coupons may cover the whole basket.
  if(!target&&amount<0&&/savings|rabatt|preisvorteil|ersparnis|arcp/i.test(label)&&lastItemIndex===index-1&&d.lines.length)candidates=[d.lines[d.lines.length-1]];
  if(amount<0&&candidates.length===1){const l=candidates[0],paid=toCents(l.amount),reduction=-amount;if(reduction<=paid){const alreadyIncluded=l.regularPrice!==undefined&&toCents(l.regularPrice)-paid===reduction;l.regularPrice=l.regularPrice||l.amount;l.discount=amountText(toCents(l.discount||'0')+reduction);l.amount=alreadyIncluded?l.amount:amountText(paid-reduction);l.saleStatus='reduced';l.sourceLines=[...(l.sourceLines||[]),index+1]}else{d.unassignedAdjustments.push({label,amount:amountText(amount),sourceLine:index+1});d.warnings.push('Discount exceeds the associated item price.')}}
  else{d.unassignedAdjustments.push({label,amount:amountText(amount),sourceLine:index+1});d.warnings.push('Discount cannot be uniquely assigned: '+line)}pending='';continue;
 }
 if(amount<0)d.warnings.push('Negative purchase/return position: '+line);
 if(ended){pending='';continue}
 if(pending&&/^\d+\s*[@x×]/i.test(label)){label=pending+' '+label;pending=''}
 else if(pending&&/^\d+(?:[.,]\d+)?\s*(kg|g|lb|l)\b/i.test(label)){label=pending+' '+label;pending=''}
 else if(pending&&/^\d{5,14}$/.test(label)){label=pending;pending=''}
 else if(pending&&pendingIndex===index-1&&continues(pending,label)){label=pending+' '+label;pending=''}
 if(/^total\s+(savings|saved|discount|items?|number)|^(cash|change|debit|credit|visa|mastercard|amex|tender|payment|approved|auth|terminal|trans\b|you saved|savings|points|rewards|coupon|discount|rabais|items?\b|articles?\b|tel\b|phone|www\.|thank|merci|receipt|invoice|cashier)/i.test(label)||!/[a-z]/i.test(label)||/^\d+\s*[@x]\s*\$?\d/i.test(label))continue;
 // Loyalty stamps and points print as zero-priced lines: "24632 PHY STAMP EARN Q 0.00".
 if(amount===0&&/\b(stamps?|pts|points|rewards?|earn)\b/i.test(label)){pending='';continue}
 if(fuelReceipt&&(FUEL_GRADE.test(label)||/\b(fuel|pump|säule|saule|tank\w*|gas sale|kraftstoff)\b/i.test(label))){
  d.lines.push({id:newId(),sourceLines:[index+1],label,name:fuelGrade(label,false)||fuelGrade(text,false)||fuelGrade(label)||'Fuel',quantity:'1',amount:amountText(amount),category:'Fuel',packSize:'',measuredQuantity:fuelLitres(label,text),measuredUnit:fuelLitres(label,text)?'L':undefined});
  lastItemIndex=index;pending='';pendingQuantity=null;continue}
 let name=expandAbbreviations(label),quantity='1';const count=name.match(/\b(\d+)\s*[@x×]\s*\$?\d+[.,]\d{2}/i);if(count){quantity=count[1];name=name.slice(0,count.index).trim()}const qty=name.match(/^(\d+)\s*x\s+(.+)/i);if(qty){quantity=qty[1];name=qty[2]}
 // Restaurant registers print the count first: "1 BAGEL BELT", "2 MED ORIGINAL".
 const served=takeout&&!qty&&name.match(/^(\d{1,2})\s+([a-z].*)$/i);if(served){quantity=served[1];name=served[2]}
 if(pendingQuantity&&quantity==='1'&&Math.abs(amount-pendingQuantity.n*pendingQuantity.unit)<=1)quantity=String(pendingQuantity.n);pendingQuantity=null;
 const pack=name.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|g|lb|ml|l)\b/i);const weighed=!!pack&&/[x×@]\s*\d|\/\s*(kg|lb)/i.test(label);
 if(pack){name=name.slice(0,pack.index).trim()+(!weighed?name.slice((pack.index||0)+pack[0].length):'');name=name.trim()}
 const quality=/\b(bio|organic|org)\b/i.test(name)?'organic':undefined;
 const canonical=catalogExactProduct(name.replace(/\b(bio|organic|org)\b/ig,'').trim());if(canonical)name=canonical.en;
 const alias=aliases.find(a=>a.store===normalize(d.store)&&a.label===normalize(label));const p=products.find(p=>p.id===alias?.productId)||products.find(p=>normalize(p.name)===normalize(name)&&!p.packSize&&!p.brand&&!p.variant&&!p.quality);
 d.lines.push({id:newId(),sourceLines:pendingIndex===index-1?[pendingIndex+1,index+1]:[index+1],label,name:p?.name||name.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase()),quantity,amount:(amount/100).toFixed(2),category:takeout?'Takeout':receiptCategory(name,p?.category),packSize:pack&&!weighed?pack[1]+' '+pack[2]:p?.packSize||'',brand:p?.brand,variant:p?.variant,quality:quality||p?.quality,measuredQuantity:pack&&weighed?pack[1].replace(',','.'):undefined,measuredUnit:pack&&weighed?pack[2].toLowerCase() as 'kg'|'g'|'lb':undefined,matched:!!p});lastItemIndex=index;if(lost)lostLines.push(d.lines[d.lines.length-1]);pending='';}
 if(lostLines.length===1&&subtotal!==undefined){const gap=subtotal-d.lines.reduce((s,l)=>s+toCents(l.amount),0);if(gap>0&&gap<subtotal){lostLines[0].amount=amountText(gap);d.warnings.push('Price unreadable, derived from subtotal: '+lostLines[0].label)}}
 for(const l of lostLines)if(!toCents(l.amount))d.lines.splice(d.lines.indexOf(l),1);
 d.tax=(tax/100).toFixed(2);d.total=total!==undefined?amountText(total):'';if(total===undefined)d.warnings.push('No printed final total was recognized.');if(!d.lines.length)d.warnings.push('No purchased item was recognized.');if(d.total&&difference(d)!==0){d.warnings.push('Printed total differs from recognized positions; no balancing item was invented.');const fix=suggestFix(d);if(fix)d.warnings.push(fix)}return d;
}
export function difference(d:ReceiptDraft){return toCents(d.total||'0')-toCents(d.tax||'0')-d.lines.reduce((s,l)=>s+(toCents(l.amount)||0),0)}

export function receiptCents(text:string){const value=text.replace(/[$€\s]/g,'');const decimal=value.match(/[.,](\d{2})$/);if(!decimal)return NaN;const whole=value.slice(0,-3).replace(/[.,]/g,'');return /^-?\d+$/.test(whole)?Number(whole)*100+(whole.startsWith('-')?-1:1)*Number(decimal[1]):NaN}
