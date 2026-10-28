// Bounded, public read-only discovery of opt-in shopping offer interfaces.
// Not part of the shipped app. No retailer scraping or internal endpoints.
const endpoints=[
  ["bidou-specials","https://bidou.store/api/v1/widgets/circulaire?region=QC-MTL"],
  ["bidou-top","https://bidou.store/api/v1/widgets/top-rabais?region=QC-MTL"],
  ["bidou-search","https://bidou.store/api/v1/products?q=lait&limit=2&province=QC"],
  ["bidou-rss","https://bidou.store/flux/rabais-qc-en.xml"],
  ["allelebensmittel-agents","https://cfw.allelebensmittel.de/agents"],
  ["allelebensmittel-search","https://cfw.allelebensmittel.de/shopping/v1/search?q=milch&limit=2"],
];
function safeSummary(value){
 if(!value||typeof value!=="object")return String(value).slice(0,150);
 if(Array.isArray(value))return {length:value.length,first:value.slice(0,2).map(safeSummary)};
 return {keys:Object.keys(value).slice(0,35),sample:Object.fromEntries(Object.entries(value).slice(0,8).map(([k,v])=>[k,typeof v==="object"?safeSummary(v):String(v).slice(0,160)]))};
}
for(const [name,url] of endpoints){
 try{
  const res=await fetch(url,{signal:AbortSignal.timeout(9000),headers:{Accept:name==="bidou-rss"?"application/rss+xml":"application/json"}});
  const mime=res.headers.get("content-type")||"";
  const body=await res.text();let sample;
  if(mime.includes("json")){try{sample=safeSummary(JSON.parse(body))}catch{sample=body.slice(0,180)}}else sample={length:body.length,prefix:body.slice(0,500)};
  console.log(JSON.stringify({name,status:res.status,mime,cors:res.headers.get("access-control-allow-origin"),sample}));
 }catch(e){console.log(JSON.stringify({name,error:String(e)}))}
}
