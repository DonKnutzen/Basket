import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseReceipt,difference} from '../lib/receipt-parser';
import {receiptDate} from '../lib/receipt-date';
import {readReceiptPhoto,dateFromPasses,ocrDateEvidence,type OcrWorker} from '../lib/receipt-ocr';
import {mergeReceiptReads,receiptReadQuality} from '../lib/receipt-merge';
import {wordsToRows,type OcrWord} from '../lib/receipt-layout';
import {receiptCategory} from '../lib/types';

const rewe=readFileSync('tests/receipt-inputs/rewe-kiel-transcript.txt','utf8');
test('REWE: 19 bookings preserve deposits, refunds, quantities and all goods',()=>{
 const d=parseReceipt(rewe);
 assert.equal(d.lines.length,19);assert.equal(d.total,'21.99');assert.equal(difference(d),0);
 assert.equal(d.store,'REWE');assert.equal(d.date,'2026-11-05');
 assert.equal(d.lines.find(l=>l.label==='RB ENERGY')?.amount,'5.49');
 assert.deepEqual(d.lines.filter(l=>Number(l.amount)<0).map(l=>[l.quantity,l.amount]),[['4','-0.32'],['2','-0.30'],['5','-1.25'],['2','-0.50']]);
 assert.equal(d.lines.find(l=>l.label==='FRUEHLINGSQUARK')?.quantity,'2');
});
test('a soup is never a total and must not discard the rest of the REWE receipt',()=>{
 const d=parseReceipt(rewe.replace('POLPA FINE','SUPPE'));
 assert.equal(d.lines.length,19);assert.equal(difference(d),0);
 assert.equal(d.lines.find(l=>l.label==='SUPPE')?.amount,'1.11');
});
test('damaged REWE OCR keeps its gap visible and finds the store beyond logo noise',()=>{
 const d=parseReceipt(readFileSync('tests/receipt-inputs/rewe-kiel-ocr.txt','utf8'));
 assert.equal(d.store,'REWE');assert.equal(difference(d),1300);
 assert.ok(!d.lines.some(l=>l.label==='RB ENERGY')); // absent text must not invent an item
 assert.ok(d.lines.find(l=>l.name==='J%)')?.nameReviewRequired);
});
test('a matching sum does not make a numeric OCR fragment a trustworthy product name',()=>{
 const d=parseReceipt('Atlantic Superstore\n2026/11/05\n2881.00 ea 2.00\nTOTAL 2.00');
 assert.equal(difference(d),0);assert.ok(d.lines[0].nameReviewRequired);
 assert.equal(receiptReadQuality({text:d.rawText,confidence:95}).complete,false);
});
test('a name warning for one refund does not flag another refund with a different amount',()=>{
 const text='REWE\nLEERGUT EINWEG -1,25\nLEERGUT EINWEG -0,50\nSUMME -1,75';
 const d=dateFromPasses(parseReceipt(text),{text,confidence:85,uncertainItems:[{label:'LEERGUT EINWEG',amount:'-0.50'}]});
 assert.ok(!d.lines[0].nameReviewRequired);assert.equal(d.lines[1].nameReviewRequired,true);
});
test('payment evidence is not rewritten to hide missing items',()=>{
 const d=parseReceipt('famila\nMILCH 1,00\nBROT 2,00\nKAFFEE 3,00\nSUMME\nEC-Cash 8,00');
 assert.equal(d.total,'8.00');assert.equal(difference(d),200);
});
test('unreadable tax and coupon evidence is checked before arbitrary price suggestions',()=>{
 const tax=parseReceipt(readFileSync('tests/receipt-ocr-corpus/uprooted-market-iphone.txt','utf8'));
 assert.ok(tax.warnings?.some(w=>w.includes('tax line')));assert.ok(!tax.warnings?.some(w=>w.includes('missed item or fee')));
 const discount=parseReceipt(readFileSync('tests/receipt-ocr-corpus/superstore-bayers-lake-psm6.txt','utf8'));
 assert.ok(discount.warnings?.some(w=>w.includes('discounts or coupons')));assert.ok(!discount.warnings?.some(w=>w.includes('5.99')));
});
test('day fragments require confirmation even when a recent scan date can be suggested',()=>{
 for(const scan of ['2026-11-05','2026-12-05']){
  const d=receiptDate('Datum: 05.','DE','REWE',new Date(scan+'T12:00:00Z'));
  assert.equal(d.date,scan);assert.equal(d.status,'inferred');
 }
 assert.equal(receiptDate('2026/11/05','CA','Shell').status,'recognized');
});
test('a misread OCR year and contradictory day fragment cannot become a confirmed date',()=>{
 const e=ocrDateEvidence('Datum: 05.\n02.11.2006','DE','REWE',new Date('2026-11-05T12:00:00Z'));
 assert.equal(e.date,'');assert.equal(e.status,'ambiguous');
});
test('German country evidence wins over a weak province/volume fragment',()=>{
 for(const fragment of ['BONUS NS','APFELSAFT 2 litres']){
  const d=parseReceipt('REWE Markt GmbH\n24105 Kiel\n'+fragment+'\nMILCH 1,39\nSUMME 1,39');
  assert.equal(d.country,'DE');assert.equal(d.currency,'EUR');
 }
 assert.equal(parseReceipt('Bistro Kiel\nCurry 12,00\nSUMME 12,00').kind,'takeout');
});
test('clear register product abbreviations have categories without renaming other products',()=>{
 for(const [name,category] of [['BRESSO KRAEUT','Dairy & eggs'],['FRUEHLQ. 7-KRÄUT','Dairy & eggs'],['POLPA FINE','Pantry'],['CC ZERO 0,5FL','Drinks']] as const)assert.equal(receiptCategory(name),category,name);
 assert.equal(receiptCategory('Chocolate cookies'),'Snacks & sweets');
});

