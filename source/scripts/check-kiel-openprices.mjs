// One small Kiel-only Open Prices coverage probe, no bulk collection.
const api='https://prices.openfoodfacts.org/api/v1';
const call=async(path)=>{const r=await fetch(api+path,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status+' '+path);return r.json();};
const locations=await call('/locations?osm_address_city__like=Kiel&size=15');
console.log('KIEL_LOCATIONS',JSON.stringify({total:locations.total,locations:locations.items?.map(x=>({id:x.id,name:x.osm_name||x.osm_display_name,city:x.osm_address_city,postcode:x.osm_address_postcode,priceCount:x.price_count})).slice(0,15)}));
const candidates=(locations.items||[]).filter(x=>Number(x.price_count)>0).slice(0,3);
for(const loc of candidates){const prices=await call('/prices?currency=EUR&location_id='+loc.id+'&date__gte=2026-09-28&size=10&order_by=-date');console.log('KIEL_RECENT_PRICES',JSON.stringify({locationId:loc.id,total:prices.total,items:prices.items?.slice(0,3).map(x=>({id:x.id,product_name:x.product_name,date:x.date,price:x.price,currency:x.currency,discount:x.price_is_discounted,locationId:x.location_id}))}));}
