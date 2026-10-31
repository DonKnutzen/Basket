import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseReceipt,difference} from '../lib/receipt-parser';
import {receiptDate} from '../lib/receipt-date';

// Layouts modelled on real Halifax and Kiel receipts as Tesseract returns them:
// department headers, PLU/UPC codes, tax flags, weighed lines and loyalty savings.
const superstore=`ATLANTIC SUPERSTORE
STORE 0345 1075 BARRINGTON ST
HALIFAX NS B3H 2R1
(902) 492-3240
21-GROCERY
06038385904 PC BLK BEANS MRJ 1.29
05574201049 CLASSICO SAUCE MRJ 3.99
22-DAIRY
06870020302 NEILSON 2% MLK 4L MRJ 6.49
27-PRODUCE
4011 BANANAS MRJ
1.025 kg @ $1.94/kg 1.99
31-MEATS
2 @ $5.99
02811810000 CHKN THIGHS MRJ 11.98
34-SNACKS
06038300045 PC CHIPS HMRJ 3.49
SUBTOTAL 29.23
H=HST 15% 3.49 @ 15% 0.52
TOTAL 29.75
DEBIT TEND 29.75
CHANGE DUE 0.00
10/28/26 14:32 0345 05 2312`;

const sobeys=`SOBEYS
Quinpool Road
Halifax, NS
GROCERY
COMPLIMENTS PASTA 2.49 C
OLD DUTCH CHIPS 4.99 GC
PRODUCE
BANANAS
0.890 kg @ $1.74/kg 1.55 C
MEAT
MAPLE LEAF BACON 7.99 C
SCENE+ SAVINGS -1.00
SUBTOTAL 16.02
HST 15% 0.75
TOTAL 16.77
VISA 16.77
2026/10/27 18:45`;

const walmart=`Walmart
Save money. Live better.
( 902 ) 454-8000
HALIFAX NS
ST# 03124 OP# 009055 TE# 55 TR# 01234
GV 2% MILK 006259801047 F 5.47 J
BANANAS 000000004011KF 1.42 N
1.090 kg @ 1 kg /1.30
DORITOS NACHO 006041004612 4.97 H
SUBTOTAL 11.86
HST 15.000 % 0.75
TOTAL 12.61
DEBIT TEND 12.61
10/28/26 14:21:09`;

const rewe=`REWE
Holtenauer Str. 69-71
24105 Kiel
EUR
BIO TOMATEN 2,49 B
H-MILCH 3,5% 1,19 B
HARIBO GOLDBAEREN 1,29 B
BUTTER 1,78 B
2 Stk x 0,89
PFAND 0,25 A
--------------------------
SUMME EUR 7,00
Geg. EC-Cash EUR 7,00
Steuer % Netto Steuer Brutto
A= 19,0% 0,21 0,04 0,25
B= 7,0% 6,31 0,44 6,75
28.10.2026 18:03 Bon-Nr.:1234`;

const aldi=`ALDI Nord
ALDI GmbH & Co. KG
Kiel
EUR
Milch 3,5% 1,09 A
Bananen 1,29 A
Schokolade Vollmilch 0,79 A
Hähnchenbrustfilet 4,99 A
Summe 8,16
Kartenzahlung 8,16
29.10.26 10:15`;

test('Atlantic Superstore receipt: store, date, codes, flags, weights and HST',()=>{
 const d=parseReceipt(superstore);
 assert.equal(d.store,'Atlantic Superstore');
 assert.equal(d.date,'2026-10-28');
 assert.equal(d.currency,'CAD');
 assert.equal(d.tax,'0.52');
 assert.equal(d.total,'29.75');
 assert.deepEqual(d.lines.map(l=>l.amount),['1.29','3.99','6.49','1.99','11.98','3.49']);
 assert.ok(!d.lines.some(l=>/mrj|hst|^\d/i.test(l.name)),d.lines.map(l=>l.name).join('|'));
 const bananas=d.lines[3];assert.equal(bananas.name,'Bananas');assert.equal(bananas.measuredQuantity,'1.025');assert.equal(bananas.category,'Produce');
 const chicken=d.lines[4];assert.equal(chicken.quantity,'2');assert.equal(chicken.category,'Meat & fish');assert.match(chicken.name,/^Chicken Thighs$/);
 assert.equal(d.lines[2].category,'Dairy & eggs');
 assert.equal(d.lines[5].category,'Snacks & sweets');
 assert.equal(difference(d),0);
});
test('Sobeys receipt: loyalty savings reduce the preceding item and the receipt balances',()=>{
 const d=parseReceipt(sobeys);
 assert.equal(d.store,'Sobeys');assert.equal(d.date,'2026-10-27');assert.equal(d.total,'16.77');assert.equal(d.tax,'0.75');
 assert.deepEqual(d.lines.map(l=>l.name),['Compliments Pasta','Old Dutch Chips','Bananas','Maple Leaf Bacon']);
 assert.equal(d.lines[3].amount,'6.99');assert.equal(d.lines[3].regularPrice,'7.99');
 assert.equal(d.unassignedAdjustments?.length,0);
 assert.equal(difference(d),0);
 assert.equal(d.lines[1].category,'Snacks & sweets');assert.equal(d.lines[3].category,'Meat & fish');
});
test('Walmart receipt: inline UPC codes and trailing tax flags are removed',()=>{
 const d=parseReceipt(walmart);
 assert.equal(d.store,'Walmart');assert.equal(d.date,'2026-10-28');assert.equal(d.total,'12.61');
 assert.deepEqual(d.lines.map(l=>l.name),['Gv 2% Milk','Bananas','Doritos Nacho']);
 assert.equal(difference(d),0);
 assert.equal(d.lines[2].category,'Snacks & sweets');
});
test('REWE receipt: quantity line after an item, deposit and German VAT table',()=>{
 const d=parseReceipt(rewe);
 assert.equal(d.store,'REWE');assert.equal(d.date,'2026-10-28');assert.equal(d.currency,'EUR');assert.equal(d.total,'7.00');assert.equal(d.tax,'0.00');
 assert.deepEqual(d.lines.map(l=>l.amount),['2.49','1.19','1.29','1.78','0.25']);
 assert.equal(d.lines[3].quantity,'2');
 assert.equal(d.lines[2].category,'Snacks & sweets');
 assert.equal(difference(d),0);
});
test('ALDI receipt: two-digit year and German snack/meat categories',()=>{
 const d=parseReceipt(aldi);
 assert.equal(d.store,'Aldi Nord');assert.equal(d.date,'2026-10-29');assert.equal(d.total,'8.16');
 assert.equal(d.lines.length,4);assert.equal(difference(d),0);
 assert.deepEqual(d.lines.map(l=>l.category),['Dairy & eggs','Produce','Snacks & sweets','Meat & fish']);
});
test('Canadian chain receipts print month first, so a slash date is not ambiguous there',()=>{
 assert.equal(receiptDate('WALMART\n04/05/26 10:00','CA','Walmart').date,'2026-04-05');
 assert.equal(receiptDate('ATLANTIC SUPERSTORE\n04/05/26','CA','Atlantic Superstore').date,'2026-04-05');
 assert.equal(receiptDate('SOMEWHERE\n04/05/2026','CA').status,'ambiguous');
});
