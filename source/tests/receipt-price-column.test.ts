import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeReceiptReads,receiptReadQuality,type ReceiptRead} from '../lib/receipt-merge';
import {findPriceColumn,printedAmounts,inPriceColumn} from '../lib/receipt-price-column';
import {parseReceipt,difference} from '../lib/receipt-parser';
import {dateFromPasses} from '../lib/receipt-ocr';
import type {OcrRow,OcrWord} from '../lib/receipt-layout';

function row(label:string,amount:string,y:number,priceX=800,nameY=y):OcrRow{
 let x=80;
 const words:OcrWord[]=label.split(' ').map(text=>{const w={text,confidence:95,bbox:{x0:x,x1:x+text.length*12,y0:nameY,y1:nameY+30}};x=w.bbox.x1+12;return w});
 words.push({text:amount,confidence:95,bbox:{x0:priceX,x1:priceX+100,y0:y,y1:y+30}});
 return {text:label+'   '+amount,words,confidence:95,bbox:{x0:80,x1:priceX+100,y0:Math.min(y,nameY),y1:Math.max(y,nameY)+30}};
}
const read=(rows:OcrRow[]):ReceiptRead=>({text:'REWE\n05.11.2026\n'+rows.map(r=>r.text).join('\n'),rows:[{text:'REWE',words:[],confidence:95,bbox:{x0:80,x1:200,y0:10,y1:40}},{text:'05.11.2026',words:[],confidence:95,bbox:{x0:80,x1:250,y0:50,y1:80}},...rows],confidence:95});

test('screenshot regression: left unit prices are not extra purchased positions',()=>{
 const r=read([row('MILCH','1,39',100),row('NACHO CHEESE','1,19',150),row('RB ENERGY','5,49',200),row('PFAND 0,08 EUR','0,08',250),row('LEERGUT EINWEG','-1,25',300),row('5 Sk','0,25',340,450),row('5 Stk','0,15',360,450),row('SUMME','6,90',400)]);
 const old=parseReceipt(r.text);assert.ok(old.lines.some(l=>l.label==='5 Sk'));
 const d=dateFromPasses(old,r);
 assert.equal(d.lines.length,5);assert.equal(difference(d),0);
 assert.ok(!d.lines.some(l=>l.label==='5 Sk'));
 const merged=mergeReceiptReads([r,r]);assert.ok(merged);
 assert.equal(parseReceipt(merged.text).lines.length,5);assert.equal(difference(parseReceipt(merged.text)),0);
});

test('screenshot regression: distorted names cannot duplicate one right-hand 1.19 price',()=>{
 const a=read([row('MILCH','1,39',100),row('Unreadable','1,19',150,800,110),row('RB ENERGY','5,49',200),row('SUMME','8,07',300)]);
 a.rows![3].words.filter(w=>w.text==='Unreadable').forEach(w=>w.confidence=15);
 const b=read([row('MILCH','1,39',100),row('NACHO CHEESE','1,19',150),row('RB ENERGY','5,49',200),row('SUMME','8,07',300)]);
 const m=mergeReceiptReads([a,b]);assert.ok(m);
 const d=parseReceipt(m.text);
 assert.equal(d.lines.filter(l=>l.amount==='1.19').length,1);
 assert.equal(d.lines.length,3);assert.equal(difference(d),0);
 assert.equal(d.lines.find(l=>l.amount==='1.19')?.label,'NACHO CHEESE');
});

test('a left-side denomination must not replace an unread right-hand amount just to balance',()=>{
 const r=read([row('MILCH','1,39',100),row('RB ENERGY','5,49',200),row('5 Sk','0,25',250,450),row('SUMME','7,13',300)]);
 assert.equal(difference(parseReceipt(r.text)),0);
 const q=receiptReadQuality(r);assert.equal(q.complete,false);assert.equal(difference(q.draft),25);
});

test('same-price real products on separate right-hand rows remain separate',()=>{
 const r=read([row('RB ENERGY','5,49',100),row('RB ENERGY','5,49',150),row('MILCH','1,39',200),row('SUMME','12,37',300)]);
 const m=mergeReceiptReads([r,r]);assert.ok(m);
 const d=parseReceipt(m.text);assert.equal(d.lines.length,3);assert.equal(d.lines.filter(l=>l.amount==='5.49').length,2);assert.equal(difference(d),0);
});

