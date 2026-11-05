import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseReceipt} from '../lib/receipt-parser';

// Photo in bad light: euro sign read as ¢, VAT flag B as 8, stray "," after the flag, total only on the EC-Cash line and misread.
const RAW=`famila
besser ais gut!
fami 1a Mettenhof
Kurt-Schumacher-Platz 4
24109 Kiel -Mettenhof
Tel.: 0431 / 53720-0
Mo. - Sa.: 07:00 - 20:00 Uhr
LO.NIC NAC BBQ110G   1,11¢€8
MIONETTO   0,50   9.99 € A
RED BULL 250ML   1,49 € A ,
PFAND DPG-SYSTEM   0,25€ A
ORYZA SEL .RISOTTO   3.99¢€8B
ARLA SKYR FR. 450G   1,99¢ 8
~ ARLA SKYR 4506   1,99 € B
HARRY SANDWICH375G   1.69¢€8
BUTTERCROISSANT80G   0,69€¢8
KAISERBR.MOHN 70G   0,49¢ 8
Summe
EC-Cash   2.58 ¢
Ruckgeld   0.00 €
a.
"a   —.—— r   ne
-K-U-N-DB-E-N-B-E-L-E-G-
Famila
Mettenhof
tried 78
_yonic Cash`;

test('famila receipt photographed in bad light keeps all ten items',()=>{
 const d=parseReceipt(RAW);
 assert.equal(d.store,'famila');
 assert.deepEqual(d.lines.map(l=>l.amount),['1.11','9.99','1.49','0.25','3.99','1.99','1.99','1.69','0.69','0.49']);
 // Keep the payment independent: missing items and a misread payment are not distinguishable.
 assert.equal(d.total,'2.58');
 assert.ok(d.warnings?.some(w=>w.includes('23.68')));
});
