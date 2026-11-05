// Which Tesseract passes read a receipt photo, independent of browser canvases so the
// same steps run in tests on real photos.
import {binarize,cropScale,type Gray} from './receipt-image';
import {wordsToRows,blockWords} from './receipt-layout';
import {parseReceipt} from './receipt-parser';
import {receiptDate,type DateEvidence} from './receipt-date';
import {toCents,normalize} from './types';
import {constrainReceiptToPriceColumn} from './receipt-price-column';
import {mergeReceiptReads,receiptReadQuality,type ReceiptRead} from './receipt-merge';

type Recognized={data:{text:string;confidence:number;blocks?:Parameters<typeof blockWords>[0]}};
export type OcrWorker={setParameters(params:Record<string,string>):Promise<unknown>;recognize(image:never,options?:object,output?:object):Promise<Recognized>};
export type OcrResult=ReceiptRead&{dateText?:string};
export type OcrStage={phase:'items'|'date';index:number;count:number};
const SINGLE_COLUMN='4',SINGLE_BLOCK='6',AUTO='3',SPARSE='11';

// A valid calendar date can still be a misread OCR year/day. Preserve it for
// confirmation rather than silently replacing stronger or conflicting evidence.
export function ocrDateEvidence(text:string,country='',store='',scan=new Date()):DateEvidence{
 const evidence=receiptDate(text,country,store,scan);
 if(evidence.status!=='recognized')return evidence;
 const day=(offset:number)=>{const d=new Date(scan.getFullYear(),scan.getMonth(),scan.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
 const partialDays=[...text.matchAll(/\bdatum:?\s*(\d{1,2})\.(?!\s*\d)/gi)].map(m=>Number(m[1]));
 if(evidence.date<day(-366)||evidence.date>day(1)||partialDays.some(d=>d!==Number(evidence.date.slice(-2))))return {...evidence,date:'',status:'ambiguous'};
 return evidence;
}


// Balanced receipts win; a printed total alone beats none; then OCR confidence.
const quality=(o:OcrResult)=>receiptReadQuality(o).score;

// bandBudget caps the date re-reads (ms): a slow phone then asks for the date instead of
// running into the scanner's overall timeout. passBudget does the same for the extra layout passes.
export async function readReceiptPhoto<I>(worker:OcrWorker,prepared:Gray,toImage:(img:Gray)=>I,alive:()=>boolean=()=>true,bandBudget=12000,passBudget=50000,onStage?:(stage:OcrStage)=>void):Promise<OcrResult|null>{
 if(!alive())return null;
 const started=Date.now();
 const recognize=(img:Gray,output?:object)=>worker.recognize(toImage(img) as never,{},output);
 // SINGLE_COLUMN read a real Superstore photo far better than SINGLE_BLOCK (82 vs 50 % confidence).
 // Rows are rebuilt from word boxes so right-aligned prices stay with their names.
 await worker.setParameters({tessedit_pageseg_mode:SINGLE_COLUMN,preserve_interword_spaces:'1'});
 const read=async(img:Gray)=>{const r=await recognize(img,{text:true,blocks:true});const rows=wordsToRows(blockWords(r.data.blocks));return {text:rows.length?rows.map(r=>r.text).join('\n'):r.data.text,confidence:r.data.confidence,rows}};
 const texts:string[]=[];
 onStage?.({phase:'items',index:1,count:6});
 let best:OcrResult=await read(prepared);texts.push(best.text);const reads=[best];
 // Shadows and folds: a second attempt on a locally binarized copy, then the same copy read as
 // one block, which balanced real Superstore and Uprooted photos that SINGLE_COLUMN left short.
 // A famila photo kept only the names in SINGLE_COLUMN (the price column vanished) and lost "Summe" as one
 // block; automatic layout read every price and sparse text the total, so those come last, within passBudget.
 const binarized=!receiptReadQuality(best).complete&&alive()?binarize(prepared):null;
 const passes:[()=>Gray,string][]=[[()=>binarized!,SINGLE_COLUMN],[()=>binarized!,SINGLE_BLOCK],[()=>prepared,AUTO],[()=>prepared,SPARSE],[()=>binarized!,SPARSE]];
 for(const [i,[image,mode]] of (binarized?passes:[]).entries()){if(receiptReadQuality(best).complete||!alive()||Date.now()-started>passBudget)break;
  onStage?.({phase:'items',index:i+2,count:6});
  await worker.setParameters({tessedit_pageseg_mode:mode});
  const next=await read(image());texts.push(next.text);reads.push(next);if(quality(next)>quality(best))best=next}
 if(!alive())return null;
 // One pass may read every item but lose the total line while another reads the total but drops a row
 // (famila tilted 3°: all ten items as one block, "Summe 23,68" only in single-column mode). A total
 // printed in one pass that equals another pass's item sum to the cent completes that pass.
 if(!receiptReadQuality(best).complete){const merged=mergeReceiptReads(reads);if(merged)best=merged;}
 if(quality(best)<2000){const totals=new Set(reads.map(r=>parseReceipt(r.text).total).filter(Boolean));
  for(const r of reads){const d=parseReceipt(r.text),sum=d.lines.reduce((s,l)=>s+toCents(l.amount),0)+toCents(d.tax||'0'),total=(sum/100).toFixed(2);
   if(d.lines.length>1&&d.total!==total&&totals.has(total)){const merged={...r,text:r.text+'\nTotal   '+total};if(quality(merged)>=2000){best=merged;break}}}}
 const p=parseReceipt(best.text),evidence=()=>ocrDateEvidence(texts.join('\n'),p.country,p.store);
 if(evidence().status==='recognized')return {...best,dateText:texts.join('\n')};
 // SINGLE_COLUMN can drop the date row entirely (Kaufland: "Datum:02.11.26"), and Tesseract's
 // global threshold loses it on unevenly lit paper (Shell: "DATE: 2026/10/31"). Overlapping
 // bands read on their own find it; two band heights because each missed one of those photos.
 await worker.setParameters({tessedit_pageseg_mode:SINGLE_BLOCK});
 const until=Math.min(Date.now()+bandBudget,started+passBudget+bandBudget),bands:{x:number;y:number;width:number;height:number}[]=[];
 // Date labels locate the useful area before falling back to overlapping bands.
 const labels=reads.flatMap(r=>(r.rows||[]).filter(row=>/\b(datum|date|datetime|ordered|kaufdatum)\b/i.test(row.text)));
 for(const share of [.3,.4])for(const row of labels){
  const height=Math.min(prepared.height,Math.round(prepared.width*share)),cy=(row.bbox.y0+row.bbox.y1)/2,y=Math.max(0,Math.min(prepared.height-height,Math.round(cy-height/2)));
  // Some registers put the date far right of its label. Read the actual value
  // column separately; a full-width band can merge it with the time below.
  const digits=reads.flatMap(r=>(r.rows||[]).flatMap(r=>r.words)).filter(w=>w.bbox.x0>prepared.width*.5&&Math.abs((w.bbox.y0+w.bbox.y1)/2-cy)<height/3&&/\d/.test(w.text));
  if(digits.length){const margin=Math.round(prepared.width*.025),x=Math.max(0,Math.min(...digits.map(w=>w.bbox.x0))-margin),width=Math.min(prepared.width-x,Math.max(...digits.map(w=>w.bbox.x1))-x+margin);if(!bands.some(b=>Math.abs(b.y-y)<height/4&&b.height===height&&b.x===x))bands.push({x,y,width,height})}
  if(!bands.some(b=>Math.abs(b.y-y)<height/4&&b.height===height&&b.x===0))bands.push({x:0,y,width:prepared.width,height});
 }
 // A located but unreadable date needs confirmation after the targeted attempts;
 // rereading unrelated item rows cannot recover that field. Scan all bands only
 // when the full passes did not locate a date label at all.
 if(!labels.length)for(const share of [.2,.3]){const height=Math.round(prepared.width*share);for(let y=0;prepared.height-y>=height/3;y+=Math.max(1,Math.round(height/2)))bands.push({x:0,y,width:prepared.width,height:Math.min(height,prepared.height-y)})}
 for(const [i,band] of bands.entries()){
  if(!alive())return null;
  if(Date.now()>=until)break;
  onStage?.({phase:'date',index:i+1,count:bands.length});
  texts.push((await recognize(cropScale(prepared,band,1))).data.text);
  if(!alive())return null;
  if(evidence().status==='recognized')break;
 }
 return {...best,dateText:texts.join('\n')};
}

// The purchase date from all passes, when the chosen text alone has none.
export function dateFromPasses(draft:ReturnType<typeof parseReceipt>,result:OcrResult){
 draft=constrainReceiptToPriceColumn(draft,result.rows);
 draft={...draft,warnings:[...new Set([...(draft.warnings||[]),...(result.warnings||[])])]};
 const uncertain=new Set(result.uncertainItems?.map(l=>normalize(l.label)+'|'+l.amount));
 draft.lines=draft.lines.map(l=>uncertain.has(normalize(l.label)+'|'+l.amount)?{...l,nameReviewRequired:true,warnings:[...(l.warnings||[]),'OCR readings disagree on this name. Check the receipt.']}:l);
 if(!result.dateText)return draft;
 const evidence=ocrDateEvidence(result.dateText,draft.country,draft.store);
 return evidence.candidates.length?{...draft,date:evidence.date,dateEvidence:evidence}:draft;
}
