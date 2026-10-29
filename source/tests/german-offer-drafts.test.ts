import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchGermanDrafts,parseGermanDraft,searchGermanDraftCatalogue} from '../lib/german-offer-drafts';

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
