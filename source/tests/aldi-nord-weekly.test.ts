import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchAldiWeeklyOffers,parseAldiWeeklyData} from '../lib/aldi-nord-weekly';

const checked=new Date('2026-10-28T13:00:00Z');
const product={id:'aldi:nord:1013323:2026-10-26',category:'Aubergine',name:'Aubergine',
 brand:'',packSize:'Stück',priceCents:59,validFrom:'2026-10-26',
 validUntil:'2026-10-31',store:'aldi',confidence:'category-only'};
const valid={schema:1,region:'Kiel',store:'aldi',coverage:'partial',status:'partial',
 checkedAt:'2026-10-28',sourceUrl:'https://www.aldi-nord.de/angebote.html',offers:[product]};
test('validated limited ALDI offers include source, date and product evidence',()=>{
 const d=parseAldiWeeklyData(valid);
 assert.ok(d);assert.equal(d?.offers[0].priceCents,59);
 assert.equal(parseAldiWeeklyData({...valid,region:'Berlin'}),null);
 assert.equal(parseAldiWeeklyData({...valid,sourceUrl:'https://example.com/angebote.html'}),null);
 assert.equal(parseAldiWeeklyData({...valid,offers:[{...product,priceCents:0}]}),null);
 assert.equal(parseAldiWeeklyData({...valid,offers:[{...product,name:'x'.repeat(101)}]}),null);
 assert.equal(parseAldiWeeklyData({...valid,offers:[{...product,validUntil:'2026-02-30'}]}),null);
 assert.equal(parseAldiWeeklyData({...valid,offers:Array(51).fill(product)}),null);
});
test('only current valid ALDI prices match the selected grocer and generic category',()=>{
 const d=parseAldiWeeklyData(valid);
 assert.equal(matchAldiWeeklyOffers('Aubergine',d,['aldi'],checked).length,1);
 assert.equal(matchAldiWeeklyOffers('Auberginen',d,[],checked).length,1);
 assert.equal(matchAldiWeeklyOffers('Aubergine',d,['rewe'],checked).length,0);
 assert.equal(matchAldiWeeklyOffers('Bio Aubergine',d,['aldi'],checked).length,0);
 assert.equal(matchAldiWeeklyOffers('Aubergine',d,['aldi'],new Date('2026-11-02T12:00:00Z')).length,0);
 assert.equal(matchAldiWeeklyOffers('Aubergine',parseAldiWeeklyData({...valid,checkedAt:'2026-10-20'}),[],checked).length,0);
 assert.equal(matchAldiWeeklyOffers('Aubergine',parseAldiWeeklyData({...valid,status:'unavailable'}),[],checked).length,0);
 assert.equal(matchAldiWeeklyOffers('Aubergine',parseAldiWeeklyData({...valid,offers:[{...product,validFrom:'2026-11-01',validUntil:'2026-11-07'}]}),[],checked).length,0);
});
test('multiple same-category items are sorted but never labelled as the same SKU',()=>{
 const d=parseAldiWeeklyData({...valid,offers:[
  product,{...product,id:'aldi:nord:1013324:2026-10-26',name:'Aubergine XXL',priceCents:119}
 ]});
 assert.deepEqual(matchAldiWeeklyOffers('Aubergine',d,[],checked).map(x=>x.priceCents),[59,119]);
});
