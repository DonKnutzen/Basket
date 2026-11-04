import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {parseReceipt} from '../lib/receipt-parser';
import {dateFromPasses} from '../lib/receipt-ocr';
import {normalize} from '../lib/types';

// Real OCR output from phone photos (tests/receipt-ocr-corpus/*.txt) with hand-checked
// expectations (*.json). Raise MIN_* when the parser improves; never lower them.
const MIN_TOTAL_RATE=1,MIN_ITEMS_RATE=9/10;
type Expected={store:string;date:string;total:string;tax:string;items:{label:string;amount:string}[]};
const dir='tests/receipt-ocr-corpus';

export function scoreCorpusEntry(text:string,expected:Expected,dateText?:string){
 const d=dateFromPasses(parseReceipt(text),{text,confidence:0,dateText});
 const remaining=[...d.lines];
 const itemsOk=expected.items.every(item=>{const i=remaining.findIndex(l=>l.amount===item.amount&&normalize(l.label).includes(normalize(item.label)));if(i<0)return false;remaining.splice(i,1);return true})&&!remaining.length;
 return {total:d.total===expected.total,items:itemsOk,store:d.store===expected.store,date:d.date===expected.date,tax:d.tax===expected.tax,draft:d};
}

test('OCR corpus hit rate',()=>{
 const files=readdirSync(dir).filter(f=>f.endsWith('.txt')).sort();
 assert.ok(files.length>0);
 let totals=0,items=0;const report:string[]=[];
 for(const f of files){
  const expected=JSON.parse(readFileSync(`${dir}/${f.replace(/\.txt$/,'.json')}`,'utf8')) as Expected;
  const passes=`${dir}/${f.replace(/\.txt$/,'.passes')}`;
  const s=scoreCorpusEntry(readFileSync(`${dir}/${f}`,'utf8'),expected,existsSync(passes)?readFileSync(passes,'utf8'):undefined);
  totals+=+s.total;items+=+s.items;
  report.push(`${f}: total ${s.total?'✓':'✕ '+s.draft.total} · items ${s.items?'✓':'✕ '+s.draft.lines.map(l=>l.label+'='+l.amount).join(' | ')} · store ${s.store?'✓':'✕'} · date ${s.date?'✓':'✕'} · tax ${s.tax?'✓':'✕'}`);
 }
 console.log(`OCR corpus: total ${totals}/${files.length}, items ${items}/${files.length}\n`+report.join('\n'));
 assert.ok(totals/files.length>=MIN_TOTAL_RATE,'total hit rate dropped');
 assert.ok(items/files.length>=MIN_ITEMS_RATE,'item hit rate dropped');
});

// *.passes holds the text of every OCR pass (band re-reads included) when the chosen text lost
// the date: Kaufland "Datum:02.11.26" and Shell "DATE: 2026/10/31" were only read there.
test('OCR corpus dates from all passes and fuel price per litre',()=>{
 const files=readdirSync(dir).filter(f=>f.endsWith('.passes'));
 assert.ok(files.length>0);
 for(const f of files){
  const name=f.replace(/\.passes$/,''),expected=JSON.parse(readFileSync(`${dir}/${name}.json`,'utf8')) as Expected&{fuel?:{litres:string;pricePerLitre:string}};
  const text=readFileSync(`${dir}/${name}.txt`,'utf8'),d=dateFromPasses(parseReceipt(text),{text,confidence:0,dateText:readFileSync(`${dir}/${f}`,'utf8')});
  assert.equal(d.date,expected.date,name);assert.equal(d.dateEvidence?.status,'recognized',name);
  if(expected.fuel){const fuel=d.lines.find(l=>l.category==='Fuel');assert.equal(fuel?.measuredQuantity,expected.fuel.litres,name);assert.equal(fuel?.unitPrice,expected.fuel.pricePerLitre,name)}
 }
});
