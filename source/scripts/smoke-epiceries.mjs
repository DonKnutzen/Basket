// One explicit optional smoke test, never run by the app itself.
const base='https://epiceries.ca/api?endpoint=';
const ask=async(url)=>{const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('Provider status '+r.status);const j=await r.json();if(j.ok!==true)throw Error('Provider returned error');return j.data;};
const search=await ask(base+'search&q=lait&limit=50');
if(!Array.isArray(search.results)||!search.results.length)throw Error('No API search results');
const item=search.results.find(x=>typeof x.id==='string' && typeof x.name==='string' && /^laits?(?:\s|$)/i.test(x.name));
if(!item)throw Error('No primary milk product in initial search results; do not use a chocolate false match');
const detail=await ask(base+'product&id='+encodeURIComponent(item.id));
if(!Array.isArray(detail.prices))throw Error('No per-store prices in documented response');
console.log(JSON.stringify({provider:'epiceries.ca',query:'lait',product:item.name,shops:detail.prices.length,sampleDate:detail.prices[0]?.date||null}));
