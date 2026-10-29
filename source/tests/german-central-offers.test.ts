import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseGermanOffer,matchCentralGermanOffers,compactGermanOfferMatches,germanPack,germanSourceUrl,untilBerlinMidnight,suggestGermanCategory,type GermanOffer} from '../lib/german-central-offers';
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

test('PENNY regional offers coexist with REWE and ALDI and respect retailer filters',()=>{
 const penny:GermanOffer={...offer,id:'penny-kiel',retailer:'penny',marketId:null,brand:'PENNY',name:'Butter',category:'Butter',priceCents:159,
  sourceUrl:'https://penny-publish.blaetterkatalog.de/frontend/catalogs/1408356/3/pdf/complete.pdf'};
 const rewe:GermanOffer={...offer,id:'rewe',retailer:'rewe',brand:'Kerrygold',name:'Butter',category:'Butter',priceCents:159};
 const aldi:GermanOffer={...offer,id:'aldi',retailer:'aldi-nord',marketId:null,brand:'Weihenstephan',name:'Butter',category:'Butter',priceCents:149};
 assert.equal(parseGermanOffer(penny)?.retailer,'penny');
 assert.equal(matchCentralGermanOffers('Butter',[penny,rewe,aldi],[],now).length,3);
 assert.deepEqual(matchCentralGermanOffers('Butter',[penny,rewe,aldi],['penny'],now).map(x=>x.offer.retailer),['penny']);
 assert.equal(parseGermanOffer({...penny,marketId:'561204'}),null);
 assert.equal(germanSourceUrl('https://penny-publish.blaetterkatalog.de/frontend/catalogs/1408356/3/pdf/complete.pdf'),penny.sourceUrl);
 assert.equal(germanSourceUrl('https://evil.example/frontend/catalogs/1408356/3/pdf/complete.pdf'),null);
 assert.equal(germanSourceUrl('https://penny-publish.blaetterkatalog.de/frontend/catalogs/1408356/3/pdf/complete.pdf?url=https://evil.example'),null);
});
test('PENNY pilot facts remain identifiable and still require verified evidence',()=>{
 const penny:GermanOffer={...offer,id:'penny-test',retailer:'penny',marketId:null,brand:'Coca-Cola',
  name:'Coca-Cola Erfrischungsgetränk',variant:'Original',category:'Cola',
  packSize:'1,25 l',priceCents:119,testOnly:true,
  sourceUrl:'https://penny-publish.blaetterkatalog.de/frontend/catalogs/1408356/3/pdf/complete.pdf'};
 const app={...penny,id:'penny-app',priceCents:99,priceKind:'loyalty' as const,conditions:'Nur mit PENNY App'};
 assert.equal(parseGermanOffer(penny)?.testOnly,true);
 assert.equal(parseGermanOffer({...penny,validationStatus:'review'}),null);
 assert.equal(parseGermanOffer({...penny,testOnly:'yes'}),null);
 assert.deepEqual(new Set(matchCentralGermanOffers('Cola',[penny,app],['penny'],now).map(x=>x.offer.priceCents)),new Set([99,119]));
 assert.equal(matchCentralGermanOffers('Cola',[penny,app],['aldi'],now).length,0);
 assert.equal(matchCentralGermanOffers('Cola',[penny,app],[],new Date('2026-11-01T02:00:00Z')).length,0);
});