test('left quantities still annotate a real negative right-hand amount',()=>{
 const r=read([row('MILCH','1,39',100),row('RB ENERGY','5,49',150),row('LEERGUT EINWEG','-1,25',200),row('5 Stk x','0,25',240,450),row('SUMME','5,63',300)]);
 const m=mergeReceiptReads([r,r]);assert.ok(m);
 const d=parseReceipt(m.text);assert.equal(d.lines.length,3);assert.equal(d.lines[2].quantity,'5');assert.equal(d.lines[2].amount,'-1.25');assert.equal(difference(d),0);
});

test('price-column detection follows a slight perspective slope',()=>{
 const rows=Array.from({length:8},(_,i)=>row('PRODUCT','1,19',100+i*100,800+(100+i*100)*.08));
 rows.push(row('5 Sk','0,25',850,450));
 const column=findPriceColumn(rows);assert.ok(column);
 const points=printedAmounts(rows);
 assert.equal(points.filter(p=>inPriceColumn(p,column)).length,8);
});

test('a long description with a lone wrapped left price keeps its supported layout exception',()=>{
 const r=read([row('MILCH','1,39',100),row('BROT','2,00',150),row('TEA','3,00',200)]);
 const description:OcrRow={text:'1 Hulled Sunflower Seeds, 910g - Organic',words:[{text:'Sunflower',confidence:95,bbox:{x0:80,x1:300,y0:250,y1:280}}],confidence:95,bbox:{x0:80,x1:500,y0:250,y1:280}};
 const price:OcrRow={text:'$12.50',words:[{text:'$12.50',confidence:95,bbox:{x0:80,x1:180,y0:290,y1:320}}],confidence:95,bbox:{x0:80,x1:180,y0:290,y1:320}};
 r.rows!.push(description,price,row('SUMME','18,89',400));r.text=r.rows!.map(r=>r.text).join('\n');
 const d=dateFromPasses(parseReceipt(r.text),r);assert.equal(d.lines.length,4);assert.equal(difference(d),0);
 const m=mergeReceiptReads([r,r]);assert.ok(m);assert.equal(parseReceipt(m.text).lines.length,4);assert.equal(difference(parseReceipt(m.text)),0);
});
test('an explicitly labelled gratuity may use a different amount column',()=>{
 const r=read([row('MILK','1,39',100),row('BREAD','2,00',150),row('Tip','1,00',200,450),row('TOTAL','4,39',300)]);
 const d=dateFromPasses(parseReceipt(r.text),r);assert.equal(d.lines.length,3);assert.equal(difference(d),0);
 const m=mergeReceiptReads([r,r]);assert.ok(m);assert.equal(difference(parseReceipt(m.text)),0);
});
test('a labelled unreadable tip already justified by bill and payment is not lost',()=>{
 const r=read([row('Curry','23,50',100),row('Beer','5,90',150),row('Singha','4,50',200),row('SUMME','33,90',300),row('Trinkgeld rit','',350),row('Kartenzahlung','38,00',400)]);
 const original=parseReceipt(r.text);assert.equal(original.lines.length,4);assert.equal(original.lines[3].amount,'4.10');
 const d=dateFromPasses(original,r);assert.equal(d.lines.length,4);assert.equal(difference(d),0);
});

test('text-only and weak layouts keep the parser fallback',()=>{
 const r={text:'SOBEYS\nMILK 1.39\nTOTAL 1.39',confidence:90};
 assert.equal(receiptReadQuality(r).complete,true);
 assert.equal(findPriceColumn([row('MILK','1.39',100)]),null);
 assert.equal(printedAmounts([row('PRICE/L','1.786',100)]).length,0);
});
test('a split negative right-hand price retains its minus sign and geometry',()=>{
 const r=row('LEERGUT EINWEG','-0,50',200);
 r.words.pop();r.words.push({text:'-0,',confidence:90,bbox:{x0:800,x1:850,y0:200,y1:230}},{text:'50',confidence:90,bbox:{x0:860,x1:900,y0:200,y1:230}});
 assert.deepEqual(printedAmounts([r]),[{amount:'-0.50',bbox:{x0:800,x1:900,y0:200,y1:230}}]);
});
