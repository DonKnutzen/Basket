import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchGermanDrafts,parseGermanDraft,searchGermanDraftCatalogue,unverifiedOfferCount,compactGermanDraftTitle} from '../lib/german-offer-drafts';
import {priceFromPrintedBase,tentativeCorrectedPrice} from '../lib/german-base-price';

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
 const unknownPack=parseGermanDraft(raw('Cola Original',{data:{...raw('Cola Original').data,packSize:'2 l / 1 l'}}),job);
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
 const mentos=parseGermanDraft(raw('Mentos Kaudragees, z. B. Cola',{id:'mentos',data:{...raw('Mentos Kaudragees, z. B. Cola').data,brand:'Mentos',packSize:'190 g'}}),job);
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
  data:{...raw('Große Früchte Kl. 1 Neuseeland SunGold Kiwi').data,brand:'',packSize:'',priceCents:0}}),job);
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

test('long Red Bull OCR text is compact but the full original stays available',()=>{
 const long='IM AUFSTELLER RED BULL Energydrink Koffein- und taurinhaltig; verschiedene Sorten, z. B. Classic oder Winter Edition, Pistachio & Berries; 0,25 l';
 const out=compactGermanDraftTitle(long,'',84);
 assert.equal(out.truncated,true);
 assert.ok(out.title.length<=84);
 assert.ok(out.title.includes('RED BULL'));
 assert.equal(out.full,long);
 assert.ok(out.title.endsWith('…'));
 assert.equal(compactGermanDraftTitle('SunGold Kiwi','').truncated,false);
});
test('the brand is only added when missing from the printed title',()=>{
 assert.equal(compactGermanDraftTitle('Coca-Cola Original Taste','Coca-Cola').full,'Coca-Cola Original Taste');
 assert.equal(compactGermanDraftTitle('Original Taste','Coca-Cola').full,'Coca-Cola · Original Taste');
});

test('Kiwi with printed Stück and 59-cent price is a clearly unverified price suggestion',()=>{
 const proposal=parseGermanDraft(raw('SunGold Kiwi Klasse 1; Neuseeland; Stück',{
  id:'kiwi-per-piece',page:1,issues:[
   'Marke nicht eindeutig als Text erkannt',
   'Keine eindeutige Packungsgröße erkannt',
   'Angebotszeitraum mit dem Prospekt abgleichen',
  ],
  data:{...raw('').data,brand:'',name:'SunGold Kiwi Klasse 1; Neuseeland; Stück',
   packSize:'',priceCents:59,priceKind:'standard'}
 }),job);
 assert.ok(proposal);
 assert.equal(proposal.packSize,'1 Stück');
 assert.equal(proposal.unitInferred,true);
 assert.equal(proposal.priceCents,59);
 assert.equal(proposal.priceUsable,true);
 assert.equal(proposal.status,'review');
 assert.ok(proposal.issues.includes('Einheit aus Produkttext erschlossen; Original prüfen'));
});
test('loose bananas are per kg, not per item, and misassigned prices are blocked',()=>{
 const base={...raw('').data,brand:'',name:'unverpackt Bananen; Ecuador kg-Preis',packSize:'',priceCents:119,priceKind:'standard'};
 const safe=parseGermanDraft(raw(base.name,{data:base,issues:['Keine eindeutige Packungsgröße erkannt']}),job);
 assert.ok(safe);
 assert.equal(safe.packSize,'1 kg');
 assert.equal(safe.priceUsable,true);
 assert.equal(matchGermanDrafts('Bananen',[safe],[],now).length,1);
 const ambiguous=parseGermanDraft(raw(base.name,{data:base,issues:['Mehrere Verkaufspreise / Produkte im selben Bereich']}),job);
 assert.ok(ambiguous);
 assert.equal(ambiguous.priceUsable,false);
 const ocr=parseGermanDraft(raw(base.name,{data:base,issues:['Niedrige OCR-Zuverlässigkeit']}),job);
 assert.ok(ocr);
 assert.equal(ocr.priceUsable,false);
 const mixed=parseGermanDraft(raw('Bananen; Stück und kg-Preis',{data:{...base,name:'Bananen; Stück und kg-Preis'},issues:[]}),job);
 assert.ok(mixed);
 assert.equal(mixed.packSize,'');
 assert.equal(mixed.priceUsable,false);
});
test('a food category never inherits misleading unit guesses from promotional text',()=>{
 const title='Bio-Frischkäse mit Rezeptvorschlag und vielen Stück für Stück Ideen';
 const candidate=parseGermanDraft(raw(title,{data:{...raw('').data,name:title,brand:'',packSize:'',priceCents:149}}),job);
 assert.ok(candidate);
 assert.equal(candidate.packSize,'');
 assert.equal(candidate.priceUsable,false);
});

