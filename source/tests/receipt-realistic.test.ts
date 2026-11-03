import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseReceipt,difference} from '../lib/receipt-parser';
import {receiptDate} from '../lib/receipt-date';
import {toCents} from '../lib/types';

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
 const bananas=d.lines[3];assert.equal(bananas.name,'Bananas');assert.equal(bananas.measuredQuantity,'1.025');assert.equal(bananas.category,'Fruit');
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
 assert.deepEqual(d.lines.map(l=>l.category),['Dairy & eggs','Fruit','Snacks & sweets','Meat & fish']);
});
test('Canadian chain receipts print month first, so a slash date is not ambiguous there',()=>{
 assert.equal(receiptDate('WALMART\n04/05/26 10:00','CA','Walmart').date,'2026-04-05');
 assert.equal(receiptDate('ATLANTIC SUPERSTORE\n04/05/26','CA','Atlantic Superstore').date,'2026-04-05');
 assert.equal(receiptDate('SOMEWHERE\n04/05/2026','CA').status,'ambiguous');
});

const irving=`IRVING
OXFORD ST HALIFAX NS
PUMP# 04
REGULAR 38.462L @ 155.9 /L $59.96
OLD DUTCH CHIPS 4.49
SUBTOTAL $64.45
HST INCLUDED $8.41
TOTAL $64.45
VISA $64.45
11/01/26 09:12`;
const esso=`Esso
Dartmouth NS
Pump: 3
Product: Diesel
Litres: 40.123
Price/L: $1.69
Fuel Sale $67.81
GST/HST INCL 8.84
TOTAL $67.81
2026-11-01 10:40`;
const aral=`ARAL Tankstelle
Kiel
Säule 4 Super E10
40,12 l x 1,789 EUR/l 71,77 EUR A
Summe EUR 71,77
MwSt 19% 11,46
01.11.2026 11:05`;
test('gas station receipts: fuel grade, litres, Fuel category and included tax',()=>{
 const i=parseReceipt(irving);
 assert.equal(i.store,'Irving');assert.equal(i.date,'2026-11-01');assert.equal(i.tax,'0.00');assert.equal(difference(i),0);
 assert.equal(i.lines[0].name,'Regular gasoline');assert.equal(i.lines[0].category,'Fuel');assert.equal(i.lines[0].measuredQuantity,'38.462');assert.equal(i.lines[0].measuredUnit,'L');
 assert.equal(i.lines[1].category,'Snacks & sweets');
 const e=parseReceipt(esso);
 assert.equal(e.store,'Esso');assert.equal(e.lines.length,1);assert.equal(e.lines[0].name,'Diesel');assert.equal(e.lines[0].amount,'67.81');assert.equal(e.lines[0].measuredQuantity,'40.123');assert.equal(difference(e),0);
 const a=parseReceipt(aral);
 assert.equal(a.store,'Aral');assert.equal(a.currency,'EUR');assert.equal(a.date,'2026-11-01');assert.equal(a.lines.length,1);
 assert.equal(a.lines[0].name,'Super E10');assert.equal(a.lines[0].measuredQuantity,'40.12');assert.equal(a.lines[0].category,'Fuel');assert.equal(difference(a),0);
 assert.equal(e.lines[0].unitPrice,'1.690');assert.equal(a.lines[0].unitPrice,'1.789');assert.equal(i.lines[0].unitPrice,(toCents(i.lines[0].amount)/100/38.462).toFixed(3));
});
test('fuel price per litre: printed price is checked against total ÷ litres',()=>{
 // Real Shell OCR: litres spaced out, dot-matrix 1.786 read as "§l,788", total on the payment line.
 const shell=parseReceipt('WELCOME\nShell Canada\nDartmouth NS\nBronze\nPUMP No. 03\nLITRES   35. 380\nBRICETL   §l,788   N\nTOTAL FUEL   $63.19\nTOTAL SALE\nVisa   $63.13 63.19\nFUEL INCLUDES\nHS   -   fuel   1.76\nDATE: 2026/10/31');
 assert.equal(shell.total,'63.19');assert.equal(shell.lines.length,1);assert.equal(shell.lines[0].measuredQuantity,'35.380');assert.equal(shell.lines[0].unitPrice,'1.786');
 assert.ok(shell.warnings?.some(w=>w.includes('1.788')));assert.equal(shell.date,'2026-10-31');
 const exact=parseReceipt('Shell Canada\nBronze\nLITRES l   35.380\nPRICE/L $1.786\nTOTAL FUEL $63.19\nTOTAL SALE $63.19');
 assert.equal(exact.lines[0].unitPrice,'1.786');assert.ok(!exact.warnings?.some(w=>/price per litre/i.test(w)));
 // Unreadable litres come from total ÷ printed price.
 const derived=parseReceipt('Shell Canada\nBronze\nPRICE/L $1.786\nTOTAL FUEL $63.19\nTOTAL SALE $63.19');
 assert.equal(derived.lines[0].measuredQuantity,'35.381');assert.equal(derived.lines[0].unitPrice,'1.786');
});
test('currency without readable place names: province code, Canadian tax and $ amounts',()=>{
 // Real browser OCR of the Shell receipt: "Dartmouth NS" and "(902)" garbled.
 const shell=parseReceipt('Hi\n132 N\nDarts   NS\n(302)"\n434 7035\nBronze\nPUMP N 0.   03\nLI TRES   35. 380\nTOTAL SALE   6 3.19\n63.19   :\nTYPE: PURCHASE\nVisa');
 assert.equal(shell.country,'CA');assert.equal(shell.currency,'CAD');
 assert.equal(parseReceipt('CORNER STORE\nMILK $5.49\nHST 0.82\nTOTAL $6.31').currency,'CAD');
 assert.equal(parseReceipt('KIOSK\nCOLA $2.49\nTOTAL $2.49').currency,'CAD');
 assert.equal(parseReceipt('Kaufland Kiel\nPreis EUR\nCola 0,89 A\nSumme 0,89').currency,'EUR');
});
test('Kaufland prints pack counts with an asterisk: "2 * 1,49"',()=>{
 const k=parseReceipt('Kaufland - Skandinaviendamm 299\n24109 Kiel\nRed Bull Energy\n2 * 1,49   2,98 A\nSumme   2,98\nDatum: 02. 11. 26 Zeit: 17:00:38');
 assert.equal(k.lines.length,1);assert.equal(k.lines[0].quantity,'2');assert.equal(k.lines[0].amount,'2.98');assert.equal(k.date,'2026-11-02');
});
test('takeout receipts: restaurant chains and dine-in/take-out hints use the Takeout category',()=>{
 const tims=parseReceipt('TIM HORTONS #1234\nSPRING GARDEN RD HALIFAX NS\nTAKE OUT\n1 MED ORIGINAL 2.19\n1 BAGEL BELT 4.29\n1 TIMBITS 10 PK 3.39\nSUBTOTAL 9.87\nHST 15% 1.48\nTOTAL 11.35\n11/01/26 08:15');
 assert.equal(tims.store,'Tim Hortons');assert.equal(difference(tims),0);
 assert.ok(tims.lines.length===3&&tims.lines.every(l=>l.category==='Takeout'),JSON.stringify(tims.lines.map(l=>[l.name,l.category])));
 assert.equal(tims.lines[1].name,'Bagel Belt');assert.equal(tims.lines[1].quantity,'1');
 const local=parseReceipt('THE CHICKEN SHACK\nHalifax NS\nServer: Sam Table 4\nWINGS 14.99\nFRIES 5.99\nHST 3.15\nTOTAL 24.13');
 assert.ok(local.lines.every(l=>l.category==='Takeout'));
 assert.equal(parseReceipt('SOBEYS\nCHIPS 4.99\nTOTAL 4.99').lines[0].category,'Snacks & sweets');
});

