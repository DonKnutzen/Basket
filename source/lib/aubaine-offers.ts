/**
 * Opt-in, explicitly published and reusable Aubaine weekly-grocery-basket CSV.
 * This is a small ~20-staple price table, NOT the full flyer catalogue.
 * Source's reuse note: cite aubaine.ca and the reading week.
 * The table contains flyer-derived reference prices; it does not guarantee
 * an actual markdown versus the normal shelf price, exact SKU or branch.
 */
export const AUBAINE_NS_CSV='https://aubaine.ca/en/weekly-grocery-basket/nova-scotia.csv';
export const AUBAINE_NS_SOURCE='https://aubaine.ca/en/groceries/nova-scotia';
export const AUBAINE_NS_STORES:Record<string,{id:string;name:string}>={
 'sobeys-ns':{id:'sobeys',name:'Sobeys'},
 'no-frills-ns':{id:'nofrills',name:'No Frills'},
 'atlantic-superstore-ns':{id:'superstore',name:'Atlantic Superstore'},
 'freshco-ns':{id:'freshco',name:'FreshCo'},
 'foodland-ns':{id:'foodland',name:'Foodland'},
 'freshmart-ns':{id:'freshmart',name:'Freshmart'},
 'wholesale-club-and-club-entrepot-ns':{id:'wholesaleclub',name:'Wholesale Club'},
 'your-independent-grocer-ns':{id:'independent',name:'Your Independent Grocer'},
 'co-op-ns':{id:'coop',name:'Co-op'},
 'clover-farm-ns':{id:'cloverfarm',name:'Clover Farm'},
 'm-m-food-market-ns':{id:'mmfood',name:'M&M Food Market'},
};
export const AUBAINE_NS_STORE_IDS=Object.values(AUBAINE_NS_STORES).map(s=>s.id);
export type WeeklyCsvDeal={
 id:string;name:string;storeId:string;store:string;priceCents:number;
 currency:'CAD';validFrom:string;validUntil:string;observedAt:string;
 sourceUrl:string;packSize:string;loyalty:false;provider:'aubaine';
};
export type AubaineFetch=(url:string,init?:RequestInit)=>Promise<Pick<Response,'ok'|'text'> & {status?:number}>;
function norm(value:string){
 return value.toLowerCase().replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,' ').trim();
}
// Only generic names. Do not equate a particular brand, fat level, variant or
// requested 2L pack with a basket that says "2 L or 4 L".
const NAME_TO_CATEGORY:Record<string,string>={
 'milk':'lait','milch':'lait','lait':'lait',
 'eggs':'oeufs','egg':'oeufs','eier':'oeufs','ei':'oeufs','oeufs':'oeufs',
 'bread':'pain','brot':'pain','pain':'pain',
 'butter':'beurre','beurre':'beurre',
 'apples':'pommes','apple':'pommes','apfel':'pommes','apfel frisch':'pommes','pommes':'pommes',
 'potatoes':'pommes-de-terre','potato':'pommes-de-terre','kartoffeln':'pommes-de-terre','kartoffel':'pommes-de-terre',
 'rice':'riz','reis':'riz','riz':'riz',
 'sugar':'sucre','zucker':'sucre','sucre':'sucre',
 'yogurt':'yogourt','yoghurt':'yogourt','joghurt':'yogourt','yogourt':'yogourt',
 'cooking oil':'huile','ol':'huile','oel':'huile','olivenol':'huile','huile':'huile',
 'pasta':'pates','nudeln':'pates','pates':'pates',
 'cheddar':'fromage-cheddar','cheddar cheese':'fromage-cheddar','cheddar kase':'fromage-cheddar',
 'coffee':'cafe','kaffee':'cafe','cafe':'cafe',
 'flour':'farine','mehl':'farine','farine':'farine',
 'toilet paper':'papier-hygienique','toilettenpapier':'papier-hygienique','klopapier':'papier-hygienique','papier hygienique':'papier-hygienique',
 'chicken':'poulet','hahnchen':'poulet','haehnchen':'poulet','poulet':'poulet',
 'ground beef':'boeuf-hache','hackfleisch':'boeuf-hache','rinderhackfleisch':'boeuf-hache','boeuf hache':'boeuf-hache',
 'orange juice':'jus-orange','orangensaft':'jus-orange','jus orange':'jus-orange',
 'carrots':'carottes','carrot':'carottes','karotten':'carottes','karotte':'carottes','mohren':'carottes','carottes':'carottes',
};
// Shopping-list names usually carry a size, fat level or common variant
// ("2% Milk 4L", "Large eggs", "Gala apples"). Such names match when every
// remaining word is a known neutral modifier for that staple; anything else
// ("milk chocolate", "chicken soup", "organic eggs") stays unmatched.
const HEADS:[string,string][]=[
 ['ground beef','boeuf-hache'],['lean ground beef','boeuf-hache'],['boeuf hache','boeuf-hache'],['hackfleisch','boeuf-hache'],['rinderhackfleisch','boeuf-hache'],['rinderhack','boeuf-hache'],['hack','boeuf-hache'],
 ['orange juice','jus-orange'],['jus orange','jus-orange'],['orangensaft','jus-orange'],
 ['toilet paper','papier-hygienique'],['bathroom tissue','papier-hygienique'],['papier hygienique','papier-hygienique'],['toilettenpapier','papier-hygienique'],['klopapier','papier-hygienique'],
 ['cooking oil','huile'],['vegetable oil','huile'],['canola oil','huile'],['olive oil','huile'],['olivenol','huile'],['olivenoel','huile'],['rapsol','huile'],['rapsoel','huile'],['speiseol','huile'],['speiseoel','huile'],
 ['cheddar cheese','fromage-cheddar'],['cheddar','fromage-cheddar'],
 ['milk','lait'],['milch','lait'],['vollmilch','lait'],['frischmilch','lait'],['lait','lait'],
 ['egg','oeufs'],['eggs','oeufs'],['eier','oeufs'],['oeufs','oeufs'],
 ['bread','pain'],['brot','pain'],['toast','pain'],['toastbrot','pain'],['pain','pain'],
 ['butter','beurre'],['beurre','beurre'],
 ['apple','pommes'],['apples','pommes'],['apfel','pommes'],['aepfel','pommes'],['pommes','pommes'],
 ['potato','pommes-de-terre'],['potatoes','pommes-de-terre'],['kartoffel','pommes-de-terre'],['kartoffeln','pommes-de-terre'],
 ['rice','riz'],['reis','riz'],['riz','riz'],
 ['sugar','sucre'],['zucker','sucre'],['sucre','sucre'],
 ['yogurt','yogourt'],['yoghurt','yogourt'],['yogourt','yogourt'],['joghurt','yogourt'],
 ['pasta','pates'],['spaghetti','pates'],['penne','pates'],['macaroni','pates'],['fusilli','pates'],['rotini','pates'],['linguine','pates'],['nudeln','pates'],['pates','pates'],
 ['coffee','cafe'],['kaffee','cafe'],['cafe','cafe'],
 ['flour','farine'],['mehl','farine'],['farine','farine'],
 ['chicken','poulet'],['chicken breast','poulet'],['chicken breasts','poulet'],['whole chicken','poulet'],['hahnchen','poulet'],['haehnchen','poulet'],['hahnchenbrust','poulet'],['haehnchenbrust','poulet'],['poulet','poulet'],
 ['carrot','carottes'],['carrots','carottes'],['karotte','carottes'],['karotten','carottes'],['mohren','carottes'],['moehren','carottes'],['carottes','carottes'],
];
const NEUTRAL=new Set(['fresh','frisch','frische','frischer','large','regular','white','weiss','weisse','the','of','and','or','und','pack','pk','x','ct','count','bag','beutel','tube','block','value','pc','compliments','gv','great','no','name','selection','kirkland','stuck','stk','dozen','dz','doz','kg','g','lb','lbs','l','ml','litre','litres','liter','oz']);
const MODIFIERS:Record<string,string[]>={
 'lait':['skim','homo','homogenized','whole','partly','skimmed','percent','fat','free','natrel','neilson','sealtest','scotsburn','farmers','baxter','dairyland','h','fettarme','fettarm','haltbare','haltbar','teilentrahmt'],
 'oeufs':['brown','braun','braune','extra','medium','grade','a','freiland','bodenhaltung','free','run','range','farm'],
 'pain':['sliced','whole','wheat','grain','multigrain','sandwich','loaf','dempsters','wonder','country','harvest','vollkorn','weizen','toast'],
 'beurre':['salted','unsalted','gesalzen','ungesalzen','suss','suessrahm','sussrahm','lactantia','gay','lea','stick','sticks'],
 'pommes':['gala','mcintosh','honeycrisp','ambrosia','fuji','granny','smith','red','delicious','golden','cortland','spartan','jonagold','pink','lady','rot','rote','grun','gruen','grune','gruene','elstar','braeburn','nova','scotia'],
 'pommes-de-terre':['russet','yellow','gold','red','white','baking','mehligkochend','festkochend','vorwiegend','festkochende','pei'],
 'riz':['basmati','jasmine','long','grain','parboiled','minute','langkorn','langkornreis'],
 'sucre':['granulated','fine','kristall','kristallzucker','raffinade','redpath','lantic'],
 'yogourt':['plain','vanilla','strawberry','blueberry','peach','raspberry','berry','mixed','fruit','natur','vanille','erdbeer','activia','danone','astro','yoplait','tubes','multipack'],
 'huile':['canola','olive','vegetable','sunflower','extra','virgin','nativ','natives','raps','sonnenblumen','pflanzen','mazola'],
 'pates':['dry','durum','wheat','catelli','barilla','italpasta','primo','ronzoni','elbow','spaghettini'],
 'fromage-cheddar':['cheese','kase','kaese','mild','medium','old','aged','sharp','extra','marble','white','orange','cracker','barrel','black','diamond','balderson','cows'],
 'cafe':['ground','gemahlen','gemahlener','beans','bohnen','medium','dark','roast','tim','hortons','maxwell','house','folgers','kicking','horse','van','houtte','starbucks','nabob','filter','filterkaffee'],
 'farine':['all','purpose','unbleached','robin','hood','five','roses','weizenmehl','type','405','550'],
 'papier-hygienique':['double','triple','rolls','roll','rollen','ply','lagig','charmin','cottonelle','royale','purex','cashmere','majesta'],
 'poulet':['breast','breasts','thigh','thighs','drumstick','drumsticks','whole','boneless','skinless','brust','brustfilet','schenkel','keule','keulen','ganzes','ganz'],
 'boeuf-hache':['medium','lean','extra','regular','rind','rinder','gemischt'],
 'jus-orange':['tropicana','oasis','simply','pulp','no','some','not','from','concentrate','fruchtfleisch','direktsaft','100'],
 'carottes':['baby','bunch','bund','mini'],
};
export function aubaineCategory(name:string):string | undefined{
 const key=norm(name);
 const exact=NAME_TO_CATEGORY[key];if(exact)return exact;
 const tokens=key.split(' ').filter(t=>t&&!/^\d+$/.test(t)&&!/^\d+(kg|g|lb|lbs|l|ml|pk|x|ct)$/.test(t));
 if(!tokens.length)return;
 const text=' '+tokens.join(' ')+' ';
 for(const [head,category] of [...HEADS].sort((a,b)=>b[0].length-a[0].length)){
  if(!text.includes(' '+head+' '))continue;
  const allowed=new Set([...NEUTRAL,...MODIFIERS[category]||[]]);
  const rest=text.replace(' '+head+' ',' ').trim().split(' ').filter(Boolean);
  if(rest.every(t=>allowed.has(t)))return category;
  return;
 }
}
/** RFC 4180-style CSV parser with escaped quotes, commas, CRLF and line bounds. */
export function parseCsv(csv:string):string[][]{
 if(csv.length>256000)throw new Error('Weekly source exceeds safe size');
 let quoted=false,current='',row:string[]=[],rows:string[][]=[];
 for(let i=0;i<csv.length;i++){
  const c=csv[i];
  if(c==='"'){
   if(quoted&&csv[i+1]==='"'){current+='"';i++}else quoted=!quoted;
  }else if(c===','&&!quoted){row.push(current);current=''}
  else if((c==='\n'||c==='\r')&&!quoted){
   if(c==='\r'&&csv[i+1]==='\n')i++;
   row.push(current);current='';
   if(row.some(v=>v.length))rows.push(row);
   row=[];
  }else current+=c;
 }
 if(quoted)throw new Error('Unterminated CSV');
 row.push(current);if(row.some(v=>v.length))rows.push(row);
 return rows;
}
function dayIsValid(v:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const d=new Date(v+'T12:00:00Z');
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;
}
function novaScotiaDay(now:Date){
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Halifax',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
type Row={province:string;start:string;end:string;store:string;category:string;name:string;size:string;price:string;count:string};
export function readAubaineWeeklyCsv(csv:string):Row[]{
 const rows=parseCsv(csv);if(!rows.length)return [];
 const header=rows[0];const col=(name:string)=>header.indexOf(name);
 const needed=['province','du','au','slug_enseigne','produit_cle','produit_nom','format_reference','prix_cad','articles_apparies'];
 if(needed.some(k=>col(k)<0))throw new Error('Unexpected aubaine CSV schema');
 return rows.slice(1).filter(r=>r.length===header.length).map(r=>({
  province:r[col('province')],start:r[col('du')],end:r[col('au')],store:r[col('slug_enseigne')],
  category:r[col('produit_cle')],name:r[col('produit_nom')],size:r[col('format_reference')],
  price:r[col('prix_cad')],count:r[col('articles_apparies')]
 }));
}
export function selectAubaineOffers(csv:string,requested:string,selectedStores:readonly string[],now=new Date()):WeeklyCsvDeal[]{
 const key=aubaineCategory(requested);
 if(!key)return [];
 const today=novaScotiaDay(now);
 const found:WeeklyCsvDeal[]=[];
 for(const row of readAubaineWeeklyCsv(csv)){
  const store=AUBAINE_NS_STORES[row.store];
  const price=Number(row.price),count=Number(row.count);
  if(row.province!=='NS'||row.category!==key||!store||
   (selectedStores.length>0&&!selectedStores.includes(store.id))||
   !dayIsValid(row.start)||!dayIsValid(row.end)||
   today<row.start||today>row.end||row.start>row.end||
   !Number.isFinite(price)||price<=0||price>=10000||
   !Number.isFinite(count)||count<1)continue;
  // This dataset aggregates multiple matching flyer items (not exact SKUs),
  // so it is shown only as a reference flyer price with full disclosure.
  found.push({
   id:'aubaine:'+store.id+':'+key+':'+row.start,
   name:row.name,storeId:store.id,store:store.name,priceCents:Math.round(price*100),
   currency:'CAD',validFrom:row.start,validUntil:row.end,observedAt:'',
   sourceUrl:AUBAINE_NS_CSV,packSize:row.size.slice(0,90),loyalty:false,provider:'aubaine'
  });
 }
 return found.sort((a,b)=>a.priceCents-b.priceCents);
}
const KEY='basket-aubaine-ns-weekly-v1';
const CACHE_MS=3*60*60*1000;
let inFlight:Promise<string>|null=null;
async function weeklyCsv(fetcher:AubaineFetch):Promise<string>{
 // Store just the source's 20-staple weekly dataset (permitted public download),
 // not every retailer flyer. Cache conservatively and never serve expired weeks.
 try{
  const cache=JSON.parse(localStorage.getItem(KEY)||'null');
  if(typeof cache?.csv==='string'&&typeof cache.at==='number'&&
    Date.now()-cache.at>=0&&Date.now()-cache.at<CACHE_MS)return cache.csv;
 }catch{}
 if(inFlight)return inFlight;
 inFlight=(async()=>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{
   const response=await fetcher(AUBAINE_NS_CSV,{signal:controller.signal,headers:{Accept:'text/csv'}});
   if(!response.ok)throw new Error('Aubaine weekly data unavailable');
   const csv=await response.text();
   readAubaineWeeklyCsv(csv); // Reject an HTML block page or a changed schema.
   try{localStorage.setItem(KEY,JSON.stringify({at:Date.now(),csv}))}catch{}
   return csv;
  }finally{clearTimeout(timeout)}
 })().finally(()=>{inFlight=null});
 return inFlight;
}
export async function getAubaineOffers(name:string,selectedStores:readonly string[],fetcher:AubaineFetch=fetch,now=new Date()):Promise<WeeklyCsvDeal[]>{
 if(!aubaineCategory(name))return [];
 const csv=await weeklyCsv(fetcher);
 return selectAubaineOffers(csv,name,selectedStores,now);
}
