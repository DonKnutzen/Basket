import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseGermanOffer,matchCentralGermanOffers,germanPack,germanSourceUrl,untilBerlinMidnight,suggestGermanCategory,type GermanOffer} from '../lib/german-central-offers';
const now=new Date('2026-10-28T12:00:00Z');
const offer:GermanOffer={id:'one',importId:'import',name:'Original Irische Butter',brand:'Kerrygold',variant:'',category:'Butter',packSize:'250 g',
 priceCents:159,currency:'EUR',conditions:'',priceKind:'standard',minQuantity:1,validFrom:'2026-10-26',validUntil:'2026-10-31',
 retailer:'rewe',region:'Kiel',marketId:'561204',page:13,bbox:[212,0,476,249],sourceUrl:'https://view.publitas.com/test.pdf',sourceStatus:'checked-at-import',sourceCheckedAt:'2026-10-28T12:00:00Z',sourceFilename:'flyer.pdf',validationStatus:'verified'};
test('real REWE vine tomatoes match German singular and plural without losing the advertised variety',()=>{
 const tomatoes={...offer,id:'tomatoes',brand:'',name:'Rispentomaten',category:'Tomaten',packSize:'1 kg',priceCents:189};
 assert.equal(suggestGermanCategory('Niederlande: Rispentomaten Kl. I,')?.de,'Tomaten');
 for(const query of ['Tomate','Tomaten','Rispentomaten']){
  const matches=matchCentralGermanOffers(query,[tomatoes],[],now);
  assert.equal(matches.length,1);assert.equal(matches[0].offer.name,'Rispentomaten');assert.equal(matches[0].offer.priceCents,189);
 }
 assert.equal(matchCentralGermanOffers('Tomate',[{...tomatoes,name:'Tomatensauce'}],[],now).length,0);
 assert.equal(matchCentralGermanOffers('Tomaten',[tomatoes],[],new Date('2026-11-01T12:00:00Z')).length,0);
});
test('central feed validates verified provenance, market, cents, conditions, dates and bounding boxes',()=>{
 assert.ok(parseGermanOffer(offer));
 for(const change of [{validationStatus:'review'},{currency:'CAD'},{marketId:'other'},{region:'Hamburg'},{priceCents:1.59},{validUntil:'2026-02-30'},{category:'unknown'},{bbox:[0,0,Infinity,2]},{sourceUrl:'https://evil.example/pdf'},{priceKind:'loyalty',conditions:''},{priceKind:'multi',minQuantity:1,conditions:'2 für 3 €'}])assert.equal(parseGermanOffer({...offer,...change}),null);
 assert.equal(germanSourceUrl('https://www.rewe.de@evil.example/x'),null);
 assert.equal(germanSourceUrl('https://www.rewe.de/x#page=13'),null);
 assert.equal(germanSourceUrl('https://www.rewe.de:444/x'),null);
});
test('both grocers match a generic item while specific brands and sizes retain identity',()=>{
 const aldi:GermanOffer={...offer,id:'aldi',retailer:'aldi-nord',marketId:null,brand:'Weihenstephan',name:'Butter',priceCents:149};
 assert.equal(matchCentralGermanOffers('Butter',[offer,aldi],[],now).length,2);
 const exact=matchCentralGermanOffers('Kerrygold Butter 250 g',[offer,aldi],[],now);
 assert.equal(exact.length,1);assert.equal(exact[0].kind,'exact');assert.equal(exact[0].offer.brand,'Kerrygold');
 assert.equal(matchCentralGermanOffers('Kerrygold Butter 500 g',[offer],[],now)[0].kind,'alternative');
 assert.equal(matchCentralGermanOffers('Butter',[offer,aldi],['aldi'],now)[0].offer.id,'aldi');
 assert.equal(matchCentralGermanOffers('Butter',[offer],[],new Date('2026-10-31T23:01:00Z')).length,0);
});
test('a category never matches a different prepared product, flavour or snack',()=>{
 for(const name of ['Butterkekse','Schokomilch','Paprikachips','Reispudding','Tomatensoße','Kartoffelchips','Käsecracker'])assert.equal(matchCentralGermanOffers(name,[offer],[],now).length,0);
 assert.equal(matchCentralGermanOffers('Landliebe Butter 250 g',[offer],[],now).length,0);
 for(const name of ['Butterkekse','Butter Blätterteig','Butterkuchen','Buttermilch'])assert.equal(matchCentralGermanOffers('Butter',[{...offer,name}],[],now).length,0);
});
test('ambiguous pack alternatives have no invented unit price and multi-buy totals retain their conditions',()=>{
 assert.equal(germanPack('2 l oder 4 l'),null);assert.equal(germanPack('150 g / 250 g'),null);
 assert.deepEqual(germanPack('2 x 250 g'),{amount:.5,unit:'kg'});
 assert.deepEqual(germanPack('750 ml'),{amount:.75,unit:'l'});
 const multi={...offer,priceCents:300,minQuantity:2,priceKind:'multi',conditions:'2 Packungen für 3,00 €'};
 assert.ok(parseGermanOffer(multi));assert.equal(parseGermanOffer(multi)?.priceCents,300);
});
test('sorting compares known package unit prices rather than cheap-looking different pack prices',()=>{
 const bigger={...offer,id:'bigger',packSize:'1 kg',priceCents:499};
 assert.equal(matchCentralGermanOffers('Butter',[offer,bigger],[],now)[0].offer.id,'bigger');
});
test('existing lists expire at Berlin midnight, including the 23 and 25 hour daylight-saving days',()=>{
 assert.equal(untilBerlinMidnight(new Date('2026-03-28T23:00:00Z')),23*3600000);
 assert.equal(untilBerlinMidnight(new Date('2026-10-24T22:00:00Z')),25*3600000);
});
test('generic German milk, yogurt and cheese remain supported when the shared catalogue only lists subtypes',()=>{
 const yogurt={...offer,id:'yogurt',brand:'Danone',name:'Activia Joghurt',category:'Joghurt'};
 assert.ok(parseGermanOffer(yogurt));
 assert.equal(matchCentralGermanOffers('Joghurt',[yogurt],[],now).length,1);
 assert.equal(matchCentralGermanOffers('Yogurt',[yogurt],[],now).length,1);
 const milk={...offer,id:'milk',name:'Vollmilch',category:'Milch'};
 assert.ok(parseGermanOffer(milk));assert.equal(matchCentralGermanOffers('Milch',[milk],[],now).length,1);
});
