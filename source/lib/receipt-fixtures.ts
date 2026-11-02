import {type ReceiptDraft} from './types';

export type ReceiptFixture = {
  id:string; title:string; titleEn:string; description:string; descriptionEn:string; text:string;
  expected:{store:string;date:string;total:string;tax:string;lines:{label:string;amount:string;quantity?:string;category?:string}[];balanced:boolean};
};
export const RECEIPT_FIXTURES:ReceiptFixture[] = [
  {id:'basic',title:'No Frills · Standard',titleEn:'No Frills · Standard',description:'Drei Artikel ohne Steuern',descriptionEn:'Three items without tax',text:'NO FRILLS\n2026-10-27\nMILK 2L 5.49\nEGGS 12PK 4.49\nBANANAS 1.69\nSUBTOTAL 11.67\nHST 0.00\nTOTAL 11.67',expected:{store:'No Frills',date:'2026-10-27',total:'11.67',tax:'0.00',balanced:true,lines:[{label:'MILK 2L',amount:'5.49'},{label:'EGGS 12PK',amount:'4.49'},{label:'BANANAS',amount:'1.69',category:'Fruit'}]}},
  {id:'quantities',title:'Sobeys · Mengen & Steuer',titleEn:'Sobeys · Quantities and tax',description:'Mehrere Einheiten und HST',descriptionEn:'Multiple units and HST',text:'SOBEYS\n2026-10-27\n2 x BANANAS 3.38\nBREAD 3.49\nHST 0.45\nTOTAL 7.32',expected:{store:'Sobeys',date:'2026-10-27',total:'7.32',tax:'0.45',balanced:true,lines:[{label:'2 x BANANAS',amount:'3.38',quantity:'2',category:'Fruit'},{label:'BREAD',amount:'3.49',category:'Bakery'}]}},
  {id:'discount',title:'Walmart · Rabatt',titleEn:'Walmart · Discount',description:'Ein Rabatt muss den bezahlten Gesamtbetrag ausgleichen',descriptionEn:'A discount must reconcile with the final amount paid',text:'WALMART\n2026-10-27\nAPPLES 4.00\nCOUPON -1.00\nTOTAL 3.00',expected:{store:'Walmart',date:'2026-10-27',total:'3.00',tax:'0.00',balanced:true,lines:[{label:'APPLES',amount:'3.00',category:'Fruit'}]}},
  {id:'weight',title:'Gateway · Wiegeware',titleEn:'Gateway · Weighed produce',description:'Kilogramm-Menge und Artikelgesamtpreis',descriptionEn:'Kilogram quantity and product line total',text:'GATEWAY\n2026-10-27\nBANANAS 0.765KG 1.88\nTOTAL 1.88',expected:{store:'Gateway',date:'2026-10-27',total:'1.88',tax:'0.00',balanced:true,lines:[{label:'BANANAS 0.765KG',amount:'1.88',quantity:'0.765',category:'Fruit'}]}},
  {id:'french',title:'IGA · Komma & Québec-Steuern',titleEn:'IGA · Decimal commas and Québec tax',description:'Französische Artikel und TPS/TVQ',descriptionEn:'French labels and TPS/TVQ',text:'IGA\n2026-10-27\nPAIN 3,99\nTPS 0,20\nTVQ 0,40\nTOTAL 4,59',expected:{store:'IGA',date:'2026-10-27',total:'4.59',tax:'0.60',balanced:true,lines:[{label:'PAIN',amount:'3.99',category:'Bakery'}]}},
  {id:'date',title:'Walmart · Nordamerikanisches Datum',titleEn:'Walmart · North American date',description:'Datum im Format MM/DD/YYYY',descriptionEn:'Date in MM/DD/YYYY format',text:'WALMART\n10/27/2026\nMILK 2L 5.49\nTOTAL 5.49',expected:{store:'Walmart',date:'2026-10-27',total:'5.49',tax:'0.00',balanced:true,lines:[{label:'MILK 2L',amount:'5.49',category:'Dairy & eggs'}]}},
 {id:'named-discount',title:'Sobeys · eindeutig zugeordneter Rabatt',titleEn:'Sobeys · named discount',description:'Rabatt benennt genau einen Artikel',descriptionEn:'A discount explicitly names exactly one purchased item',text:'SOBEYS\n2026-10-28\nAPPLES 4.00\nBREAD 3.00\nDISCOUNT APPLES -1.00\nTOTAL 6.00',expected:{store:'Sobeys',date:'2026-10-28',total:'6.00',tax:'0.00',balanced:true,lines:[{label:'APPLES',amount:'3.00'},{label:'BREAD',amount:'3.00'}]}},
 {id:'de-weight',title:'REWE · Wiegeware & Mehrwertsteuer',titleEn:'REWE · weight and inclusive VAT',description:'Gewicht auf Folgezeile, deutsche Datums- und Steuerlogik',descriptionEn:'Measured amount on the next line with German date and tax conventions',text:'REWE\n28.10.2026\nBANANEN\n0,842 kg x 1,79 €/kg = 1,51 €\nMWST 0,10 €\nSUMME 1,51 €',expected:{store:'REWE',date:'2026-10-28',total:'1.51',tax:'0.00',balanced:true,lines:[{label:'BANANEN 0,842 kg x 1,79 €/kg =',amount:'1.51',category:'Fruit'}]}},
 {id:'superstore-bayers-lake',title:'Atlantic Superstore · Mengenzeilen, Limits & ARCP',titleEn:'Atlantic Superstore · count lines, limits and ARCP',description:'Preis auf der Mengenzeile unter dem Artikel, Limit-Hinweise, ARCP-Rabatt, Stempel für 0,00 und Terminaldatum JJ/MM/TT',descriptionEn:'Price on the count line below the item, limit notes, ARCP markdown, 0.00 stamp line and YY/MM/DD terminal date',text:'REAL ATLANTIC\nSUPERSTORE\nBAYERS LAKE SUPERSTORE\n(902) 450-5317\nWelcome #\n21-GROCERY\n(2)06148306079 ROOSTER SUSHI MRJ\n2 @ $2.00 4.00\n06810090489 THREE CHSE DNR MRJ\n$1.00 lmt 6, $2.00 ea\n2 @ $1.00 ea 2.00\n88651800061 MARUKOME MISO MRJ\n$3.29 lmt 4, $3.99 ea\n1 @ $3.29 ea 3.29\n33-BAKERY INSTORE\n06024901631 WHITE BATARD MRJ 2.50\nARCP: ($2.50) -1.00\n34-BAKERY COMMERCIAL\n06340026083 D ITAL BUNS CRUS MRJ 4.00\n35-DELI\n06740062526 OKA MUSHROOMS AN MRJ 6.99\n41-HOME\n24632 PHY STAMP EARN Q 0.00\nDELI CHEESE 700 Pts\nTOTAL STORE REWARD 100 Pts\nSUBTOTAL 21. 78\nTOTAL 21. 78\nNumber of Items: 8\nTrans. Type: PURCHASE\nAccount: VISA CAD$ 21.78\nCard Type: CREDIT\nDateTime: 26/10/31 18:05:45\nRef. #: 103199\n00 APPROVED - THANK YOU\nCREDIT TN 21.78\nTotal Savings 1.00',expected:{store:'Atlantic Superstore',date:'2026-10-31',total:'21.78',tax:'0.00',balanced:true,lines:[{label:'ROOSTER SUSHI 2 @ $2.00',amount:'4.00',quantity:'2'},{label:'THREE CHSE DNR 2 @ $1.00 ea',amount:'2.00',quantity:'2'},{label:'MARUKOME MISO 1 @ $3.29 ea',amount:'3.29',quantity:'1'},{label:'WHITE BATARD',amount:'1.50',category:'Bakery'},{label:'D ITAL BUNS CRUS',amount:'4.00'},{label:'OKA MUSHROOMS AN',amount:'6.99'}]}}

];
export function checkReceiptFixture(draft:ReceiptDraft,fixture:ReceiptFixture){
  const expected=fixture.expected;
  const checks:{label:string;expected:string;actual:string;ok:boolean}[]=[];
  const add=(label:string,actual:unknown,wanted:unknown)=>checks.push({label,actual:String(actual??''),expected:String(wanted??''),ok:String(actual??'')===String(wanted??'')});
  add('Store',draft.store,expected.store);
  add('Date',draft.date,expected.date);
  add('Total',draft.total,expected.total);
  add('Tax',draft.tax,expected.tax);
  add('Number of items',draft.lines.length,expected.lines.length);
  expected.lines.forEach((line,index)=>{
    const actual=draft.lines[index];
    add('Item '+(index+1)+' / label',actual?.label,line.label);
    add('Item '+(index+1)+' / price',actual?.amount,line.amount);
    if(line.quantity!==undefined)add('Item '+(index+1)+' / quantity',actual?.quantity,line.quantity);
    if(line.category!==undefined)add('Item '+(index+1)+' / category',actual?.category,line.category);
  });
  const cents=(v:string)=>{const n=Number(v.replace(',','.'));return Number.isFinite(n)?Math.round(n*100):NaN;};
  const balanced=Boolean(draft.total)&&cents(draft.total)===cents(draft.tax)+draft.lines.reduce((sum,l)=>sum+cents(l.amount),0);
  add('Receipt balanced',balanced,expected.balanced);
  return checks;
}
