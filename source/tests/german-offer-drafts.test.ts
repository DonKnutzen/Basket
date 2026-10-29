import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchGermanDrafts,parseGermanDraft,searchGermanDraftCatalogue,unverifiedOfferCount} from '../lib/german-offer-drafts';

const job={id:'a-1',retailer:'aldi-nord',region:'Kiel',filename:'aldi.pdf',source_url:'https://magazine.aldi-nord.de/2026/sample/GetPDF.ashx',valid_from:'2026-10-26',valid_until:'2026-10-30'};
const raw=(name:string,changes:Record<string,unknown>={})=>({
 id:'cand-1',page:38,status:'review',issues:['Angebotszeitraum mit dem Prospekt abgleichen'],
 data:{name,brand:'Coca-Cola',category:'',packSize:'2 L',priceCents:129,priceKind:'standard',conditions:'',validFrom:'2026-10-26',validUntil:'2026-10-30'},
 ...changes
});
const now=new Date('2026-10-29T12:00:00Z');
test('never treat unverified PDF candidates as verified/public offers',()=>{
 const p=parseGermanDraft(raw('Original Taste oder Zero'),job);
 assert.ok(p);
 assert.equal(p.status,'review');
 assert.equal(p.categoryHint,'Cola');
 assert.equal(p.priceCents,129);
 assert.equal(p.priceUsable,true);
 assert.deepEqual(matchGermanDrafts('Cola Zero',[p],['aldi'],now).map(d=>d.id),['cand-1']);
 assert.equal(matchGermanDrafts('Cola Zero',[p],['penny'],now).length,0);
 assert.equal(matchGermanDrafts('Cola Zero',[p],[],new Date('2026-11-01T12:00:00Z')).length,0);
 assert.equal(parseGermanDraft(raw('Cola',{status:'verified'}),job),null);
});
test('ambiguous prices and unreadable crops never display tentative amounts',()=>{
 const unclear=parseGermanDraft(raw('Cola Original', {issues:['Mehrere Verkaufspreise / Produkte im selben Bereich']}),job);
 assert.ok(unclear);
 assert.equal(unclear.priceUsable,false);
 const unreadable=parseGermanDraft(raw('Cola Original',{status:'unreadable'}),job);
 assert.ok(unreadable);
 assert.equal(unreadable.priceUsable,false);
 const unknownPack=parseGermanDraft(raw('Cola Original',{data:{...raw('').data,packSize:'2 l / 1 l'}}),job);
 assert.ok(unknownPack);
 assert.equal(unknownPack.priceUsable,false);
 assert.equal(parseGermanDraft(raw('Cola Original'),{...job,region:'Hamburg'}),null);
 const unnamed=parseGermanDraft(raw('',{status:'unreadable',data:{...raw('').data,name:''}}),job);
 assert.ok(unnamed);
 assert.equal(unnamed.priceUsable,false);
 assert.equal(unnamed.name,'Unlesbarer Bereich auf Seite 38');
 assert.equal(matchGermanDrafts('Cola',[unnamed],[],now).length,0);
 assert.equal(searchGermanDraftCatalogue('',[unnamed],[],now).length,1);
});
test('do not match cola candy, unrelated brands or wrong pack sizes',()=>{
 const soda=parseGermanDraft(raw('Coca-Cola Zero'),job);
 const mentos=parseGermanDraft(raw('Mentos Kaudragees, z. B. Cola',{id:'mentos',data:{...raw('').data,brand:'Mentos',packSize:'190 g'}}),job);
 assert.ok(soda&&mentos);
 assert.deepEqual(matchGermanDrafts('Cola',[soda,mentos],[],now).map(x=>x.id),['cand-1']);
 assert.deepEqual(matchGermanDrafts('Coke Zero 2 l',[soda,mentos],[],now).map(x=>x.id),['cand-1']);
 assert.equal(matchGermanDrafts('Coca Cola Zero 1,25 l',[soda],[],now).length,0);
});
test('cross-page operator catalogue finds identified and as-yet uncategorized items',()=>{
 const milk=parseGermanDraft(raw('Vollmilch',{id:'milk',page:4,data:{...raw('').data,brand:'',name:'Vollmilch',packSize:'1 l',priceCents:95}}),{...job,retailer:'penny'});
 const cheese=parseGermanDraft(raw('Gouda',{id:'cheese',page:12,data:{...raw('').data,brand:'',name:'Gouda',packSize:'250 g',priceCents:199}}),job);
 assert.ok(milk&&cheese);
 assert.deepEqual(searchGermanDraftCatalogue('Gouda',[milk,cheese],[],now).map(x=>x.id),['cheese']);
 assert.deepEqual(searchGermanDraftCatalogue('Milch',[milk,cheese],['penny'],now).map(x=>x.id),['milk']);
});

test('user-facing labels are singular/plural and never call an unchecked region a confirmed offer',()=>{
 assert.equal(unverifiedOfferCount(1,true),'1 ungeprüftes Angebot');
 assert.equal(unverifiedOfferCount(2,true),'2 ungeprüfte Angebote');
 assert.equal(unverifiedOfferCount(1,false),'1 unverified offer');
 assert.equal(unverifiedOfferCount(3,false),'3 unverified offers');
});
test('Kiwi with a recognizable product but uncertain price remains searchable without a confirmed price',()=>{
 const candidate=parseGermanDraft(raw('Große Früchte Kl. 1 Neuseeland SunGold Kiwi',{id:'kiwi',page:1,
  issues:['Marke nicht eindeutig als Text erkannt','Keine eindeutige Packungsgröße erkannt'],
  data:{...raw('').data,brand:'',packSize:'',priceCents:0}}),job);
 assert.ok(candidate);
 assert.equal(candidate.priceUsable,false);
 assert.equal(candidate.name.includes('Kiwi'),true);
 assert.deepEqual(searchGermanDraftCatalogue('Kiwi',[candidate],[],now).map(d=>d.id),['kiwi']);
});

test('authenticated read-only flyer projection remains a searchable unverified Kiwi item',()=>{
 const shared={
  id:'c-kiwi',import_id:'import-a',page:1,status:'unreadable',
  data:{name:'Große Früchte Kl. 1 Neuseeland SunGold Kiwi',brand:'',packSize:'',priceCents:0,priceKind:'standard',
   validFrom:'2026-10-26',validUntil:'2026-10-30'},
  issues:['Keine eindeutige Packungsgröße erkannt'],
  retailer:'aldi-nord',region:'Kiel',filename:'aldi.pdf',
  source_url:'https://magazine.aldi-nord.de/2026/sample/GetPDF.ashx',
  valid_from:'2026-10-26',valid_until:'2026-10-30',
 };
 const item=parseGermanDraft(shared,{
  id:shared.import_id,retailer:shared.retailer,region:shared.region,
  filename:shared.filename,source_url:shared.source_url,
  valid_from:shared.valid_from,valid_until:shared.valid_until
 });
 assert.ok(item);
 assert.equal(item.name.includes('SunGold Kiwi'),true);
 assert.equal(item.status,'unreadable');
 assert.equal(item.priceUsable,false);
 assert.equal(searchGermanDraftCatalogue('Kiwi',[item],[],now).length,1);
});
