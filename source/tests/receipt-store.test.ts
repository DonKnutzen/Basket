import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseReceipt} from '../lib/receipt-parser';

test('store name skips a greeting line above it',()=>{
 assert.equal(parseReceipt('WELCOME\nSHELL\n123 MAIN ST\nREGULAR 40.00 L\nTOTAL $60.00').store,'Shell');
 assert.equal(parseReceipt('Welcome to\nCorner Bakery Co\n12 Elm Rd\nBREAD 3.50\nTOTAL 3.50').store,'Corner Bakery Co');
 assert.equal(parseReceipt('WELCOME TO FRESHCO\n12 Elm Rd\nBREAD 3.50\nTOTAL 3.50').store,'FreshCo');
});

test('the store named first in the header wins and learned stores count',()=>{
 assert.equal(parseReceipt('NO FRILLS\nnext to Tim Hortons\nBREAD 3.50\nTOTAL 3.50').store,'No Frills');
 assert.equal(parseReceipt('Thank you\nBob\'s Market\nBREAD 3.50\nTOTAL 3.50',[],[],['Bob\'s Market']).store,'Bob\'s Market');
});

test('receipt kind is detected',()=>{
 assert.equal(parseReceipt('WELCOME\nSHELL\nREGULAR 40.00 L\nTOTAL $60.00').kind,'fuel');
 assert.equal(parseReceipt('TIM HORTONS\n1 Coffee 2.00\nTOTAL 2.00').kind,'takeout');
 assert.equal(parseReceipt('NO FRILLS\nBREAD 3.50\nTOTAL 3.50').kind,'groceries');
});

test('market with café counter and server/tip line stays groceries with item categories',async()=>{
 const {readFileSync}=await import('node:fs');const {applyReceiptKind}=await import('../lib/receipt-parser');
 const d=parseReceipt(readFileSync('tests/receipt-ocr-corpus/uprooted-market-iphone-v2.txt','utf8'));
 assert.equal(d.kind,'groceries');
 const cat=(n:string)=>d.lines.find(l=>l.label.includes(n))?.category;
 assert.equal(cat('Garlic'),'Veggies');assert.equal(cat('Scallops'),'Meat & fish');
 const t=applyReceiptKind(d,'takeout');assert.ok(t.lines.every(l=>l.category==='Takeout'));
 assert.equal(applyReceiptKind(t,'groceries').lines.find(l=>l.label.includes('Garlic'))?.category,'Veggies');
});
