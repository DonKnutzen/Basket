import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAmount,weightText,pricePerUnit,weightForPrice,convertUnitPrice,WEIGHED_CATEGORIES,isWeighable,weightPrices,packWeight} from '../lib/unit-price';
import {comparisonBasis} from '../lib/price-history';
import {spendingStats} from '../lib/spending-stats';
import type {PriceLine,Receipt} from '../lib/types';

test('a weight in lb, kg or g gives the same price per kg and lb',()=>{
 assert.deepEqual(weightPrices(500,0.5,'kg'),{kg:1000,lb:454});
 assert.deepEqual(weightPrices(500,500,'g'),{kg:1000,lb:454});
 assert.equal(weightPrices(454,1,'lb')?.lb,454);assert.equal(weightPrices(454,1,'lb')?.kg,1001);
 assert.equal(weightPrices(500,NaN,'kg'),null);assert.equal(weightPrices(500,0,'g'),null);
});
test('ounces convert correctly: 16 oz are 1 lb, 1 oz is 28.35 g',()=>{
 assert.deepEqual(weightPrices(1000,16,'oz'),{kg:2205,lb:1000});
 assert.deepEqual(weightPrices(250,4,'oz'),weightPrices(250,0.25,'lb'));
 assert.equal(weightPrices(1000,1,'oz')?.kg,35274);
 assert.deepEqual(packWeight('16 oz'),{quantity:'16',unit:'oz'});
 const oz=comparisonBasis({quantity:1,packSize:'',amountCents:1000,measuredQuantity:'16',measuredUnit:'oz'}),lb=comparisonBasis({quantity:1,packSize:'',amountCents:1000,measuredQuantity:'1',measuredUnit:'lb'});
 assert.equal(oz?.unit,'kg');assert.equal(oz?.cents,lb?.cents);assert.equal(oz?.cents,2205);
 assert.equal(comparisonBasis({quantity:2,packSize:'8 oz',amountCents:1000})?.cents,2205);
});
test('loose food and bulk nuts are weighable, packaged goods are not',()=>{
 for(const [c,n] of [['Fruit','Apples'],['Veggies','Carrots'],['Meat & fish','Chicken'],['Snacks & sweets','Cashews'],['Pantry','Walnüsse'],['Snacks & sweets','Erdnüsse geröstet'],['Pantry','Almonds'],['Other','Haselnuss gemahlen']])assert.equal(isWeighable(c,n),true,n);
 for(const [c,n] of [['Snacks & sweets','Chips'],['Pantry','Erdnussbutter'],['Pantry','Peanut butter'],['Drinks','Almond milk'],['Snacks & sweets','Nuss Nougat Creme'],['Snacks & sweets','Haselnuss Schokolade'],['Household','Nut cracker']])assert.equal(isWeighable(c,n),false,n);
});
test('a weight typed as pack size is read back, anything else is left alone',()=>{
 assert.deepEqual(packWeight('500 g'),{quantity:'500',unit:'g'});assert.deepEqual(packWeight('1,5kg'),{quantity:'1.5',unit:'kg'});
 assert.equal(packWeight('2 L'),null);assert.equal(packWeight('6 x 100 g'),null);assert.equal(packWeight(''),null);
});
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
