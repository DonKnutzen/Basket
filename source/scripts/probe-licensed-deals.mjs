// One-time evidence collection from explicitly reusable public open-data files only.
// Do not scrape HTML or bypass any protection. Do not persist the downloaded data.
const urls=[
  ['lowtein-CA-CCBY','https://lowtein.com/data/ca-prices.csv'],
  ['lowtein-weekly-CCBY','https://lowtein.com/data/ca-tracker.csv'],
  ['aubaine-NS-reuse','https://aubaine.ca/en/weekly-grocery-basket/nova-scotia.csv'],
  ['aubaine-ON-reuse','https://aubaine.ca/en/weekly-grocery-basket/ontario.csv'],
];
const clean=t=>t.replace(/[\r\n\t]/g,' ').slice(0,900);
for(const [id,url] of urls){
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(11000),headers:{Accept:'text/csv'}});
  const contentType=response.headers.get('content-type')||'';
  if(!response.ok){console.log(JSON.stringify({id,status:response.status,contentType}));continue}
  if(!/csv|text\/plain/.test(contentType)){console.log(JSON.stringify({id,status:response.status,contentType,rejected:'non-CSV'}));continue}
  const csv=await response.text();
  console.log(JSON.stringify({id,status:response.status,contentType,length:csv.length,cors:response.headers.get('access-control-allow-origin'),firstLines:csv.split(/\r?\n/).slice(0,6).map(clean)}));
 }catch(e){console.log(JSON.stringify({id,error:String(e).slice(0,200)}))}
}
