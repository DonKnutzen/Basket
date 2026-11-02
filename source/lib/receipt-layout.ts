// Rebuild receipt rows from Tesseract word boxes. Prices are printed far right of the
// name, so Tesseract's own line/text output often splits them off or files them under
// the wrong row. Grouping by position keeps "Name   Price" together.
export type OcrWord={text:string;bbox:{x0:number;y0:number;x1:number;y1:number};confidence?:number};
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
export function wordsToLines(words:OcrWord[],slope?:number):string[]{
 const raw=words.filter(w=>w.text.trim());if(!raw.length)return [];
 const charWidth=median(raw.map(w=>(w.bbox.x1-w.bbox.x0)/w.text.trim().length)),height=median(raw.map(w=>w.bbox.y1-w.bbox.y0));
 const boxes:Box[]=raw.map(w=>({text:w.text.trim(),x0:w.bbox.x0,x1:w.bbox.x1,cx:(w.bbox.x0+w.bbox.x1)/2,cy:(w.bbox.y0+w.bbox.y1)/2,level:0}));
 const s=slope??estimateSlope(boxes,charWidth,height);
 for(const b of boxes)b.level=b.cy-s*b.cx;
 const rows:{level:number;boxes:Box[]}[]=[];
 for(const b of [...boxes].sort((a,b)=>a.level-b.level)){
  const row=rows[rows.length-1];
  if(row&&Math.abs(b.level-row.level)<height/2){row.boxes.push(b);row.level+=(b.level-row.level)/row.boxes.length}else rows.push({level:b.level,boxes:[b]});
 }
 return rows.sort((a,b)=>a.level-b.level).map(row=>row.boxes.sort((a,b)=>a.x0-b.x0).map((b,i,all)=>(i&&b.x0-all[i-1].x1>2.5*charWidth?'   ':i?' ':'')+b.text).join(''));
}
