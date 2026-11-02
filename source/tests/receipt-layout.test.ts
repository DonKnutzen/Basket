import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wordsToLines,type OcrWord} from '../lib/receipt-layout';
import {parseReceipt} from '../lib/receipt-parser';

// Fake Tesseract words: ~12px per character, 30px line height.
const w=(text:string,x:number,y:number):OcrWord=>({text,bbox:{x0:x,y0:y,x1:x+text.length*12,y1:y+30}});

test('right-aligned prices join the name on the same line, with a wide gap',()=>{
 const words=[w('ROOSTER',100,100),w('SUSHI',196,102),w('MRJ',268,101),w('4.00',900,104),w('WHITE',100,140),w('BATARD',172,141),w('2.50',900,143)];
 assert.deepEqual(wordsToLines(words),['ROOSTER SUSHI MRJ   4.00','WHITE BATARD   2.50']);
});

test('a slightly tilted receipt keeps prices on their own rows',()=>{
 // Each line drops 1px per 20px to the right: the price sits ~40px lower than its name,
 // i.e. level with the next row. The tilt is measured from neighbouring words.
 const tilt=(text:string,x:number,y:number)=>w(text,x,y+Math.round(x/20));
 const words=[tilt('WHOLE',100,100),tilt('MILK',172,100),tilt('2L',232,100),tilt('4.99',900,100),tilt('WHITE',100,135),tilt('BREAD',172,135),tilt('3.29',900,135),tilt('TOTAL',100,170),tilt('8.28',900,170)];
 assert.deepEqual(wordsToLines(words),['WHOLE MILK 2L   4.99','WHITE BREAD   3.29','TOTAL   8.28']);
});

test('words arrive in any order and empty words are ignored',()=>{
 const words=[w('2.00',900,60),w('',500,60),w('EGGS',100,61),w('  ',300,20),w('SOBEYS',100,20)];
 assert.deepEqual(wordsToLines(words),['SOBEYS','EGGS   2.00']);
});

test('layout lines feed the parser as name and price',()=>{
 const words=[w('BANANAS',100,100),w('1.55',900,102),w('TOTAL',100,140),w('1.55',900,141)];
 const d=parseReceipt(wordsToLines(words).join('\n'));
 assert.deepEqual(d.lines.map(l=>l.label+'='+l.amount),['BANANAS=1.55']);
 assert.equal(d.total,'1.55');
});
