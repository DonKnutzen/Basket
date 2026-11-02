// Receipt photo preprocessing for Tesseract, as pure functions on pixel arrays:
// cut the paper out of the background, scale it to ~1400 px width, level a slight
// tilt and binarize locally so shadows and folds do not swallow the print.
export type Gray={data:Uint8Array;width:number;height:number};
export type Bounds={x:number;y:number;width:number;height:number};

export function toGray(rgba:ArrayLike<number>,width:number,height:number):Gray{
 const data=new Uint8Array(width*height);
 for(let i=0;i<data.length;i++)data[i]=Math.round(.299*rgba[i*4]+.587*rgba[i*4+1]+.114*rgba[i*4+2]);
 return {data,width,height};
}

export function otsuThreshold(values:ArrayLike<number>){
 const hist=new Array(256).fill(0);for(let i=0;i<values.length;i++)hist[Math.max(0,Math.min(255,Math.round(values[i])))]++;
 let sum=0;for(let v=0;v<256;v++)sum+=v*hist[v];
 let below=0,belowSum=0,best=0,threshold=0;
 for(let v=0;v<256;v++){below+=hist[v];belowSum+=v*hist[v];const above=values.length-below;if(!below||!above)continue;
  const between=below*above*(belowSum/below-(sum-belowSum)/above)**2;if(between>best){best=between;threshold=v}}
 return threshold;
}

// Paper is the largest bright and colourless area: min(r,g,b) stays high on white paper
// but drops on wood, skin and shadows. Falls back to the whole photo.
export function findReceiptBounds(rgba:ArrayLike<number>,width:number,height:number):Bounds{
 const full={x:0,y:0,width,height},cell=Math.max(2,Math.round(Math.max(width,height)/100)),gw=Math.ceil(width/cell),gh=Math.ceil(height/cell);
 const values=new Float64Array(gw*gh),counts=new Uint32Array(gw*gh);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,c=Math.floor(y/cell)*gw+Math.floor(x/cell);values[c]+=Math.min(rgba[i],rgba[i+1],rgba[i+2]);counts[c]++}
 for(let c=0;c<values.length;c++)values[c]/=counts[c];
 const threshold=otsuThreshold(values),seen=new Uint8Array(values.length);
 let best:number[]=[];
 for(let start=0;start<values.length;start++){if(seen[start]||values[start]<=threshold)continue;
  const component=[start],stack=[start];seen[start]=1;
  while(stack.length){const c=stack.pop()!,cx=c%gw,cy=(c-cx)/gw;
   for(const [nx,ny] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]])if(nx>=0&&ny>=0&&nx<gw&&ny<gh){const n=ny*gw+nx;if(!seen[n]&&values[n]>threshold){seen[n]=1;stack.push(n);component.push(n)}}}
  if(component.length>best.length)best=component;
 }
 if(best.length<values.length*.1||best.length>values.length*.9)return full;
 let x0=gw,y0=gh,x1=0,y1=0;for(const c of best){const cx=c%gw,cy=(c-cx)/gw;x0=Math.min(x0,cx);y0=Math.min(y0,cy);x1=Math.max(x1,cx);y1=Math.max(y1,cy)}
 const x=Math.max(0,(x0-1)*cell),y=Math.max(0,(y0-1)*cell);
 return {x,y,width:Math.min(width,(x1+2)*cell)-x,height:Math.min(height,(y1+2)*cell)-y};
}

// Tesseract reads receipt print best at ~1400 px paper width. Very long receipts are
// reduced to stay under the iOS canvas limit, but never below 1000 px width.
export function ocrScale(cropWidth:number,cropHeight:number){
 const target=1400/cropWidth,capped=Math.sqrt(12e6/(cropWidth*cropHeight));
 return Math.max(Math.min(target,capped),1000/cropWidth);
}

// Tilt in degrees (rows descending to the right are positive): the angle at which dark
// pixels project onto the sharpest row profile. rotate(img,-angle) levels the rows.
export function estimateSkew(img:Gray){
 const {data,width,height}=img,threshold=otsuThreshold(data),step=Math.max(1,Math.round(Math.sqrt(width*height/250000)));
 const xs:number[]=[],ys:number[]=[];
 for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step)if(data[y*width+x]<=threshold){xs.push(x-width/2);ys.push(y)}
 if(!xs.length)return 0;
 const score=(degrees:number)=>{const t=Math.tan(degrees*Math.PI/180),offset=width,bins=new Float64Array(height+2*offset);
  for(let i=0;i<xs.length;i++){const b=Math.round(ys[i]-xs[i]*t)+offset;if(b>=0&&b<bins.length)bins[b]++}
  let s=0;for(const v of bins)s+=v*v;return s};
 let best=0,bestScore=score(0);
 for(let a=-6;a<=6;a+=.5){const s=score(a);if(s>bestScore){bestScore=s;best=a}}
 const coarse=best;for(let a=coarse-.4;a<=coarse+.4;a+=.1){const s=score(a);if(s>bestScore){bestScore=s;best=a}}
 return Math.round(best*10)/10;
}

