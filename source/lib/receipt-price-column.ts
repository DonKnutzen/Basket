import type {OcrRow,OcrWord} from './receipt-layout';
import {cleanOcrLine,receiptCents} from './receipt-parser';
import type {DraftLine,ReceiptDraft} from './types';
import {toCents} from './types';

export type PrintedAmount={amount:string;bbox:OcrWord['bbox']};
export type PriceColumn={intercept:number;slope:number;tolerance:number;height:number};
const median=(xs:number[])=>[...xs].sort((a,b)=>a-b)[xs.length>>1]||0;
const cy=(p:PrintedAmount)=>(p.bbox.y0+p.bbox.y1)/2;
const price=/^[„'"(]*(-?[$€]?(?:\d{1,3}(?:[.,]\d{3})+|\d{1,6})[.,]\d{2})(?:\s*(?:EUR|CAD|€|[A-DX*]{1,4}))*[),;:]?$/i;

export function printedAmounts(rows:OcrRow[]):PrintedAmount[]{
 const result:PrintedAmount[]=[];
 const tokens=rows.flatMap(row=>{
  const words=[...row.words].sort((a,b)=>a.bbox.x0-b.bbox.x0),joined:OcrWord[]=[];
  for(let i=0;i<words.length;i++){
   const w=words[i],next=words[i+1];
   // OCR sometimes splits "-0,50" into "-0," and "50". It is still one
   // printed price if the glyph boxes are adjacent on the same physical row.
   if(next&&/^-?[$€]?\d+[.,]$/.test(w.text)&&/^\d{2}(?:[A-DX*]{0,4})$/i.test(next.text)&&next.bbox.x0-w.bbox.x1<Math.max(w.bbox.y1-w.bbox.y0,next.bbox.y1-next.bbox.y0)*.75&&Math.abs((w.bbox.y0+w.bbox.y1-next.bbox.y0-next.bbox.y1)/2)<Math.max(w.bbox.y1-w.bbox.y0,next.bbox.y1-next.bbox.y0)*.6){
    joined.push({...w,text:w.text+next.text,bbox:{x0:w.bbox.x0,x1:next.bbox.x1,y0:Math.min(w.bbox.y0,next.bbox.y0),y1:Math.max(w.bbox.y1,next.bbox.y1)},symbols:w.symbols&&next.symbols?[...w.symbols,...next.symbols]:undefined});i++;
   }else joined.push(w);
  }
  return joined;
 });
 for(const word of tokens){
  const m=word.text.trim().match(price);if(!m)continue;
  const cents=receiptCents(m[1]);if(!Number.isFinite(cents))continue;
  let bbox=word.bbox;
  // A glued VAT flag must not move the measured end of the price column.
  const symbols=word.symbols||[],raw=symbols.map(s=>s.text).join(''),start=raw.indexOf(m[1]);
  if(start>=0&&symbols.length===raw.length){const digits=symbols.slice(start,start+m[1].length);if(digits.length)bbox={x0:Math.min(...digits.map(s=>s.bbox.x0)),x1:Math.max(...digits.map(s=>s.bbox.x1)),y0:Math.min(...digits.map(s=>s.bbox.y0)),y1:Math.max(...digits.map(s=>s.bbox.y1))};}
  result.push({amount:(cents/100).toFixed(2),bbox});
 }
 return result;
}

// Detect a repeatedly printed, right-aligned amount column. No fixed REWE pixel
// coordinate and no rule that every receipt must use the same layout.
export function findPriceColumn(rows:OcrRow[]):PriceColumn|null{
 const points=printedAmounts(rows);if(points.length<3)return null;
 const height=median(points.map(p=>p.bbox.y1-p.bbox.y0)),right=Math.max(...rows.map(r=>r.bbox.x1));
 const tolerance=Math.max(height*.65,right*.035),groups:PrintedAmount[][]=[];
 for(const p of [...points].sort((a,b)=>a.bbox.x1-b.bbox.x1)){
  const group=groups.find(g=>Math.abs(median(g.map(x=>x.bbox.x1))-p.bbox.x1)<=tolerance);
  if(group)group.push(p);else groups.push([p]);
 }
 const distinctRows=(ps:PrintedAmount[])=>{const ys:number[]=[];for(const p of ps)if(!ys.some(y=>Math.abs(y-cy(p))<height*.65))ys.push(cy(p));return ys.length};
 const peak=Math.max(...groups.map(distinctRows));
 const seed=groups.filter(g=>distinctRows(g)>=Math.max(3,peak*.4)&&median(g.map(p=>p.bbox.x1))>right*.55).sort((a,b)=>median(b.map(p=>p.bbox.x1))-median(a.map(p=>p.bbox.x1)))[0];
 if(!seed)return null;
 const fit=(ps:PrintedAmount[])=>{const y=ps.reduce((s,p)=>s+cy(p),0)/ps.length,x=ps.reduce((s,p)=>s+p.bbox.x1,0)/ps.length,variance=ps.reduce((s,p)=>s+(cy(p)-y)**2,0);const slope=variance?ps.reduce((s,p)=>s+(cy(p)-y)*(p.bbox.x1-x),0)/variance:0;return {intercept:x-slope*y,slope,tolerance,height}};
 let column=fit(seed);if(Math.abs(column.slope)>.2)return null;
 const inliers=points.filter(p=>inPriceColumn(p,column));
 if(distinctRows(inliers)<3)return null;
 column=fit(inliers);return Math.abs(column.slope)<=.2?column:null;
}

export const inPriceColumn=(p:PrintedAmount,c:PriceColumn)=>Math.abs(p.bbox.x1-c.intercept-c.slope*cy(p))<=c.tolerance;

export function linePriceAnchor(line:DraftLine,rows:OcrRow[],column:PriceColumn):PrintedAmount|undefined{
 const source=(line.sourceLines||[]).map(i=>rows[i-1]).filter((r):r is OcrRow=>!!r);
 const anchors=printedAmounts(source).filter(p=>inPriceColumn(p,column));
 if(anchors.length)return anchors.find(p=>p.amount===(line.regularPrice||line.amount))||anchors[0];
 // A named gratuity is an explicit financial adjustment, unlike a unit price.
 if(/^(?:tip|trinkgeld|gratuity|pourboire)\b/i.test(line.label))return printedAmounts(source).find(p=>p.amount===line.amount);
 // Some layouts wrap a long description above a lone price at the left margin.
 // A count/unit-price row is not this exception.
 if(source.length>=2){const last=source[source.length-1],first=cleanOcrLine(source[0].text);
  if(price.test(cleanOcrLine(last.text))&&/[a-z]{3}/i.test(first)&&!/^\d+\s*(?:st\w*|pcs?|ea|[@x×*])/i.test(first)&&!printedAmounts([source[0]]).length)return printedAmounts([last])[0];
 }
 return undefined;
}

export function constrainReceiptToPriceColumn(draft:ReceiptDraft,rows?:OcrRow[]):ReceiptDraft{
 if(!rows?.length)return draft;
 const cleaned=rows.filter(r=>cleanOcrLine(r.text)),column=findPriceColumn(cleaned);if(!column)return draft;
 const lines=draft.lines.filter(l=>!l.sourceLines?.length||/^(?:tip|trinkgeld|gratuity|pourboire)\b/i.test(l.label)||linePriceAnchor(l,cleaned,column));
 if(lines.length===draft.lines.length)return draft;
 const warnings=(draft.warnings||[]).filter(w=>!w.startsWith('Printed total differs')&&!w.startsWith('Possibly a missed item')&&!w.startsWith('Possible OCR misread:')&&!w.startsWith('Line may not be a purchase:'));
 const sum=lines.reduce((s,l)=>s+(toCents(l.amount)||0),0)+toCents(draft.tax||'0');
 if(draft.total&&Math.abs(toCents(draft.total)-sum)>1)warnings.push('Printed total differs from recognized positions; check the unreadable amounts in the receipt price column.');
 return {...draft,lines,warnings};
}
