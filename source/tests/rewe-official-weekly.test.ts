import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseReweWeeklyData,matchRewePartialOffers,berlinDay} from '../lib/rewe-official-weekly';
const sourceUrl='https://view.publitas.com/89773/3478778/pdfs/61827fae-6411-4697-a44c-0fca78d9da08.pdf';
const valid={
 schema:1,marketId:'561204',city:'Kiel',store:'rewe',
 validFrom:'2026-10-26',validUntil:'2026-10-31',checkedAt:'2026-10-28',
 sourceUrl,sourceType:'official-pdf',coverage:'partial',status:'partial',
 offers:[{id:'rewe:561204:1:rispentomaten:189',name:'Rispentomaten',priceCents:189,
  packSize:'1 kg',store:'rewe',marketId:'561204',page:1,confidence:'category-only'}]
};
test('accept only bounded official REWE Kiel market and current flyer facts',()=>{
 assert.ok(parseReweWeeklyData(valid));
 assert.equal(parseReweWeeklyData({...valid,marketId:'830872'}),null);
 assert.equal(parseReweWeeklyData({...valid,sourceUrl:'https://evil.example/other.pdf'}),null);
 assert.equal(parseReweWeeklyData({...valid,offers:[{...valid.offers[0],priceCents:0}]}),null);
 assert.equal(parseReweWeeklyData({...valid,offers:Array(41).fill(valid.offers[0])}),null);
 assert.equal(parseReweWeeklyData({...valid,validUntil:'2026-02-30'}),null);
});
test('generic list items match only current week and correct store, never branded variants',()=>{
 const source=parseReweWeeklyData(valid);
 const date=new Date('2026-10-28T13:00:00Z');
 assert.equal(matchRewePartialOffers('Tomaten',source,[],date).length,1);
 assert.equal(matchRewePartialOffers('Rispentomaten',source,['rewe'],date).length,1);
 assert.equal(matchRewePartialOffers('Cherry-Tomaten',source,['rewe'],date).length,0);
 assert.equal(matchRewePartialOffers('Tomaten',source,['aldi'],date).length,0);
 assert.equal(matchRewePartialOffers('Tomaten',source,[],new Date('2026-11-01T13:00:00Z')).length,0);
 assert.equal(matchRewePartialOffers('Tomaten',parseReweWeeklyData({...valid,status:'unavailable'}),[],date).length,0);
 assert.equal(berlinDay(date),'2026-10-28');
});
