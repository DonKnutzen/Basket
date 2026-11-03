import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAmount,weightText,pricePerUnit,weightForPrice,convertUnitPrice,WEIGHED_CATEGORIES} from '../lib/unit-price';
import {comparisonBasis} from '../lib/price-history';
import {spendingStats} from '../lib/spending-stats';
import type {PriceLine,Receipt} from '../lib/types';

test('weight gives the price per kg, and the price per kg gives the weight',()=>{
 assert.equal(parseAmount('0,856'),0.856);assert.ok(Number.isNaN(parseAmount('abc')));assert.ok(Number.isNaN(parseAmount('0')));
 assert.equal(pricePerUnit(299,0.856),349);
 const w=weightForPrice(299,'3.49');assert.equal(weightText(w),'0.856734');
 assert.equal(pricePerUnit(299,Number(weightText(w))),349);
 assert.ok(Number.isNaN(weightForPrice(299,'')));
});
test('prices per lb and per kg convert both ways',()=>{
 assert.equal(convertUnitPrice(1000,'kg','lb'),454);assert.equal(convertUnitPrice(454,'lb','kg'),1001);assert.equal(convertUnitPrice(500,'kg','kg'),500);
 assert.ok(WEIGHED_CATEGORIES.has('Fruit')&&WEIGHED_CATEGORIES.has('Veggies')&&WEIGHED_CATEGORIES.has('Meat & fish'));
});
test('a weight in lb is remembered as a price per kg for store comparisons',()=>{
 const basis=comparisonBasis({quantity:1,packSize:'',amountCents:454,measuredQuantity:'1',measuredUnit:'lb'});
 assert.equal(basis?.unit,'kg');assert.equal(basis?.cents,1001);
});
test('kilo prices list weighed products even when bought at one store only',()=>{
 const receipt=(id:string,store:string,date:string):Receipt=>({id,store,date,totalCents:1000,taxCents:0,currency:'EUR',createdBy:'u'});
 const line=(receiptId:string,store:string,name:string,amountCents:number,kg:string):PriceLine=>({id:receiptId+name,receiptId,productId:name,label:name,quantity:1,amountCents,category:'Fruit',packSize:'',store,date:'2026-10-05',currency:'EUR',productName:name,measuredQuantity:kg,measuredUnit:'kg'});
 const s=spendingStats({receipts:[receipt('a','REWE','2026-10-05'),receipt('b','Aldi','2026-10-06')],lines:[line('a','REWE','Bananen',150,'0.75'),line('b','Aldi','Bananen',99,'0.9'),line('a','REWE','Kiwi',300,'0.5')]},'month','2026-10','EUR','2026-10-31');
 assert.deepEqual(s.unitPrices.map(c=>[c.name,c.unit,c.stores.map(x=>[x.store,x.unitCents])]),[['Bananen','kg',[['Aldi',110],['REWE',200]]],['Kiwi','kg',[['REWE',600]]]]);
 assert.deepEqual(s.comparisons.map(c=>c.name),['Bananen']);
 assert.equal(s.unitPrices[0].category,'Fruit');
});