test('ALDI Red Bull 0,25 l: a mistaken 25-cent bottle-size price is replaced only by an explicitly labelled computed preview',()=>{
 const row=parseGermanDraft(raw('IM AUFSTELLER RED BULL Energydrink Koffein- und taurinhaltig; versch. Sorten',{id:'red-bull',
  status:'review',page:9,issues:[
   'Marke nicht eindeutig als Text erkannt',
   'Grundpreis passt rechnerisch nicht zu Preis / Menge',
   'Angebotszeitraum mit dem Prospekt abgleichen',
  ],
  data:{...raw('').data,name:'IM AUFSTELLER RED BULL Energydrink',brand:'',packSize:'0,25 L',
   priceCents:25,basePrice:'(Liter = 3.56)',priceKind:'standard'}
 }),job);
 assert.ok(row);
 assert.equal(row.priceCents,25,'private OCR source must not be silently overwritten');
 assert.equal(row.priceUsable,true);
 assert.equal(row.priceFromBase,true);
 assert.equal(row.displayPriceCents,89,'0.25 l x 3.56 EUR/l = 0.89 EUR estimate');
 assert.equal(row.status,'review','must never approve the price automatically');
});
test('base-price calculations are deterministic and reject conflicting or unsupported evidence',()=>{
 assert.equal(priceFromPrintedBase('(Liter = 3.56)','0,25 l'),89);
 assert.equal(priceFromPrintedBase('(1 kg = 7.16)','250 g'),179);
 assert.equal(priceFromPrintedBase('(1 l = 0,95 €)','1,25 l'),119);
 assert.equal(priceFromPrintedBase('(1 kg = 9,99)','0,25 l'),null);
 assert.equal(priceFromPrintedBase('(Liter = 3.56); (Liter = 5.50)','0,25 l'),null);
 assert.equal(priceFromPrintedBase('','0,25 l'),null);
 assert.equal(priceFromPrintedBase('(Liter = 3.56)','0,25 l / 0,5 l'),null);
 assert.equal(priceFromPrintedBase('(Liter = 3.56)','1 Stück'),null);
 assert.equal(tentativeCorrectedPrice(25,'(Liter = 3.56)','0,25 l','loyalty','review',
  ['Grundpreis passt rechnerisch nicht zu Preis / Menge']),null);
 assert.equal(tentativeCorrectedPrice(25,'(Liter = 3.56)','0,25 l','standard','unreadable',
  ['Grundpreis passt rechnerisch nicht zu Preis / Menge']),null);
 for(const block of ['Mehrere Verkaufspreise / Produkte im selben Bereich',
  'Preisspalte nur als Prüfbereich getrennt; Produkt und Preis am Original bestätigen',
  'Keine eindeutige Kachelgrenze; Originalbereich prüfen','OCR: Preisziffern prüfen']){
  assert.equal(tentativeCorrectedPrice(25,'(Liter = 3.56)','0,25 l','standard','review',
   ['Grundpreis passt rechnerisch nicht zu Preis / Menge',block]),null,block);
 }
 const clean=parseGermanDraft(raw('Coca-Cola 1,25 l',{
  data:{...raw('').data,name:'Coca-Cola',packSize:'1,25 l',priceCents:119,basePrice:'1 l = 0,95 €'}
 }),job);
 assert.ok(clean);
 assert.equal(clean.priceFromBase,false);
 assert.equal(clean.displayPriceCents,119);
});

test('Lachs never matches cream cheese, sushi or salmon-flavoured prepared foods',()=>{
 const draft=(name:string,id:string)=>parseGermanDraft(raw(name,{id,data:{...raw('').data,name,brand:'',packSize:'100 g',priceCents:149}}),job)!;
 const fish=draft('Meine Lieblinge Bio-Graved Lachs oder Bio-Lachs','fish');
 const cream=draft('Eigene Herstellung Frischkäsecreme mit Lachs und Dill','cream');
 const sushi=draft('Sushi Maki-Mix Lachs oder Avocado','sushi');
 assert.equal(cream.categoryHint,'Frischkäse');
 assert.deepEqual(matchGermanDrafts('Lachs',[fish,cream,sushi],[],now).map(x=>x.id),['fish']);
 assert.deepEqual(matchGermanDrafts('Salmon',[fish,cream,sushi],[],now).map(x=>x.id),['fish']);
 assert.deepEqual(matchGermanDrafts('Frischkäse',[cream],[],now).map(x=>x.id),['cream']);
});
test('shared prepared-food exclusions reject raw ingredient false positives',()=>{
 for(const [query,title] of [['Paprika','Kartoffelchips mit Paprika'],['Tomaten','Tomaten Suppe'],['Kartoffeln','Kartoffeln Püree'],['Butter','Butter Blätterteig']]){
  const d=parseGermanDraft(raw(title,{data:{...raw('').data,name:title,brand:'',packSize:'250 g'}}),job)!;
  assert.equal(matchGermanDrafts(query,[d],[],now).length,0,query+' vs '+title);
 }
});
