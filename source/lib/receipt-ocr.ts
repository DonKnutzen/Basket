// Which Tesseract passes read a receipt photo, independent of browser canvases so the
// same steps run in tests on real photos.
import {binarize,cropScale,type Gray} from './receipt-image';
import {wordsToLines,blockWords} from './receipt-layout';
import {parseReceipt,difference} from './receipt-parser';
import {receiptDate} from './receipt-date';

type Recognized={data:{text:string;confidence:number;blocks?:Parameters<typeof blockWords>[0]}};
export type OcrWorker={setParameters(params:Record<string,string>):Promise<unknown>;recognize(image:never,options?:object,output?:object):Promise<Recognized>};
export type OcrResult={text:string;confidence:number;dateText?:string};
const SINGLE_COLUMN='4',SINGLE_BLOCK='6';

// Balanced receipts win; a printed total alone beats none; then OCR confidence.
const quality=(o:OcrResult)=>{const p=parseReceipt(o.text);return (p.total?difference(p)===0?2:1:0)*1000+o.confidence};

// bandBudget caps the date re-reads (ms): a slow phone then asks for the date instead of
// running into the scanner's overall timeout.
export async function readReceiptPhoto<I>(worker:OcrWorker,prepared:Gray,toImage:(img:Gray)=>I,alive:()=>boolean=()=>true,bandBudget=45000):Promise<OcrResult|null>{
 const recognize=(img:Gray,output?:object)=>worker.recognize(toImage(img) as never,{},output);
 // SINGLE_COLUMN read a real Superstore photo far better than SINGLE_BLOCK (82 vs 50 % confidence).
 // Rows are rebuilt from word boxes so right-aligned prices stay with their names.
 await worker.setParameters({tessedit_pageseg_mode:SINGLE_COLUMN,preserve_interword_spaces:'1'});
 const read=async(img:Gray)=>{const r=await recognize(img,{text:true,blocks:true});const lines=wordsToLines(blockWords(r.data.blocks));return {text:lines.length?lines.join('\n'):r.data.text,confidence:r.data.confidence}};
 const texts:string[]=[];
 let best=await read(prepared);texts.push(best.text);
 // Shadows and folds: a second attempt on a locally binarized copy, then the same copy read as
 // one block, which balanced real Superstore and Uprooted photos that SINGLE_COLUMN left short.
 const binarized=quality(best)<2000&&alive()?binarize(prepared):null;
 for(const mode of binarized?[SINGLE_COLUMN,SINGLE_BLOCK]:[]){if(quality(best)>=2000||!alive())break;
  if(mode===SINGLE_BLOCK)await worker.setParameters({tessedit_pageseg_mode:SINGLE_BLOCK});
  const next=await read(binarized!);texts.push(next.text);if(quality(next)>quality(best))best=next}
 if(!alive())return null;
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
