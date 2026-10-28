// One-off public Open Prices coverage check. Zero personal data, credentials or scraping.
const base='https://prices.openfoodfacts.org/api/v1';
const queries=[
  ['NS locations','/locations?osm_address_city__like=Halifax&size=5'],
  ['DE locations','/locations?osm_address_city__like=Berlin&size=5'],
  ['Recent CAD prices','/prices?currency=CAD&date__gte=2026-10-01&size=3'],
  ['Recent EUR prices','/prices?currency=EUR&date__gte=2026-10-01&size=3'],
];
for(const [kind,path] of queries){
  try{
    const response=await fetch(base+path,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const raw=await response.json();
    if(!raw||!Array.isArray(raw.items))throw new Error('Unexpected JSON shape');
    console.log(JSON.stringify({
      query:kind,items:raw.items.length,total:raw.total??null,
      cors:response.headers.get('access-control-allow-origin'),
      example:raw.items.slice(0,2).map(x=>({
        id:x.id, date:x.date, productName:x.product_name||x.product?.product_name,
        locationName:x.location?.osm_name||x.osm_name,
        city:x.location?.osm_address_city||x.osm_address_city,
        postcode:x.location?.osm_address_postcode||x.osm_address_postcode,
        currency:x.currency
      }))
    }));
  }catch(e){console.log(JSON.stringify({query:kind,error:String(e)}))}
}