test('Atlantic Superstore Bayers Lake: count lines carry the price, limits, ARCP, stamps and YY/MM/DD',async()=>{
 const {RECEIPT_FIXTURES,checkReceiptFixture}=await import('../lib/receipt-fixtures');
 const fixture=RECEIPT_FIXTURES.find(f=>f.id==='superstore-bayers-lake')!;
 const d=parseReceipt(fixture.text);
 const failed=checkReceiptFixture(d,fixture).filter(c=>!c.ok);
 assert.deepEqual(failed,[],JSON.stringify(d.lines.map(l=>[l.label,l.amount,l.quantity])));
 assert.deepEqual(d.lines.map(l=>l.name),['Rooster Sushi','Three Cheese Dinner','Marukome Miso','White Batard','D Ital Buns Crus','Oka Mushrooms An']);
 const batard=d.lines[3];assert.equal(batard.regularPrice,'2.50');assert.equal(batard.discount,'1.00');
 assert.equal(d.unassignedAdjustments?.length,0);
 assert.ok(!d.warnings?.some(w=>/negative|differs/i.test(w)),d.warnings?.join('|'));
 // OCR variants: slash after the code, everything else the same.
 const variant=parseReceipt(fixture.text.replace('24632 PHY','24632/PHY'));
 assert.equal(variant.lines.length,6);assert.equal(difference(variant),0);
});
