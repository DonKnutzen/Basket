import {type ReceiptDraft} from './types';

export type ReceiptFixture = {
  id:string; title:string; description:string; text:string;
  expected:{store:string;date:string;total:string;tax:string;lines:{label:string;amount:string;quantity?:string;category?:string}[];balanced:boolean};
};
export const RECEIPT_FIXTURES:ReceiptFixture[] = [
  {id:'basic',title:'No Frills · Standard',description:'Drei Artikel ohne Steuern',text:'NO FRILLS\n2026-10-27\nMILK 2L 5.49\nEGGS 12PK 4.49\nBANANAS 1.69\nSUBTOTAL 11.67\nHST 0.00\nTOTAL 11.67',expected:{store:'No Frills',date:'2026-10-27',total:'11.67',tax:'0.00',balanced:true,lines:[{label:'MILK 2L',amount:'5.49'},{label:'EGGS 12PK',amount:'4.49'},{label:'BANANAS',amount:'1.69',category:'Produce'}]}},
  {id:'quantities',title:'Sobeys · Mengen & Steuer',description:'Mehrere Einheiten und HST',text:'SOBEYS\n2026-10-27\n2 x BANANAS 3.38\nBREAD 3.49\nHST 0.45\nTOTAL 7.32',expected:{store:'Sobeys',date:'2026-10-27',total:'7.32',tax:'0.45',balanced:true,lines:[{label:'2 x BANANAS',amount:'3.38',quantity:'2',category:'Produce'},{label:'BREAD',amount:'3.49',category:'Bakery'}]}},
  {id:'discount',title:'Walmart · Rabatt',description:'Ein Rabatt muss den bezahlten Gesamtbetrag ausgleichen',text:'WALMART\n2026-10-27\nAPPLES 4.00\nCOUPON -1.00\nTOTAL 3.00',expected:{store:'Walmart',date:'2026-10-27',total:'3.00',tax:'0.00',balanced:true,lines:[{label:'APPLES',amount:'3.00',category:'Produce'}]}},
  {id:'weight',title:'Gateway · Wiegeware',description:'Kilogramm-Menge und Artikelgesamtpreis',text:'GATEWAY\n2026-10-27\nBANANAS 0.765KG 1.88\nTOTAL 1.88',expected:{store:'Gateway',date:'2026-10-27',total:'1.88',tax:'0.00',balanced:true,lines:[{label:'BANANAS 0.765KG',amount:'1.88',quantity:'0.765',category:'Produce'}]}},
  {id:'french',title:'IGA · Komma & Québec-Steuern',description:'Französische Artikel und TPS/TVQ',text:'IGA\n2026-10-27\nPAIN 3,99\nTPS 0,20\nTVQ 0,40\nTOTAL 4,59',expected:{store:'IGA',date:'2026-10-27',total:'4.59',tax:'0.60',balanced:true,lines:[{label:'PAIN',amount:'3.99',category:'Bakery'}]}},
  {id:'date',title:'Walmart · Nordamerikanisches Datum',description:'Datum im Format MM/DD/YYYY',text:'WALMART\n10/27/2026\nMILK 2L 5.49\nTOTAL 5.49',expected:{store:'Walmart',date:'2026-10-27',total:'5.49',tax:'0.00',balanced:true,lines:[{label:'MILK 2L',amount:'5.49',category:'Dairy & eggs'}]}}
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