test('generic drink requests include variants while named variants require printed evidence',()=>{
 const regular:GermanOffer={...offer,id:'cola',retailer:'penny',marketId:null,brand:'Coca-Cola',name:'Cola Original',category:'Cola',packSize:'1,25 l',priceCents:119};
 const zero:GermanOffer={...regular,id:'zero',name:'Cola Zero',priceCents:99,priceKind:'loyalty',conditions:'Mit PENNY App'};
 const cherry:GermanOffer={...regular,id:'cherry',name:'Cola Cherry'};
 assert.deepEqual(new Set(matchCentralGermanOffers('Cola',[regular,zero,cherry],[],now).map(x=>x.offer.id)),new Set(['cola','zero','cherry']));
 assert.deepEqual(new Set(matchCentralGermanOffers('Coca cola',[regular,zero,cherry],[],now).map(x=>x.offer.id)),new Set(['cola','zero','cherry']));
 for(const query of ['Cola Zero','Coca Cola Zero','Coke Zero'])
  assert.deepEqual(matchCentralGermanOffers(query,[regular,zero,cherry],[],now).map(x=>x.offer.id),['zero']);
 assert.deepEqual(matchCentralGermanOffers('Cola Cherry',[regular,zero,cherry],[],now).map(x=>x.offer.id),['cherry']);
 assert.equal(matchCentralGermanOffers('Coke Zero',[regular],[],now).length,0);
 const redBull:GermanOffer={...regular,id:'red-bull',brand:'Red Bull',name:'Energy Drink',category:'Energydrink',packSize:'250 ml'};
 const redBullZero:GermanOffer={...redBull,id:'red-bull-zero',name:'Energy Drink Zero'};
 assert.equal(matchCentralGermanOffers('Red Bull',[redBull,redBullZero],[],now).length,2);
 assert.deepEqual(matchCentralGermanOffers('Red Bull Zero',[redBull,redBullZero],[],now).map(x=>x.offer.id),['red-bull-zero']);
});
test('ALDI 2 l Original Taste and Zero compete fairly with PENNY 1,25 l prices',()=>{
 const aldi:GermanOffer={...offer,id:'aldi-cola-2l',retailer:'aldi-nord',marketId:null,brand:'Coca-Cola',
   name:'Coca-Cola Erfrischungsgetränk',variant:'Original Taste / Zero',category:'Cola',
   packSize:'2 l',priceCents:129,regularPrice:'2,19',testOnly:true,sourceUrl:'https://magazine.aldi-nord.de/aldi-nord/aldi-aktuell/2026/2026cw44mopromotionaldi-angebote-ab-montag-26-10-1//GetPDF.ashx',
   validUntil:'2026-10-30'};
 const penny:GermanOffer={...aldi,id:'penny-cola',retailer:'penny',brand:'Coca-Cola',variant:'Original',
   packSize:'1,25 l',priceCents:119,sourceUrl:'https://penny-publish.blaetterkatalog.de/frontend/catalogs/1408356/3/pdf/complete.pdf'};
 const app={...penny,id:'penny-app',priceCents:99,priceKind:'loyalty' as const,conditions:'Nur mit PENNY App'};
 assert.equal(parseGermanOffer(aldi)?.packSize,'2 l');
 assert.equal(matchCentralGermanOffers('Cola',[aldi,penny,app],['aldi'],now).length,1);
 assert.deepEqual(matchCentralGermanOffers('Coca Cola Zero 2 l',[aldi,penny,app],[],now).map(x=>x.offer.id),['aldi-cola-2l']);
 assert.deepEqual(matchCentralGermanOffers('Coke Zero',[aldi,penny,app],[],now).map(x=>x.offer.id),['aldi-cola-2l']);
 assert.deepEqual(matchCentralGermanOffers('Coca Cola 2 l',[aldi,penny,app],[],now).map(x=>x.kind),['exact','alternative','alternative']);
 const listings=compactGermanOfferMatches(matchCentralGermanOffers('Cola',[aldi,penny,app],[],now));
 assert.deepEqual(new Set(listings.map(m=>m.offer.id)),new Set(['aldi-cola-2l','penny-cola','penny-app']));
 assert.equal(listings.find(m=>m.offer.id==='aldi-cola-2l')?.offer.priceCents,129);
 assert.equal(listings.find(m=>m.offer.id==='penny-app')?.offer.priceKind,'loyalty');
 assert.equal(matchCentralGermanOffers('Cola',[aldi,penny,app],[],new Date('2026-10-31T12:00:00Z')).length,0);
});
