import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GROCERY_REGION, availableProviderStores, fetchQuebecPrices,
  normalizeEpiceriesProduct, normalizePostal, readGroceryRegion, searchTerm,
  type FetchLike, type GroceryRegion,
} from '../lib/regional-prices';

const qc: GroceryRegion={country:'CA',province:'QC',postalCode:'H2X 1Y4',preferredStores:[]};
const date='2026-10-26T12:00:00+00:00';
const now=new Date('2026-10-28T12:00:00Z');
function product(){
  return {id:'milk1',name:'Lait 2%',brand:'Québon',size:'2 L',prices:[
    {store:'maxi',price:4.99,size:'2 L',discounted:true,date},
    {store:'walmart',price:5.49,size:'2 L',discounted:false,date},
    {store:'sobeys',price:1.00,size:'2 L',discounted:true,date},
  ]};
}
test('region preferences validate country, province, postal code, and store ids',()=>{
  assert.equal(normalizePostal('CA','h2x1y4'),'H2X 1Y4');
  assert.equal(normalizePostal('DE','10115'),'10115');
  assert.equal(normalizePostal('CA','invalid'),'');
  assert.equal(normalizePostal('DE','1011'),'');
  assert.deepEqual(readGroceryRegion('not json'),DEFAULT_GROCERY_REGION);
  const value=readGroceryRegion(JSON.stringify({country:'CA',province:'QC',postalCode:'h2x1y4',preferredStores:['walmart','walmart','rewe','maxi']}));
  assert.deepEqual(value.preferredStores,['walmart','maxi']);
  assert.equal(value.postalCode,'H2X 1Y4');
});
test('only Quebec-enabled chains are queryable; unsupported favourites do not trigger scraping',()=>{
  assert.equal(availableProviderStores(DEFAULT_GROCERY_REGION).length,0);
  assert.equal(availableProviderStores({...qc,country:'DE',province:''}).length,0);
  assert.equal(availableProviderStores({...qc,preferredStores:['nofrills']}).length,0);
  assert.equal(availableProviderStores({...qc,preferredStores:['walmart']}).length,1);
  assert.equal(availableProviderStores(qc).length,6);
});
test('normalizes French/English/German product requests conservatively',()=>{
  assert.equal(searchTerm('Milk'),'lait');
  assert.equal(searchTerm('Milch'),'lait');
  assert.equal(searchTerm('Tomaten'),'tomate');
  assert.equal(searchTerm('Potatoes'),'pomme de terre');
  assert.equal(searchTerm('Pasta Gluten Free'),'pasta gluten free');
});
test('normalizes source prices, excludes unsupported chains and displays reliable basis',()=>{
  const normalized=normalizeEpiceriesProduct(product(),qc,now)!;
  assert.equal(normalized.prices.length,2);
  assert.equal(normalized.prices[0].priceCents,499);
  assert.equal(normalized.prices[0].unitPriceCents,250);
  assert.equal(normalized.prices[0].unit,'L');
  assert.equal(normalized.prices[0].discounted,true);
  assert.equal(normalized.prices[1].priceCents,549);
  assert.equal(normalizeEpiceriesProduct(product(),{...qc,province:'NS'},now),null);
});
test('excludes stale observations, invalid values and future-dated data',()=>{
  const stale={...product(),prices:[{store:'maxi',price:2,size:'2 L',date:'2026-09-30T00:00:00Z'}]};
  assert.equal(normalizeEpiceriesProduct(stale,qc,now),null);
  const invalid={...product(),prices:[{store:'maxi',price:NaN,size:'2 L',date}]};
  assert.equal(normalizeEpiceriesProduct(invalid,qc,now),null);
  const future={...product(),prices:[{store:'maxi',price:2,size:'2 L',date:'2026-11-12T00:00:00Z'}]};
  assert.equal(normalizeEpiceriesProduct(future,qc,now),null);
});
test('integration adapter issues only two documented API GETs and no requests for unsupported regions',async()=>{
  const requests:string[]=[];
  const mock:FetchLike=async(url)=>{
    requests.push(url);
    return {ok:true,json:async()=>url.includes('endpoint=search')
      ? {ok:true,data:{results:[{id:'milk1',name:'Lait 2%'},{id:'other1',name:'Laitue romaine'}]}}
      : {ok:true,data:product()}};
  };
  const result=await fetchQuebecPrices('Milk',qc,mock,now);
  assert.equal(result?.prices.length,2);
  assert.equal(requests.length,2);
  assert.ok(requests[0].startsWith('https://epiceries.ca/api?endpoint=search&q=lait'));
  assert.ok(requests[1].endsWith('endpoint=product&id=milk1'));
  assert.equal(await fetchQuebecPrices('Milk',{...qc,province:'NS'},mock,now),null);
  assert.equal(requests.length,2);
});
test('never silently matches a lettuce or potato product for milk or apples',async()=>{
  const onlyLettuce:FetchLike=async()=>({ok:true,json:async()=>({ok:true,data:{results:[{id:'lettuce',name:'Laitue romaine'}]}})});
  assert.equal(await fetchQuebecPrices('Milk',qc,onlyLettuce,now),null);
  const potato:FetchLike=async()=>({ok:true,json:async()=>({ok:true,data:{results:[{id:'potato',name:'Pomme de terre blanche'}]}})});
  assert.equal(await fetchQuebecPrices('Apple',qc,potato,now),null);
});
