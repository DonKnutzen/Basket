import {test} from 'node:test';
import assert from 'node:assert/strict';
import {periodRange,previousRange,receiptCurrencies,spendingStats,timeline} from '../lib/spending-stats';
import type {PriceLine,Receipt} from '../lib/types';

const receipt=(id:string,store:string,date:string,totalCents:number,currency='CAD',taxCents=0):Receipt=>({id,store,date,totalCents,taxCents,currency,createdBy:'u'});
const line=(receiptId:string,store:string,date:string,productName:string,amountCents:number,category:string,extra:Partial<PriceLine>={}):PriceLine=>({id:receiptId+productName,receiptId,productId:productName,label:productName.toUpperCase(),quantity:1,amountCents,category,packSize:'',store,date,currency:'CAD',productName,...extra});

const receipts=[
 receipt('r1','Atlantic Superstore','2026-10-03',2000,'CAD',100),
 receipt('r2','Sobeys','2026-10-10',3000),
 receipt('r3','Atlantic Superstore','2026-10-24',1500),
 receipt('r4','Sobeys','2026-09-15',1000),
 receipt('r5','REWE','2026-10-12',900,'EUR'),
];
const lines=[
 line('r1','Atlantic Superstore','2026-10-03','Milk',600,'Dairy & eggs',{packSize:'4 L'}),
 line('r1','Atlantic Superstore','2026-10-03','Chips',400,'Snacks & sweets'),
 line('r1','Atlantic Superstore','2026-10-03','Chicken thighs',900,'Meat & fish',{measuredQuantity:'1',measuredUnit:'kg'}),
 line('r2','Sobeys','2026-10-10','Milk',700,'Dairy & eggs',{packSize:'4 L'}),
 line('r2','Sobeys','2026-10-10','Chicken thighs',2300,'Meat & fish',{measuredQuantity:'2',measuredUnit:'kg'}),
 line('r3','Atlantic Superstore','2026-10-24','Milk',660,'Dairy & eggs',{packSize:'4 L'}),
 line('r3','Atlantic Superstore','2026-10-24','Chips',840,'Snacks & sweets',{quantity:2}),
 line('r4','Sobeys','2026-09-15','Milk',650,'Dairy & eggs',{packSize:'4 L'}),
 line('r5','REWE','2026-10-12','Milch',900,'Dairy & eggs'),
];
const data={receipts,lines};

test('period ranges cover calendar months and compare with the preceding period',()=>{
 assert.deepEqual(periodRange('month','2026-02'),{from:'2026-02-01',to:'2026-02-28'});
 assert.deepEqual(periodRange('3m','','2026-01-15'),{from:'2025-11-01',to:'2026-01-31'});
 assert.deepEqual(previousRange('3m',{from:'2025-11-01',to:'2026-01-31'}),{from:'2025-08-01',to:'2025-10-31'});
 assert.deepEqual(previousRange('month',periodRange('month','2026-03')),{from:'2026-02-01',to:'2026-02-28'});
 assert.equal(previousRange('all',periodRange('all','')),null);
 assert.deepEqual(receiptCurrencies(receipts),['CAD','EUR']);
});
test('monthly totals, trips, categories and stores never mix currencies',()=>{
 const s=spendingStats(data,'month','2026-10','CAD','2026-10-31');
 assert.equal(s.totalCents,6500);assert.equal(s.trips,3);assert.equal(s.averageTripCents,2167);assert.equal(s.taxCents,100);
 assert.equal(s.previousTotalCents,1000);
 assert.deepEqual(s.categories.map(c=>[c.name,c.cents]),[['Meat & fish',3200],['Dairy & eggs',1960],['Snacks & sweets',1240]]);
 assert.deepEqual(s.categories[1].products,[{name:'Milk',cents:1960}]);
 assert.deepEqual(s.stores.map(x=>[x.name,x.cents,x.trips]),[['Sobeys',3000,1],['Atlantic Superstore',3500,2]].sort((a,b)=>(b[1] as number)-(a[1] as number)));
 assert.equal(s.products[0].name,'Chicken thighs');assert.equal(s.products[0].cents,3200);
 assert.equal(spendingStats(data,'month','2026-10','EUR','2026-10-31').totalCents,900);
});
test('store comparison uses the same product per kg or per identical pack',()=>{
 const s=spendingStats(data,'month','2026-10','CAD','2026-10-31');
 const chicken=s.comparisons.find(c=>c.name==='Chicken thighs')!;
 assert.equal(chicken.unit,'kg');
 assert.deepEqual(chicken.stores.map(x=>[x.store,x.unitCents]),[['Atlantic Superstore',900],['Sobeys',1150]]);
 const milk=s.comparisons.find(c=>c.name==='Milk')!;
 assert.deepEqual(milk.stores.map(x=>[x.store,x.unitCents]),[['Atlantic Superstore',158],['Sobeys',169]]);assert.equal(milk.unit,'L');
 assert.ok(!s.comparisons.some(c=>c.name==='Chips'),'one store only');
 assert.equal(s.storeIndex[0].store,'Atlantic Superstore');assert.ok(s.storeIndex[0].index<100);assert.ok(s.storeIndex[1].index>100);
});
test('price changes compare the latest with the previous purchase at the same store',()=>{
 const s=spendingStats(data,'all','','CAD','2026-10-31');
 const milk=s.changes.find(c=>c.name==='Milk'&&c.store==='Atlantic Superstore')!;
 assert.equal(milk.previousCents,150);assert.equal(milk.latestCents,165);assert.ok(Math.abs(milk.change-0.1)<1e-9);
 const chips=s.changes.find(c=>c.name==='Chips')!;assert.equal(chips.latestCents,420);assert.ok(chips.change>0);
});
test('timeline uses weeks for short ranges and months for long ones, keeping empty periods',()=>{
 const month=timeline(receipts.filter(r=>r.currency==='CAD'&&r.date.startsWith('2026-10')),periodRange('month','2026-10'),'2026-10-31');
 assert.equal(month.unit,'week');assert.equal(month.buckets[0].from,'2026-09-28');
 assert.equal(month.buckets.reduce((s,b)=>s+b.cents,0),6500);assert.ok(month.buckets.some(b=>b.cents===0));
 const year=timeline(receipts.filter(r=>r.currency==='CAD'),periodRange('12m','','2026-10-31'),'2026-10-31');
 assert.equal(year.unit,'month');assert.equal(year.buckets.length,12);assert.equal(year.buckets[11].cents,6500);assert.equal(year.buckets[10].cents,1000);
});
