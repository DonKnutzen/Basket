import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseReceipt,cleanOcrLine} from '../lib/receipt-parser';

const amounts=(text:string)=>parseReceipt(text).lines.map(l=>l.label+'='+l.amount);

test('margin noise from table and fingers is stripped around the print',()=>{
 assert.equal(cleanOcrLine('— eas        ARCP: ($2.50)                  -1.00 | —.'),'ARCP: ($2.50) -1.00');
 assert.equal(cleanOcrLine('eee Se      06740062526 OKA MUSHROOMS AN MRJ      6.99 |S'),'06740062526 OKA MUSHROOMS AN MRJ 6.99');
 assert.equal(cleanOcrLine('a     I        $3.29 Imt 4, $3.99 ea                   LT.'),'$3.29 Imt 4, $3.99 ea');
 assert.equal(cleanOcrLine('a      06024901631 WHITE BATARD ~~ MRJ      2.50 [EEE'),'06024901631 WHITE BATARD MRJ 2.50');
 assert.equal(cleanOcrLine('21-GROCERY                                      BB'),'21-GROCERY');
 // Real content is kept: upper-case words and counts. One-letter tax flags after the price are dropped like noise.
 assert.equal(cleanOcrLine('BANANAS      1.55 C'),'BANANAS 1.55');
 assert.equal(cleanOcrLine('JUICE      3.99 GC'),'JUICE 3.99 GC');
 // A short trailing word after the price may be a tax flag; the parser ignores both.
 assert.equal(cleanOcrLine('2 @ $2.00                           4.00 EE'),'2 @ $2.00 4.00 EE');
});

test('second iPhone scan: junk marks glued to real words, stray characters after prices',()=>{
 // "~~" before a real word must not throw the whole column away.
 assert.equal(cleanOcrLine('-       ~~ TOTAL STORE REWARD                100 Pts     LT :'),'TOTAL STORE REWARD 100 Pts');
 assert.equal(cleanOcrLine('~~ TOTAL         J     21.78 |'),'TOTAL J 21.78');
 // One stray character right after the price: "2.00   4", "2.50 [= &".
 assert.equal(cleanOcrLine('2@ $1.00 ea                     2.00   4'),'2@ $1.00 ea 2.00');
 assert.equal(cleanOcrLine('Gen             06024901631 WHITE BATARD ~~ MRJ 2.50 [= &'),'06024901631 WHITE BATARD MRJ 2.50');
 const d=parseReceipt('06340026083 D ITAL BUNS CRUS MRU 4.00\n88651800061 MARUKOME MISO MRJ\n$3.29 mt 4, $3.99 ea\n1@ $3.29 ea                    319 £8');
 assert.deepEqual(d.lines.map(l=>l.label+'='+l.amount),['D ITAL BUNS CRUS=4.00','MARUKOME MISO 1@ $3.29 ea=3.29']);
 assert.ok(d.warnings?.some(w=>/319/.test(w)),String(d.warnings));
});

test('O/l/I/S/B are read as digits only inside prices',()=>{
 assert.deepEqual(amounts('MILK 4.0O\nBREAD l.29\nEGGS S.99\nCHEESE 1B.49\nOIL SOAP 2.00'),['MILK=4.00','BREAD=1.29','EGGS=5.99','CHEESE=18.49','OIL SOAP=2.00']);
});

test('comma decimals, split decimals and missing space before the price',()=>{
 assert.deepEqual(amounts('MILK 4,00\nBREAD 4. 00 C\nBANANAS1.29'),['MILK=4.00','BREAD=4.00','BANANAS=1.29']);
});

test('tax flags before or after the price do not end up in the label',()=>{
 assert.deepEqual(amounts('PC CHIPS HMRJ 3.49\nPASTA 2.49 A B\nJUICE 3.99 GC\n06810090489 THREE CHSE DNR MR\n2 @ $1.00 ea 2.00'),['PC CHIPS=3.49','PASTA=2.49','JUICE=3.99','THREE CHSE DNR 2 @ $1.00 ea=2.00']);
});

test('Tesseract PSM 4 artefacts on the Superstore receipt',()=>{
 const d=parseReceipt('06810090489 THREE CHSE DNR   MRJ\n$1.00 mt 6, $2.00 ea\n2 @ $1.00 ea   2.00\n06024901631 WHITE BATARD   MRJ   2.50\nARCP:   ($2. 50)   L-1.00\n06740062526 OKA MUSHROOMS AN MRJ   y 6.99\nEe   TOTAL   J   10.49');
 assert.deepEqual(d.lines.map(l=>l.label+'='+l.amount),['THREE CHSE DNR 2 @ $1.00 ea=2.00','WHITE BATARD=1.50','OKA MUSHROOMS AN=6.99']);
 assert.equal(d.total,'10.49');
});

test('noisy total lines are recognized',()=>{
 assert.equal(parseReceipt('MILK 4.00\nTOTAL : 4.00').total,'4.00');
 assert.equal(parseReceipt('MILK 4.00\nT0TAL 4.00').total,'4.00');
 // After the subtotal, a badly read TOTAL is accepted when the amount fits.
 assert.equal(parseReceipt('MILK 4.00\nA a SUBTOTAL 4.00\nNw ol TeFAL 4.00').total,'4.00');
 assert.equal(parseReceipt('MILK 4.00\nSUBTOTAL 4.00\nTOTAL 4.00\nTotal Savings 1.00').total,'4.00');
 // PSM 6 output: a longer junk word before SUBTOTAL, a digit before TOTAL.
 const d=parseReceipt('MILK 4.00\nGame. SUBTOTAL    4.00 [a Sl\n8 TOTAL        J     4.00 [Ee');
 assert.equal(d.total,'4.00');assert.deepEqual(d.lines.map(l=>l.label),['MILK']);
});

test('a lost decimal point is restored only with evidence',()=>{
 const d=parseReceipt('06340026083 D ITAL BUNS CRUS MRJ 400\n88651800061 MARUKOME MISO MRJ\n$3.29 Imt 4, $3.99 ea\n1@ $3.29 ea 329\nTOTAL 7.29');
 assert.deepEqual(d.lines.map(l=>l.amount),['4.00','3.29']);
 assert.ok(d.warnings?.some(w=>/decimal point/i.test(w)));
 // A bare number without tax flag or count evidence stays unparsed.
 assert.deepEqual(amounts('PARKING 400'),[]);
});

test('when items and total disagree, the most likely OCR fix is suggested but not applied',()=>{
 const d=parseReceipt('MILK 4.99\nBREAD 8.29\nTOTAL 8.28');
 assert.deepEqual(d.lines.map(l=>l.amount),['4.99','8.29']);
 assert.ok(d.warnings?.some(w=>/BREAD.*8\.29.*3\.29/.test(w)),String(d.warnings));
 const missed=parseReceipt('MILK 4.99\nTOTAL 7.49');
 assert.ok(missed.warnings?.some(w=>/2\.50/.test(w)),String(missed.warnings));
});
