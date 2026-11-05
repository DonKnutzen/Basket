import {cleanOcrLine,parseReceipt,difference,receiptCents} from './receipt-parser';
import {normalize,toCents} from './types';
import type {OcrRow} from './receipt-layout';
import {findPriceColumn,linePriceAnchor,printedAmounts,inPriceColumn,constrainReceiptToPriceColumn} from './receipt-price-column';

export type ReceiptRead={text:string;confidence:number;rows?:OcrRow[];warnings?:string[];uncertainItems?:{label:string;amount:string}[]};
type Candidate={pass:number;text:string;label:string;amount:string;y:number;height:number;confidence:number;nameScore:number;nameY:number};
const median=(ns:number[])=>[...ns].sort((a,b)=>a-b)[ns.length>>1]||0;
const words=(s:string)=>normalize(s).split(' ').filter(w=>/^[a-z]{3,}$/.test(w));
const nameScore=(s:string)=>words(s).join('').length-(s.match(/\d{5,}|[|{}~]/g)||[]).length*10;

// Receipts share the same image coordinates across full-size passes. Use those
// coordinates to preserve multiplicity; identical names/prices are not duplicates.
export function mergeReceiptReads(reads:ReceiptRead[]):ReceiptRead|null{
 const parsed=reads.map(r=>parseReceipt(r.text));
 const totals=new Map<string,number>();
 for(const d of parsed)if(d.total)totals.set(d.total,(totals.get(d.total)||0)+1);
 const ranked=[...totals].sort((a,b)=>b[1]-a[1]);
 if(!ranked.length||ranked.length>1&&ranked[0][1]===ranked[1][1])return null;
 const total=ranked[0][0],totalPass=parsed.findIndex(d=>d.total===total),base=reads[totalPass];
 const candidates:Candidate[]=[],totalYs:number[]=[],column=findPriceColumn(reads.flatMap(r=>r.rows||[]));
 for(const [pass,read] of reads.entries()){
  const rows=read.rows?.filter(r=>cleanOcrLine(r.text));if(!rows?.length)continue;
  for(const row of rows){const text=cleanOcrLine(row.text),amount=text.match(/(-?\d+[.,]\d{2})\s*(?:EUR|CAD|€)?$/i)?.[1];if(amount&&receiptCents(amount)===toCents(total)&&/^(?:\S{1,3}\s+){0,2}(?:summe|total(?!\s+(?:fuel|savings|items|store))|gesamt|grand total)\b/i.test(text))totalYs.push(row.bbox.y0);}
  for(const line of parsed[pass].lines){
   const source=(line.sourceLines||[]).map(i=>rows[i-1]).filter((r):r is OcrRow=>!!r);
   if(!source.length||!Number.isFinite(toCents(line.amount))||/^(?:[a-z]{0,2}\s+)?[\dijl]+\s*st(?:k)?\s*x\b/i.test(line.label)||/^\d{1,3}[i1l]?k?x$/i.test(line.label))continue;
   const labelWords=words(line.label);
   const row=[...source].sort((a,b)=>words(b.text).filter(w=>labelWords.includes(w)).length-words(a.text).filter(w=>labelWords.includes(w)).length)[0],substantive=row.words.filter(w=>words(w.text).length&&w.bbox.x0<row.bbox.x1*.7),anchors=substantive.length?substantive:row.words;
   const price=column?linePriceAnchor(line,rows,column):undefined;
   if(column&&!price)continue;
   const nameY=median(anchors.map(w=>(w.bbox.y0+w.bbox.y1)/2));
   const y=price?(price.bbox.y0+price.bbox.y1)/2:nameY,height=price?price.bbox.y1-price.bbox.y0:median(anchors.map(w=>w.bbox.y1-w.bbox.y0));
   // Keep quantity/discount context, but never reintroduce another left-hand
   // amount as a booking when the merged text is parsed again.
   const context=column?source.filter(r=>!printedAmounts([r]).length||printedAmounts([r]).some(p=>inPriceColumn(p,column)||price&&p.bbox.x0===price.bbox.x0&&p.bbox.y0===price.bbox.y0&&p.bbox.x1===price.bbox.x1)||/^\d+\s*(?:stk|st|pcs?|ea)?\.?\s*[@x×*]/i.test(cleanOcrLine(r.text))||/^(?:arcp|discount|rabatt|coupon|savings)\b/i.test(cleanOcrLine(r.text))):source;
   candidates.push({pass,text:(context.length?context:source).map(r=>r.text).join('\n'),label:line.label,amount:line.amount,y,height,nameY,confidence:substantive.reduce((s,w)=>s+(w.confidence??0),0)/(substantive.length||1),nameScore:nameScore(line.name)});
  }
 }
 if(!candidates.length||!totalYs.length)return null;
 const end=median(totalYs),groups:Candidate[][]=[],height=median(candidates.map(c=>c.height));
 const similarity=(a:string,b:string)=>{a=normalize(a).replace(/[^a-z]/g,'');b=normalize(b).replace(/[^a-z]/g,'');const grams=new Set(Array.from({length:Math.max(0,a.length-1)},(_,i)=>a.slice(i,i+2)));let n=0;for(let i=0;i<b.length-1;i++)if(grams.has(b.slice(i,i+2)))n++;return n/Math.max(1,a.length-1,b.length-1)};
 // Oversized OCR boxes often span a fold or two rows. Anchor normal-height
 // readings first, then attach ambiguous boxes using both text and distance.
 for(const c of candidates.filter(c=>c.y<end).sort((a,b)=>Number(a.height>height*1.5)-Number(b.height>height*1.5)||a.y-b.y)){
  const possible=groups.filter(g=>(!g.some(x=>x.pass===c.pass)||!!column)&&Math.abs(median(g.map(x=>x.y))-c.y)<height*(c.height>height*1.5?.8:.45));
  possible.sort((a,b)=>{const score=(g:Candidate[])=>Math.max(...g.map(x=>similarity(x.label,c.label)))*2-Math.abs(median(g.map(x=>x.y))-c.y)/height;return score(b)-score(a)});
  const group=possible[0];if(group)group.push(c);else groups.push([c]);
 }
 const chosen:Candidate[]=[],warnings:string[]=[],uncertainItems:{label:string;amount:string}[]=[];
 for(const group of groups){
  const amounts=new Map<string,number>();for(const c of group)amounts.set(c.amount,new Set(group.filter(x=>x.amount===c.amount).map(x=>x.pass)).size);
  const vote=[...amounts].sort((a,b)=>b[1]-a[1]),same=group.filter(c=>c.amount===vote[0][0]);
  // Repeated name tokens matter more than the confidence of one garbled word.
  const agreement=(c:Candidate)=>words(c.label).reduce((sum,token)=>sum+group.filter(x=>words(x.label).some(w=>w.startsWith(token)||token.startsWith(w))).length,0);
  const rank=(c:Candidate)=>agreement(c)*10+c.nameScore*5+c.confidence*.25;
  same.sort((a,b)=>(b.nameScore>0?1:0)-(a.nameScore>0?1:0)||rank(b)-rank(a));
  chosen.push(same[0]);
  if(group.length>1&&!words(same[0].label).some(token=>group.filter(c=>words(c.label).some(w=>Math.min(w.length,token.length)/Math.max(w.length,token.length)>=.7&&(w===token||w.startsWith(token)||token.startsWith(w)||w.endsWith(token)||token.endsWith(w)))).length>1))uncertainItems.push({label:same[0].label,amount:same[0].amount});
  if(vote.length>1&&vote[0][1]===vote[1][1])warnings.push('OCR passes disagree on an item price: '+same[0].label+'. Check the receipt.');
 }
 if(!column&&chosen.length<Math.max(...parsed.filter(d=>d.total===total).map(d=>d.lines.length)))return null;
 const start=Math.min(...chosen.map(c=>c.nameY-c.height)),header=(base.rows||[]).filter(r=>r.bbox.y1<start).map(r=>r.text).join('\n');
 // Tax is separate from gross item amounts. Reuse its original row, never infer it
 // from a gap or add it a second time from a different pass.
 const taxRows=(base.rows||[]).filter(r=>/^(?:\S{1,3}\s+)?(?:hst|gst|pst|qst|tax|mwst|ust|vat)\b/i.test(cleanOcrLine(r.text))).map(r=>r.text);
 const count=(text:string)=>cleanOcrLine(text).match(/^(\d{1,3})\s*(?:stk|st|pcs?|ea|[s58][t1il]k)?\.?\s*[@x×*]\s*[$€]?\s*(\d+[.,]\d{2})\s*(?:€|EUR)?$/i);
 const counters=reads.flatMap(r=>r.rows||[]).map(row=>({row,m:count(row.text)})).filter(c=>c.m);
 const body=chosen.sort((a,b)=>a.y-b.y).map((c,i)=>{
  if(c.text.split('\n').some(count))return c.text;
  const matches=counters.filter(({row,m})=>{const cy=(row.bbox.y0+row.bbox.y1)/2;return cy>c.nameY+height*.2&&cy<(chosen[i+1]?.nameY??end)-height*.1&&Number(m![1])*receiptCents(m![2])===Math.abs(toCents(c.amount))});
  const quantities=new Set(matches.map(c=>c.m![1]));
  return quantities.size===1?c.text+'\n'+matches[0].m![1]+' Stk x '+matches[0].m![2]:c.text;
 });
 const text=[header,...body,...taxRows,'TOTAL '+total].join('\n');
 const d=parseReceipt(text);
 if(d.total!==total||d.lines.length<chosen.length)return null;
 return {text,confidence:base.confidence,warnings:[...new Set(warnings)],uncertainItems};
}

export function receiptReadQuality(read:ReceiptRead){
 const original=parseReceipt(read.text),d=constrainReceiptToPriceColumn(original,read.rows),balanced=!!d.total&&d.lines.length>0&&difference(d)===0;
 return {draft:d,complete:balanced&&d.lines.length===original.lines.length&&!d.lines.some(l=>l.warnings?.length)&&!read.warnings?.length&&!read.uncertainItems?.length,score:(d.total?balanced?2:1:0)*1000+read.confidence};
}
