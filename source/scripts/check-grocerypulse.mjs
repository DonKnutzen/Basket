// One-off bounded smoke test for GroceryPulse's permitted, free personal shopper API.
const base='https://grocerypulse.ca';
const r=await fetch(base+'/api/shopper/catalog',{signal:AbortSignal.timeout(14000),headers:{Accept:'application/json'}});
if(!r.ok)throw Error('catalog HTTP '+r.status);
const catalog=await r.json();
console.log('CATALOG',JSON.stringify({cities:catalog.cities?.filter(x=>x.slug==='halifax'),items:catalog.items?.slice(0,3),storeKeys:catalog.stores?.slice(0,5),keys:Object.keys(catalog)}).slice(0,4500));
const p=await fetch(base+'/api/shopper/plan',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({city:'halifax',list:'2% milk 4L\nlarge eggs 12 pack',language:'en'}),signal:AbortSignal.timeout(18000)});
if(!p.ok)throw Error('plan HTTP '+p.status+' '+(await p.text()).slice(0,200));
const j=await p.json();
console.log('PLAN',JSON.stringify({keys:Object.keys(j),city:j.city,lines:j.lines?.slice(0,3),stores:j.stores?.slice(0,2),summary:j.summary,recommendation:j.recommendation,comparisonUrl:j.comparisonUrl}).slice(0,8500));