export function rotate(img:Gray,degrees:number):Gray{
 const {data,width,height}=img,a=degrees*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a),cx=width/2,cy=height/2,out=new Uint8Array(width*height).fill(255);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const dx=x-cx,dy=y-cy,sx=Math.round(cx+dx*cos+dy*sin),sy=Math.round(cy-dx*sin+dy*cos);
  if(sx>=0&&sy>=0&&sx<width&&sy<height)out[y*width+x]=data[sy*width+sx]}
 return {data:out,width,height};
}

// Box average when shrinking, bilinear when enlarging.
export function cropScale(img:Gray,b:Bounds,scale:number):Gray{
 const width=Math.max(1,Math.round(b.width*scale)),height=Math.max(1,Math.round(b.height*scale)),out=new Uint8Array(width*height),{data,width:w}=img;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(scale<1){const sx0=b.x+Math.floor(x/scale),sy0=b.y+Math.floor(y/scale),sx1=Math.max(sx0+1,Math.min(b.x+b.width,b.x+Math.floor((x+1)/scale))),sy1=Math.max(sy0+1,Math.min(b.y+b.height,b.y+Math.floor((y+1)/scale)));
   let s=0,n=0;for(let sy=sy0;sy<sy1;sy++)for(let sx=sx0;sx<sx1;sx++){s+=data[sy*w+sx];n++}out[y*width+x]=Math.round(s/n)}
  else{const fx=Math.min(b.width-1,Math.max(0,(x+.5)/scale-.5)),fy=Math.min(b.height-1,Math.max(0,(y+.5)/scale-.5)),x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(b.width-1,x0+1),y1=Math.min(b.height-1,y0+1),wx=fx-x0,wy=fy-y0,at=(px:number,py:number)=>data[(b.y+py)*w+b.x+px];
   out[y*width+x]=Math.round((at(x0,y0)*(1-wx)+at(x1,y0)*wx)*(1-wy)+(at(x0,y1)*(1-wx)+at(x1,y1)*wx)*wy)}}
 return {data:out,width,height};
}

// Pipeline: crop → scale → contrast → deskew. On a real Superstore photo Tesseract read
// this grayscale image better than a binarized one, so binarize() is the second attempt.
export function prepareForOcr(rgba:ArrayLike<number>,width:number,height:number){
 const bounds=findReceiptBounds(rgba,width,height);
 let img=cropScale(toGray(rgba,width,height),bounds,ocrScale(bounds.width,bounds.height));
 for(let i=0;i<img.data.length;i++)img.data[i]=Math.max(0,Math.min(255,Math.round((img.data[i]-128)*1.15+128)));
 const angle=estimateSkew(img);if(Math.abs(angle)>=.3)img=rotate(img,-angle);
 return {image:img,bounds,angle};
}
// For shadows and folds: Sauvola with a window of about two text lines.
export const binarize=(img:Gray)=>sauvola(img,Math.round(img.width/16)|1);
export function grayToRgba(img:Gray){const out=new Uint8ClampedArray(img.data.length*4);for(let i=0;i<img.data.length;i++){out[i*4]=out[i*4+1]=out[i*4+2]=img.data[i];out[i*4+3]=255}return out}

// Sauvola: threshold = mean·(1 + k·(sd/128 − 1)) over a local window. Statistics come
// from tiles of a third of the window and are interpolated, which keeps memory small
// enough for long receipts on phones.
export function sauvola(img:Gray,window:number,k=.2):Gray{
 const {data,width,height}=img,tile=Math.max(2,Math.round(window/3)),tw=Math.ceil(width/tile),th=Math.ceil(height/tile);
 const sum=new Float64Array(tw*th),sq=new Float64Array(tw*th),count=new Float64Array(tw*th);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const v=data[y*width+x],t=Math.floor(y/tile)*tw+Math.floor(x/tile);sum[t]+=v;sq[t]+=v*v;count[t]++}
 const thresholds=new Float64Array(tw*th);
 for(let ty=0;ty<th;ty++)for(let tx=0;tx<tw;tx++){let s=0,q=0,n=0;
  for(let y=Math.max(0,ty-1);y<=Math.min(th-1,ty+1);y++)for(let x=Math.max(0,tx-1);x<=Math.min(tw-1,tx+1);x++){const t=y*tw+x;s+=sum[t];q+=sq[t];n+=count[t]}
  const mean=s/n,sd=Math.sqrt(Math.max(0,q/n-mean*mean));thresholds[ty*tw+tx]=mean*(1+k*(sd/128-1))}
 const out=new Uint8Array(width*height);
 for(let y=0;y<height;y++){const fy=Math.max(0,Math.min(th-1,(y+.5)/tile-.5)),y0=Math.floor(fy),y1=Math.min(th-1,y0+1),wy=fy-y0;
  for(let x=0;x<width;x++){const fx=Math.max(0,Math.min(tw-1,(x+.5)/tile-.5)),x0=Math.floor(fx),x1=Math.min(tw-1,x0+1),wx=fx-x0;
   const t=(thresholds[y0*tw+x0]*(1-wx)+thresholds[y0*tw+x1]*wx)*(1-wy)+(thresholds[y1*tw+x0]*(1-wx)+thresholds[y1*tw+x1]*wx)*wy;
   out[y*width+x]=data[y*width+x]<=t?0:255}}
 return {data:out,width,height};
}
