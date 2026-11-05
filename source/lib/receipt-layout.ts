// Rebuild receipt rows from Tesseract word boxes. Prices are printed far right of the
// name, so Tesseract's own line/text output often splits them off or files them under
// the wrong row. Grouping by position keeps "Name   Price" together.
type WordBounds={x0:number;y0:number;x1:number;y1:number};
export type OcrWord={text:string;bbox:WordBounds;confidence?:number;symbols?:{text:string;bbox:WordBounds}[]};
export type OcrRow={text:string;bbox:WordBounds;confidence:number;words:OcrWord[]};
type Box={text:string;x0:number;x1:number;cx:number;cy:number;level:number};
export const blockWords=(blocks:{paragraphs:{lines:{words:OcrWord[]}[]}[]}[]|null|undefined)=>(blocks||[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.flatMap(l=>l.words)));
const median=(values:number[])=>{const s=[...values].sort((a,b)=>a-b);return s.length?s[s.length>>1]:0};

// Tilt (dy per dx) from neighbouring words of the same row: gap under two characters.
function estimateSlope(boxes:Box[],charWidth:number,height:number){
 const slopes:number[]=[];
 for(const a of boxes)for(const b of boxes)if(b.x0>a.x1&&b.x0-a.x1<2*charWidth&&Math.abs(b.cy-a.cy)<height/2)slopes.push((b.cy-a.cy)/(b.cx-a.cx));
 return Math.max(-.1,Math.min(.1,median(slopes)));
}

// Words with a gap wider than ~2.5 characters are joined with three spaces, which the
// parser reads as separate print columns (name, flags, price).
export function wordsToRows(words:OcrWord[],slope?:number):OcrRow[]{
 // A widely separated last "8" in a three-decimal token can be the VAT flag B.
 // Keep genuine three-decimal fuel prices intact: separation needs symbol geometry.
 const raw=words.filter(w=>w.text.trim()).map(w=>{
  const symbols=w.symbols||[],last=symbols.at(-1),prev=symbols.at(-2);
  const widths=symbols.filter(s=>/\d/.test(s.text)).map(s=>s.bbox.x1-s.bbox.x0);
  const text=w.text.replace(/^[„'"]+(?=-?[$€]?\d+[.,]\d{2,3}$)/,'');
  return last&&prev&&/^[„'"$€-]*\d+[.,]\d{3}$/.test(w.text)&&w.text.endsWith('8')&&last.bbox.x0-prev.bbox.x1>median(widths)*.6?{...w,text:text.slice(0,-1)+' B'}:{...w,text};
 });if(!raw.length)return [];
 const charWidth=median(raw.map(w=>(w.bbox.x1-w.bbox.x0)/w.text.trim().length)),height=median(raw.map(w=>w.bbox.y1-w.bbox.y0));
 const boxes:Box[]=raw.map(w=>({text:w.text.trim(),x0:w.bbox.x0,x1:w.bbox.x1,cx:(w.bbox.x0+w.bbox.x1)/2,cy:(w.bbox.y0+w.bbox.y1)/2,level:0}));
 const s=slope??estimateSlope(boxes,charWidth,height);
 for(const b of boxes)b.level=b.cy-s*b.cx;
 const rows:{level:number;boxes:Box[]}[]=[];
 for(const b of [...boxes].sort((a,b)=>a.level-b.level)){
  const row=rows[rows.length-1];
  if(row&&Math.abs(b.level-row.level)<height/2){row.boxes.push(b);row.level+=(b.level-row.level)/row.boxes.length}else rows.push({level:b.level,boxes:[b]});
 }
 return rows.sort((a,b)=>a.level-b.level).map(row=>{
  const ordered=row.boxes.sort((a,b)=>a.x0-b.x0),members=ordered.map(b=>raw[boxes.indexOf(b)]);
  return {text:ordered.map((b,i,all)=>(i&&b.x0-all[i-1].x1>2.5*charWidth?'   ':i?' ':'')+b.text).join(''),bbox:{x0:Math.min(...members.map(w=>w.bbox.x0)),y0:Math.min(...members.map(w=>w.bbox.y0)),x1:Math.max(...members.map(w=>w.bbox.x1)),y1:Math.max(...members.map(w=>w.bbox.y1))},confidence:members.reduce((s,w)=>s+(w.confidence??0),0)/members.length,words:members};
 });
}
export const wordsToLines=(words:OcrWord[],slope?:number)=>wordsToRows(words,slope).map(r=>r.text);
