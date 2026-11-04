// Which Tesseract passes read a receipt photo, independent of browser canvases so the
// same steps run in tests on real photos.
import {binarize,cropScale,type Gray} from './receipt-image';
import {wordsToLines,blockWords} from './receipt-layout';
import {parseReceipt,difference} from './receipt-parser';
import {receiptDate} from './receipt-date';
import {toCents} from './types';

type Recognized={data:{text:string;confidence:number;blocks?:Parameters<typeof blockWords>[0]}};
export type OcrWorker={setParameters(params:Record<string,string>):Promise<unknown>;recognize(image:never,options?:object,output?:object):Promise<Recognized>};
export type OcrResult={text:string;confidence:number;dateText?:string};
const SINGLE_COLUMN='4',SINGLE_BLOCK='6',AUTO='3',SPARSE='11';

// Balanced receipts win; a printed total alone beats none; then OCR confidence.
const quality=(o:OcrResult)=>{const p=parseReceipt(o.text);return (p.total?difference(p)===0?2:1:0)*1000+o.confidence};

// bandBudget caps the date re-reads (ms): a slow phone then asks for the date instead of
// running into the scanner's overall timeout. passBudget does the same for the extra layout passes.
export async function readReceiptPhoto<I>(worker:OcrWorker,prepared:Gray,toImage:(img:Gray)=>I,alive:()=>boolean=()=>true,bandBudget=45000,passBudget=50000):Promise<OcrResult|null>{
 const recognize=(img:Gray,output?:object)=>worker.recognize(toImage(img) as never,{},output);
 // SINGLE_COLUMN read a real Superstore photo far better than SINGLE_BLOCK (82 vs 50 % confidence).
 // Rows are rebuilt from word boxes so right-aligned prices stay with their names.
 await worker.setParameters({tessedit_pageseg_mode:SINGLE_COLUMN,preserve_interword_spaces:'1'});
 const read=async(img:Gray)=>{const r=await recognize(img,{text:true,blocks:true});const lines=wordsToLines(blockWords(r.data.blocks));return {text:lines.length?lines.join('\n'):r.data.text,confidence:r.data.confidence}};
 const texts:string[]=[];
 let best=await read(prepared);texts.push(best.text);const reads=[best];
 // Shadows and folds: a second attempt on a locally binarized copy, then the same copy read as
 // one block, which balanced real Superstore and Uprooted photos that SINGLE_COLUMN left short.
 // A famila photo kept only the names in SINGLE_COLUMN (the price column vanished) and lost "Summe" as one
 // block; automatic layout read every price and sparse text the total, so those come last, within passBudget.
 const started=Date.now(),binarized=quality(best)<2000&&alive()?binarize(prepared):null;
 const passes:[()=>Gray,string][]=[[()=>binarized!,SINGLE_COLUMN],[()=>binarized!,SINGLE_BLOCK],[()=>prepared,AUTO],[()=>prepared,SPARSE],[()=>binarized!,SPARSE]];
 for(const [i,[image,mode]] of (binarized?passes:[]).entries()){if(quality(best)>=2000||!alive()||i>=2&&Date.now()-started>passBudget)break;
  await worker.setParameters({tessedit_pageseg_mode:mode});
  const next=await read(image());texts.push(next.text);reads.push(next);if(quality(next)>quality(best))best=next}
 if(!alive())return null;
 // One pass may read every item but lose the total line while another reads the total but drops a row
 // (famila tilted 3°: all ten items as one block, "Summe 23,68" only in single-column mode). A total
 // printed in one pass that equals another pass's item sum to the cent completes that pass.
 if(quality(best)<2000){const totals=new Set(reads.map(r=>parseReceipt(r.text).total).filter(Boolean));
  for(const r of reads){const d=parseReceipt(r.text),sum=d.lines.reduce((s,l)=>s+toCents(l.amount),0)+toCents(d.tax||'0'),total=(sum/100).toFixed(2);
   if(d.lines.length>1&&d.total!==total&&totals.has(total)){const merged={text:r.text+'\nTotal   '+total,confidence:r.confidence};if(quality(merged)>=2000){best=merged;break}}}}
 const p=parseReceipt(best.text);
 if(p.dateEvidence?.status==='recognized')return best;
 // SINGLE_COLUMN can drop the date row entirely (Kaufland: "Datum:02.11.26"), and Tesseract's
 // global threshold loses it on unevenly lit paper (Shell: "DATE: 2026/10/31"). Overlapping
 // bands read on their own find it; two band heights because each missed one of those photos.
 await worker.setParameters({tessedit_pageseg_mode:SINGLE_BLOCK});
 const until=Date.now()+bandBudget;
 for(const share of [.2,.3]){const height=Math.round(prepared.width*share);
  for(let y=0;prepared.height-y>=height/3&&Date.now()<until;y+=Math.round(height/2)){if(!alive())return null;
   texts.push((await recognize(cropScale(prepared,{x:0,y,width:prepared.width,height:Math.min(height,prepared.height-y)},1))).data.text)}
  if(receiptDate(texts.join('\n'),p.country,p.store).status==='recognized')break;
 }
 return {...best,dateText:texts.join('\n')};
}

// The purchase date from all passes, when the chosen text alone has none.
export function dateFromPasses(draft:ReturnType<typeof parseReceipt>,result:OcrResult){
 if(!result.dateText||draft.dateEvidence?.status==='recognized')return draft;
 const evidence=receiptDate(result.dateText,draft.country,draft.store);
 return evidence.candidates.length?{...draft,date:evidence.date,dateEvidence:evidence}:draft;
}
