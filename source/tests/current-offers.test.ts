import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 DEFAULT_OFFER_REGION,GERMAN_OFFER_CITIES,officialGermanFlyers,lookupActiveOffers,normalizeBidouDeal,offerSearchTerm,
 providerAvailable,restoreOfferRegion,type OfferFetch,type OfferRegion,
} from '../lib/current-offers';
const now=new Date('2026-10-28T13:00:00Z');
const qc:OfferRegion={country:'CA',province:'QC',postalCode:'',stores:[]};
const on:OfferRegion={...qc,province:'ON'};
const valid={name:'Lait 2%',store:'Maxi',price:3.49,regular_price:4.99,
 valid_from:'2026-10-26',valid_until:'2026-10-31',observed_at:'2026-10-27',
 source_url:'https://bidou.store/en/api',size:'2 L'};
test('no lookup outside approved regions or with unsupported selection',async()=>{
 assert.equal(providerAvailable(DEFAULT_OFFER_REGION),true);
 assert.equal(providerAvailable({...qc,country:'DE',province:''}),false);
 assert.equal(providerAvailable({...qc,stores:['sobeys']}),false);
 assert.equal(providerAvailable(qc),true);
 assert.equal(providerAvailable({...on,stores:['nofrills']}),true);
 let calls=0;const mock:OfferFetch=async()=>{calls++;return {ok:true,json:async()=>({})}};
 assert.deepEqual(await lookupActiveOffers('Milk',{...DEFAULT_OFFER_REGION,province:'NB'},mock,now),[]);
 assert.deepEqual(await lookupActiveOffers('Milch',{...qc,country:'DE',province:''},mock,now),[]);
 assert.equal(calls,0);
});
test('region settings retain only selected local retailers',()=>{
 assert.deepEqual(restoreOfferRegion('bad json'),DEFAULT_OFFER_REGION);
 assert.deepEqual(restoreOfferRegion(JSON.stringify({country:'DE',province:'QC',stores:['rewe','walmart','rewe'],postalCode:'10115'})),
  {country:'DE',province:'',postalCode:'10115',stores:['rewe'],city:'Kiel'});
});
test('short bilingual names map to a single, on-demand product search',()=>{
 assert.equal(offerSearchTerm('Milk'),'lait');
 assert.equal(offerSearchTerm('Milch'),'lait');
 assert.equal(offerSearchTerm('Eier'),'oeufs');
 assert.equal(offerSearchTerm('Tomaten'),'tomate');
});
test('valid weekly discounts include verifiable fields and expected currency',()=>{
 const deal=normalizeBidouDeal(valid,'Milk',qc,now);
 assert.ok(deal); assert.equal(deal?.priceCents,349);assert.equal(deal?.regularCents,499);
 assert.equal(deal?.validUntil,'2026-10-31');assert.equal(deal?.currency,'CAD');
 assert.equal(deal?.storeId,'maxi');assert.equal(deal?.packSize,'2 L');
 assert.equal(deal?.sourceUrl,'https://bidou.store/en/api');
});
test('never show expired, stale, future, wrong-store or unverified prices as current deals',()=>{
 assert.equal(normalizeBidouDeal({...valid,valid_until:'2026-10-27'},'Milk',qc,now),null);
 assert.equal(normalizeBidouDeal({...valid,observed_at:'2026-10-10'},'Milk',qc,now),null);
 assert.equal(normalizeBidouDeal({...valid,valid_from:'2026-10-30'},'Milk',qc,now),null);
 assert.equal(normalizeBidouDeal({...valid,valid_until:'2026-13-99'},'Milk',qc,now),null);
 assert.equal(normalizeBidouDeal({...valid,valid_until:undefined},'Milk',qc,now),null);
 assert.equal(normalizeBidouDeal({...valid,price:4.99,regular_price:4.99},'Milk',qc,now),null);
 assert.equal(normalizeBidouDeal({...valid,store:'Sobeys'},'Milk',qc,now),null);
 assert.equal(normalizeBidouDeal({...valid,store:'Maxi'},'Milk',{...qc,stores:['walmart']},now),null);
 assert.equal(normalizeBidouDeal({...valid,name:'Lait au chocolat'},'Milk',qc,now),null);
 assert.equal(normalizeBidouDeal({...valid,name:'Boîte de chocolat au lait'},'Milk',qc,now),null);
});
test('filter unsafe source links without losing truthful promo metadata',()=>{
 const d=normalizeBidouDeal({...valid,source_url:'javascript:alert(1)',member_only:true},'Milk',qc,now);
 assert.equal(d?.sourceUrl,'https://bidou.store/en/api');
 assert.equal(d?.loyalty,true);
});
test('a targeted search performs at most two documented API reads',async()=>{
 const urls:string[]=[];
 const mock:OfferFetch=async(url)=>{
  urls.push(url);
  return {ok:true,json:async()=>url.includes('/products?')?
   {data:[{name:'Lait 2%',upc:'1234567890'},{name:'Laitue',upc:'2222222'}]}:
   {data:{prices:[valid,{...valid,store:'IGA',price:4.19}]}}};
 };
 const rows=await lookupActiveOffers('Milk',qc,mock,now);
 assert.equal(urls.length,2);
 assert.match(urls[0],/\/api\/v1\/products\?q=lait/);
 assert.match(urls[1],/\/api\/v1\/prices\/1234567890\?province=QC/);
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(r=>r.storeId),['maxi','iga']);
});
test('no verified current data means empty results, not guessed savings',async()=>{
 const mock:OfferFetch=async(url)=>({ok:true,json:async()=>url.includes('/products?')?
  {products:[{name:'Lait 2%',upc:'1234567890'}]}:{prices:[{...valid,valid_until:null}]}});
 assert.deepEqual(await lookupActiveOffers('Milk',qc,mock,now),[]);
});

test('Germany is explicitly Kiel-scoped with two selected public-weekly sources; no Bidou feed',async()=>{
 const de=restoreOfferRegion(JSON.stringify({country:'DE',city:'Hamburg',stores:[]}));
 assert.equal(de.city,'Kiel');
 assert.equal(GERMAN_OFFER_CITIES.length,1);
 assert.equal(GERMAN_OFFER_CITIES[0].id,'Kiel');
 assert.equal(providerAvailable(de),false);
 const all=officialGermanFlyers(de);
 assert.equal(all.length,2);
 assert.deepEqual(de.stores,['rewe','aldi']);
 assert.deepEqual(all.map(f=>f.id),['rewe','aldi']);
 assert.ok(all.every(v=>v.url.startsWith('https://')));
 assert.deepEqual(officialGermanFlyers({...de,stores:['rewe']} ).map(v=>v.id),['rewe']);
 assert.deepEqual(officialGermanFlyers({...de,stores:['walmart']}),[]);
 assert.deepEqual(officialGermanFlyers({...de,city:'Berlin'}),[]);
 assert.deepEqual(officialGermanFlyers(DEFAULT_OFFER_REGION),[]);
 let calls=0;
 assert.deepEqual(await lookupActiveOffers('Butter',de,async()=>{calls++;throw Error('should not fetch')},now),[]);
 assert.equal(calls,0);
});

test('REWE Kiel flyer link is for the selected Holtenauer Str. market, not another branch',()=>{
 const kiel={country:'DE',province:'',postalCode:'',stores:['rewe'],city:'Kiel'} as const;
 const links=officialGermanFlyers({...kiel,stores:['rewe']});
 assert.equal(links.length,1);
 assert.match(links[0].url,/\/angebote\/kiel\/561204\//);
 assert.match(links[0].url,/holtenauer-str-69-71/);
});