// Position-based fixtures: repeated products belong to distinct physical rows.
const row=(text:string,y:number)=>{const tokens=text.split('   '),ws:OcrWord[]=tokens.map((text,i)=>({text,confidence:90,bbox:{x0:i?800:80,x1:i?900:400,y0:y,y1:y+30}}));return wordsToRows(ws)[0]};
const read=(entries:[string,number][])=>{const rows=entries.map(([text,y])=>row(text,y));return {text:rows.map(r=>r.text).join('\n'),confidence:85,rows}};
const header:[string,number][]=[['REWE',10],['05.11.2026',50]];
test('OCR fusion retains Red Bull read in a pass that missed the total',()=>{
 const a=read([...header,['MILCH   1,39',100],['RB ENERGY   5,49',140]]);
 const b=read([...header,['MILCH   1,39',100],['SUMME   6,88',220]]);
 const merged=mergeReceiptReads([a,b]);assert.ok(merged);
 const d=parseReceipt(merged.text);assert.equal(difference(d),0);
 assert.deepEqual(d.lines.map(l=>[l.label,l.amount]),[['MILCH','1.39'],['RB ENERGY','5.49']]);
});
test('OCR fusion preserves identical repeated products without duplicating passes',()=>{
 const a=read([...header,['RB ENERGY   5,49',100],['RB ENERGY   5,49',140],['SUMME   10,98',220]]);
 const merged=mergeReceiptReads([a,a,a]);assert.ok(merged);
 assert.equal(parseReceipt(merged.text).lines.length,2);
});
test('a separately read count is retained only with position and arithmetic evidence',()=>{
 const a=read([...header,['QUARK   2,90',100],['MILCH   1,39',200],['SUMME   4,29',300]]);
 const b=read([...header,['QUARK',100],['2 Stk x 1,45',150],['MILCH   1,39',200],['SUMME   4,29',300]]);
 const merged=mergeReceiptReads([a,b]);assert.ok(merged);
 const d=parseReceipt(merged.text);assert.equal(d.lines[0].quantity,'2');assert.equal(difference(d),0);
});
test('OCR fusion keeps Canadian added tax once and negative bookings separate',()=>{
 const a=read([['Halifax NS',10],['2026/11/05',50],['MILK   4.00',100],['HST   0.56',180],['TOTAL   4.56',240]]);
 const m=mergeReceiptReads([a,a]);assert.ok(m);
 const d=parseReceipt(m.text);assert.equal(d.tax,'0.56');assert.equal(d.lines.length,1);assert.equal(difference(d),0);
 const refund=read([...header,['LEERGUT   -0,50',100],['LEERGUT   -0,50',150],['SUMME   -1,00',240]]);
 const r=mergeReceiptReads([refund,refund]);assert.ok(r);assert.equal(parseReceipt(r.text).lines.length,2);assert.equal(difference(parseReceipt(r.text)),0);
});
test('conflicting printed totals cannot be resolved by making item amounts fit',()=>{
 const a=read([...header,['MILCH   1,39',100],['SUMME   1,39',220]]),b=read([...header,['MILCH   1,39',100],['SUMME   2,39',220]]);
 assert.equal(mergeReceiptReads([a,b]),null);
});

const image={width:100,height:400,data:new Uint8Array(40000)};
test('a complete date in another full pass avoids every date-band reread',async()=>{
 let calls=0;
 const worker:OcrWorker={setParameters:async()=>{},recognize:async()=>({data:{text:++calls===1?'REWE\nMILCH 1,39':'REWE\n05.11.2026\nMILCH 1,39\nSUMME 1,39',confidence:90}})};
 const r=await readReceiptPhoto(worker,image,x=>x);assert.ok(r);
 assert.equal(calls,2);assert.equal(dateFromPasses(parseReceipt(r.text),r).date,'2026-11-05');
});
test('date rereads stop immediately when the first band has a complete date',async()=>{
 let calls=0;
 const worker:OcrWorker={setParameters:async()=>{},recognize:async()=>({data:{text:++calls===1?'REWE\nMILCH 1,39\nSUMME 1,39':'05.11.2026',confidence:90}})};
 const r=await readReceiptPhoto(worker,image,x=>x);assert.ok(r);
 assert.equal(calls,2);assert.equal(dateFromPasses(parseReceipt(r.text),r).date,'2026-11-05');
});
test('an unreadable located date does not trigger rereads of unrelated item bands',async()=>{
 let calls=0;
 const receipt=read([['REWE',10],['MILCH   1,39',100],['SUMME   1,39',200],['Datum: 05.',300]]);
 const blocks=[{paragraphs:[{lines:receipt.rows.map(r=>({words:r.words}))}]}];
 const worker:OcrWorker={setParameters:async()=>{},recognize:async()=>({data:++calls===1?{text:receipt.text,blocks,confidence:90}:{text:'Unreadable date',confidence:20}})};
 const r=await readReceiptPhoto(worker,{width:1000,height:2000,data:new Uint8Array(2000000)},x=>x);assert.ok(r);
 assert.ok(calls<=5,`unexpected OCR calls: ${calls}`);
 assert.notEqual(dateFromPasses(parseReceipt(r.text),r).dateEvidence?.status,'recognized');
});
test('cancellation after the first OCR result starts no more work',async()=>{
 let active=true,calls=0;
 const worker:OcrWorker={setParameters:async()=>{},recognize:async()=>{calls++;active=false;return {data:{text:'REWE',confidence:90}}}};
 assert.equal(await readReceiptPhoto(worker,image,x=>x,()=>active),null);assert.equal(calls,1);
});
