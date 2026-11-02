import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toGray,otsuThreshold,findReceiptBounds,ocrScale,estimateSkew,rotate,sauvola,type Gray} from '../lib/receipt-image';

function rgbaImage(width:number,height:number,pixel:(x:number,y:number)=>[number,number,number]){
 const data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const [r,g,b]=pixel(x,y),i=(y*width+x)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255}
 return data;
}
function grayImage(width:number,height:number,value:(x:number,y:number)=>number):Gray{
 const data=new Uint8Array(width*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++)data[y*width+x]=value(x,y);return {data,width,height};
}
// Receipt-like rows of "text": dark bars 6px high every 24px, broken into words.
const textRow=(x:number,y:number)=>y%24<6&&x%40<30;

test('grayscale uses luminance',()=>{
 const g=toGray(rgbaImage(3,1,x=>x===0?[255,0,0]:x===1?[0,255,0]:[255,255,255]),3,1);
 assert.deepEqual([...g.data],[76,150,255]);
});

test('Otsu separates two brightness groups',()=>{
 const t=otsuThreshold([...Array(100).fill(40),...Array(100).fill(200)]);
 assert.ok(t>=40&&t<200,String(t));
});

test('the white receipt is cut out of a wooden table and a hand',()=>{
 // Beige table, skin-coloured thumb top right, white paper with text in the middle.
 const rgba=rgbaImage(300,400,(x,y)=>x>=100&&x<200&&y>=50&&y<350?(textRow(x-100,y-50)&&x>110&&x<190?[40,40,40]:[238,236,232]):x>240&&y<120?[225,170,140]:[205,175,130]);
 const b=findReceiptBounds(rgba,300,400);
 assert.ok(Math.abs(b.x-100)<=8&&Math.abs(b.y-50)<=8,JSON.stringify(b));
 assert.ok(Math.abs(b.x+b.width-200)<=8&&Math.abs(b.y+b.height-350)<=8,JSON.stringify(b));
});

test('without a clear paper area the whole photo is used',()=>{
 const rgba=rgbaImage(200,200,()=>[240,240,240]);
 assert.deepEqual(findReceiptBounds(rgba,200,200),{x:0,y:0,width:200,height:200});
});

test('OCR scale brings the receipt to about 1000–1600 px width',()=>{
 assert.equal(Math.round(500*ocrScale(500,1500)),1400);
 assert.equal(Math.round(3000*ocrScale(3000,6000)),1400);
 const long=ocrScale(1400,20000);assert.ok(1400*long*20000*long<=16e6&&1400*long>=999,String(long));
});

test('skew is measured and removed',()=>{
 const tilt=3*Math.PI/180;
 const img=grayImage(600,400,(x,y)=>{const level=y-(x-300)*Math.tan(tilt);return x>40&&x<560&&level>40&&level<360&&textRow(x,Math.round(level))?30:235});
 const angle=estimateSkew(img);
 assert.ok(Math.abs(angle-3)<=0.3,String(angle));
 assert.ok(Math.abs(estimateSkew(rotate(img,-angle)))<=0.3);
 assert.ok(Math.abs(estimateSkew(grayImage(600,400,(x,y)=>textRow(x,y)?30:235)))<=0.3);
});

test('local binarization keeps text readable inside a shadow',()=>{
 // Paper brightness falls from 235 to 110 (shadow of the phone); text is 70 darker than its paper.
 const paper=(x:number)=>235-125*x/599;
 const img=grayImage(600,240,(x,y)=>Math.round(textRow(x,y)?paper(x)-70:paper(x)));
 const isText=(i:number)=>textRow(i%600,Math.floor(i/600));
 const global=otsuThreshold(img.data);
 const globalErrors=[...img.data].filter((v,i)=>(v<=global)!==isText(i)).length;
 const out=sauvola(img,31);
 const errors=[...out.data].filter((v,i)=>(v===0)!==isText(i)).length;
 assert.ok(globalErrors>img.data.length*0.1,'a global threshold must fail here: '+globalErrors);
 assert.ok(errors<img.data.length*0.02,'local threshold errors: '+errors);
});
