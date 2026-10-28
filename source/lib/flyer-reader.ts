/**
 * Browser-only flyer reader. Neither PDFs, images nor raw OCR text are uploaded.
 * PDF.js is fetched only if the user selects a PDF (Apache 2.0).
 * Tesseract is the same local-on-device recognizer already used for receipts.
 */
import {extractFlyerCandidates} from './flyer-prices';
import {FLYER_PAGE_MARKER,FLYER_OCR_MARKER} from './flyer-text-review';
import {PAGES_BUILD} from './hosting';
const PDF_JS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
const PDF_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
export type FlyerReaderProgress=(label:string)=>void;
export const MAX_FLYER_PDF=25*1024*1024;
export const MAX_FLYER_IMAGE=12*1024*1024;
export const MAX_FLYER_PAGES=8;
function imageFile(file:Pick<File,'type'|'name'>){
 return /^image\/(?:jpeg|png|webp)$/.test(file.type)||/\.(?:jpe?g|png|webp)$/i.test(file.name);
}
function pdfFile(file:Pick<File,'type'|'name'>){
 return file.type==='application/pdf'||/\.pdf$/i.test(file.name);
}
async function ocrWorker(){
 const {createWorker,PSM}=await import('tesseract.js');
 const options=PAGES_BUILD?
  {workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
   corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',
   langPath:'https://tessdata.projectnaptha.com/4.0.0',workerBlobURL:true}:
  {workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',
   langPath:'https://tessdata.projectnaptha.com/4.0.0',workerBlobURL:false};
 const worker=await createWorker(['deu','eng'],1,options);
 await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,preserve_interword_spaces:'1'});
 return worker;
}
async function boundedImage(file:File):Promise<HTMLCanvasElement>{
 const objectUrl=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=objectUrl;await img.decode();
  if(!img.naturalWidth||!img.naturalHeight)throw new Error('Image has no dimensions.');
  const scale=Math.min(1,1850/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas is not available.');
  ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return canvas;
 }finally{URL.revokeObjectURL(objectUrl)}
}
function textLines(content:any):string[]{
 const items=(content.items||[]).filter((i:any)=>typeof i.str==='string'&&i.str.trim());
 const rows=new Map<number,Array<{x:number;s:string}>>();
 for(const item of items){
  const y=Math.round(Number(item.transform?.[5]||0)/3)*3;
  if(!rows.has(y))rows.set(y,[]);
  rows.get(y)!.push({x:Number(item.transform?.[4]||0),s:item.str.trim()});
 }
 return [...rows.entries()].sort((a,b)=>b[0]-a[0])
   .flatMap(([,parts])=>{
    const sorted=parts.sort((a,b)=>a.x-b.x);
    return sorted.length? [sorted.map(p=>p.s).join(' ')]:[];
   });
}
/**
 * File validation without loading the bytes. An ordinary 16 MB REWE PDF is
 * accepted; image uploads remain limited to 12 MB to protect mobile memory.
 */
export function flyerFileError(file:Pick<File,'size'|'name'|'type'>|null):string|null{
 if(!file||!Number.isFinite(file.size)||file.size<=0)return 'Choose a non-empty flyer file.';
 if(pdfFile(file))return file.size>MAX_FLYER_PDF?'Choose a PDF no larger than 25 MB.':null;
 if(imageFile(file))return file.size>MAX_FLYER_IMAGE?'Choose a photo no larger than 12 MB.':null;
 return 'Only PDF, JPG, PNG and WebP are supported.';
}
export async function readFlyerFile(file:File,progress:FlyerReaderProgress=()=>{},startPage=1):Promise<{text:string;pages:number;usedOcr:boolean;pageRange:string}>{
 const fileError=flyerFileError(file);
 if(fileError)throw new Error(fileError);
 let worker:any=null,document:any=null;
 async function recognize(canvas:HTMLCanvasElement){
  if(!worker)worker=await ocrWorker();
  const result=await worker.recognize(canvas);
  return String(result?.data?.text||'');
 }
 try{
  if(imageFile(file)){
   progress('Recognizing flyer photo on this device…');
   const canvas=await boundedImage(file);
   const text=await recognize(canvas);
   canvas.width=0;canvas.height=0;
   return {text:(FLYER_PAGE_MARKER(1)+'\n'+FLYER_OCR_MARKER+'\n'+text).slice(0,65000),pages:1,usedOcr:true,pageRange:'1'};
  }
  progress('Reading PDF text locally…');
  // Runtime URL avoids bundling a second heavy PDF parser into the Basket shell.
  const url:string=PDF_JS;
  const pdfjs:any=await import(/* @vite-ignore */ url);
  pdfjs.GlobalWorkerOptions.workerSrc=PDF_WORKER;
  const data=new Uint8Array(await file.arrayBuffer());
  const task=pdfjs.getDocument({data,isEvalSupported:false,useSystemFonts:true});
  document=await task.promise;
  if(!Number.isInteger(startPage)||startPage<1||startPage>document.numPages)throw new Error('Choose a PDF starting page between 1 and '+document.numPages+'.');
  const lastPage=Math.min(document.numPages,startPage+MAX_FLYER_PAGES-1);
  const lines:string[]=[];let usedOcr=false;
  for(let n=startPage;n<=lastPage;n++){
   progress('Reading PDF page '+n+' of '+document.numPages+'…');
   const page=await document.getPage(n);
   const textContent=await page.getTextContent();
   let pageText=textLines(textContent).join('\n');
   // If pages are image-based or yields no product/price pairs, OCR that page.
   if(pageText.length<100||!extractFlyerCandidates(pageText).length){
    progress('Recognizing printed text on PDF page '+n+'…');
    const v=page.getViewport({scale:1});
    const scale=Math.min(2,1600/Math.max(v.width,v.height));
    const viewport=page.getViewport({scale});
    const canvas=documentCreateCanvas(viewport.width,viewport.height);
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Cannot render the PDF page.');
    await page.render({canvasContext:ctx,viewport}).promise;
    pageText+='\n'+FLYER_OCR_MARKER+'\n'+await recognize(canvas);
    canvas.width=0;canvas.height=0;usedOcr=true;
   }
   lines.push(FLYER_PAGE_MARKER(n)+'\n'+pageText.slice(0,16000));
   page.cleanup();
  }
  return {text:lines.join('\n').slice(0,65000),pages:document.numPages,usedOcr,pageRange:startPage===lastPage?String(startPage):startPage+'–'+lastPage};
 }finally{
  try{await worker?.terminate()}catch{}
  try{await document?.destroy()}catch{}
 }
}
function documentCreateCanvas(width:number,height:number):HTMLCanvasElement{
 const canvas=globalThis.document.createElement('canvas');
 canvas.width=Math.max(1,Math.ceil(width));canvas.height=Math.max(1,Math.ceil(height));
 return canvas;
}
