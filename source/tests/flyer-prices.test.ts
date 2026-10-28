import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 extractFlyerCandidates,FLYER_STORAGE_KEY,flyerMatches,isDay,priceCents,
 readPrivateFlyers,writePrivateFlyers,type FlyerPrice
} from '../lib/flyer-prices';
const today='2026-10-28';
const good:FlyerPrice={id:'1',name:'REWE frische Vollmilch',packSize:'1 L',priceCents:109,
 store:'rewe',validFrom:'2026-10-26',validUntil:'2026-10-31',
 region:'Kiel',sourceFile:'angebot.pdf',importedAt:'2026-10-28'};
test('price parser supports German euro punctuation but rejects free text',()=>{
 assert.equal(priceCents('1,99 €'),199);assert.equal(priceCents('1.99'),199);
 assert.equal(priceCents('0,00'),null);assert.equal(priceCents('19'),null);
 assert.equal(priceCents('15,999'),null);
 assert.equal(priceCents('99999,00'),null);
});
test('extract candidate only with plausible product and single same-line price',()=>{
 const found=extractFlyerCandidates([
  'REWE Vollmilch 1 L 1,09 €',
  'ALDI Eier Bodenhaltung 10 Stück 2,49 €',
  'statt 3,49 € jetzt 1,99 €',
  'Gültig Montag bis Samstag 26.10.2026',
  '2,99 €',
  'Kartoffeln 5 kg 2,99 €',
  'Grundpreis 1 kg 3,99 €',
  'Kartoffeln 5 kg 2,99 €'
 ].join('\n'));
 assert.deepEqual(found.map(f=>f.price),['1,09','2,49','2,99']);
 assert.equal(found[0].packSize,'1 L');
 assert.match(found[1].name,/Eier/);
});
test('require dates, price and retailer; expired offers not loaded',()=>{
 const values:any[]=[good,{...good,id:'2',validUntil:'2026-10-27'},
  {...good,id:'3',validFrom:'2026-10-50'},{...good,id:'4',store:'unknown'}];
 const stored={getItem:(_:string)=>JSON.stringify(values)};
 assert.equal(readPrivateFlyers(stored,today).length,1);
 assert.equal(isDay('2026-02-29'),false);
 assert.equal(isDay('2026-10-31'),true);
});
test('save retains deduplicated, reviewed device-local offers only',()=>{
 const saved:{value:string}={value:''};
 const storage={getItem:(_:string)=>saved.value,setItem:(k:string,v:string)=>{assert.equal(k,FLYER_STORAGE_KEY);saved.value=v}};
 assert.equal(writePrivateFlyers(storage,[good,good],[],today),1);
 assert.equal(readPrivateFlyers(storage,today).length,1);
 assert.equal(writePrivateFlyers(storage,[{...good,name:'Äpfel',id:'5'}],readPrivateFlyers(storage,today),today),2);
 assert.equal(readPrivateFlyers(storage,'2026-11-01').length,0);
 assert.throws(()=>writePrivateFlyers(storage,[{...good,priceCents:0}],[],today));
});
test('matches only on valid dates, region and selected retailer',()=>{
 const list=[good,{...good,id:'2',name:'Schokomilch',priceCents:69},{...good,id:'3',name:'Kartoffeln 5 kg',priceCents:299,store:'aldi' as const}];
 assert.deepEqual(flyerMatches('Milch',list,today,['rewe']).map(x=>x.id),['1']);
 assert.deepEqual(flyerMatches('Kartoffeln',list,today,['aldi']).map(x=>x.id),['3']);
 assert.deepEqual(flyerMatches('Milch',list,'2026-11-01'),[]);
 assert.deepEqual(flyerMatches('Milch',list,'2026-10-25'),[]);
 assert.deepEqual(flyerMatches('Milch',list,today,['lidl']),[]);
});
