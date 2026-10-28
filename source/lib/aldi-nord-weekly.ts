/**
 * A bounded, incomplete reference to ALDI Nord's publicly advertised prices.
 * Central extraction reads one official page; no cross-origin requests from
 * shoppers, no original HTML/PDF and no household shopping data are uploaded.
 * Do not advertise full catalogue coverage, exact SKU matching or reuse rights.
 */
import {appPath} from './hosting';
import {berlinDay} from './rewe-official-weekly';

export type AldiWeeklyOffer={
 id:string;category:string;name:string;brand:string;packSize:string;
 priceCents:number;validFrom:string;validUntil:string;store:'aldi';
 confidence:'category-only';
};
export type AldiWeeklyData={
 schema:1;region:'Kiel';store:'aldi';checkedAt:string;
 sourceUrl:'https://www.aldi-nord.de/angebote.html';
 coverage:'partial';status:'partial'|'unavailable';offers:AldiWeeklyOffer[];
};
const CATEGORIES=new Set([
 'Aubergine','Kartoffeln','Bananen','Äpfel','Tomaten','Gurken','Paprika',
 'Avocado','Brokkoli','Karotten','Zwiebeln','Champignons','Spinat','Zucchini',
 'Ingwer','Milch','Butter','Eier','Käse','Joghurt','Brot','Pizza','Nudeln',
 'Reis','Kaffee','Mehl','Zucker','Schokolade','Mineralwasser','Lachs',
 'Hackfleisch','Hähnchen','Salat',
]);
const VALID_DAY=/^\d{4}-\d{2}-\d{2}$/;
function validDay(value:unknown):value is string{
 if(typeof value!=='string'||!VALID_DAY.test(value))return false;
 const d=new Date(value+'T12:00:00Z');
 return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===value;
}
export function parseAldiWeeklyData(raw:unknown):AldiWeeklyData|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const d=raw as Partial<AldiWeeklyData>;
 if(d.schema!==1||d.region!=='Kiel'||d.store!=='aldi'||d.coverage!=='partial'||
  d.sourceUrl!=='https://www.aldi-nord.de/angebote.html'||
  !validDay(d.checkedAt)||!['partial','unavailable'].includes(String(d.status))||
  !Array.isArray(d.offers)||d.offers.length>50)return null;
 if(!d.offers.every(x=>x&&x.store==='aldi'&&x.confidence==='category-only'&&
   typeof x.id==='string'&&/^aldi:nord:\d{1,15}:\d{4}-\d{2}-\d{2}$/.test(x.id)&&
   CATEGORIES.has(x.category)&&
   typeof x.name==='string'&&x.name.length>=2&&x.name.length<=100&&
   typeof x.brand==='string'&&x.brand.length<=70&&
   typeof x.packSize==='string'&&x.packSize.length<=70&&
   Number.isInteger(x.priceCents)&&x.priceCents>=9&&x.priceCents<=25000&&
   validDay(x.validFrom)&&validDay(x.validUntil)&&x.validFrom<=x.validUntil))return null;
 return d as AldiWeeklyData;
}
/** Only generic, intentionally requested food categories match automatically. */
const ALIASES:Record<string,string>={
 'aubergine':'Aubergine','auberginen':'Aubergine',
 'kartoffeln':'Kartoffeln','kartoffel':'Kartoffeln','speisekartoffeln':'Kartoffeln',
 'banane':'Bananen','bananen':'Bananen',
 'apfel':'Äpfel','äpfel':'Äpfel','aepfel':'Äpfel',
 'tomaten':'Tomaten','tomate':'Tomaten','rispentomaten':'Tomaten',
 'gurke':'Gurken','gurken':'Gurken','salatgurke':'Gurken',
 'paprika':'Paprika','avocado':'Avocado','avocados':'Avocado',
 'brokkoli':'Brokkoli','karotten':'Karotten','karotte':'Karotten','möhren':'Karotten',
 'zwiebeln':'Zwiebeln','zwiebel':'Zwiebeln',
 'champignons':'Champignons','spinat':'Spinat','zucchini':'Zucchini',
 'ingwer':'Ingwer','milch':'Milch','butter':'Butter','eier':'Eier',
 'käse':'Käse','kaese':'Käse','joghurt':'Joghurt','yogurt':'Joghurt',
 'brot':'Brot','pizza':'Pizza','nudeln':'Nudeln','pasta':'Nudeln',
 'reis':'Reis','kaffee':'Kaffee','mehl':'Mehl','zucker':'Zucker',
 'schokolade':'Schokolade','mineralwasser':'Mineralwasser','wasser':'Mineralwasser',
 'lachs':'Lachs','hackfleisch':'Hackfleisch','hähnchen':'Hähnchen',
 'salat':'Salat',
};
export function matchAldiWeeklyOffers(
 name:string,data:AldiWeeklyData|null,selectedStores:readonly string[]=[],now=new Date()
):AldiWeeklyOffer[]{
 if(!data||data.status!=='partial'||selectedStores.length&&!selectedStores.includes('aldi'))return [];
 const today=berlinDay(now);
 const lastChecked=new Date(data.checkedAt+'T12:00:00Z').getTime();
 const nowDay=new Date(today+'T12:00:00Z').getTime();
 if(data.checkedAt>today||(nowDay-lastChecked)/86400000>3)return [];
 const category=ALIASES[name.toLocaleLowerCase('de').trim().replace(/\s+/g,' ')];
 if(!category)return [];
 return data.offers.filter(x=>x.category===category&&today>=x.validFrom&&today<=x.validUntil)
  .sort((a,b)=>a.priceCents-b.priceCents).slice(0,3);
}

const SOURCE=appPath('aldi-nord-kiel-weekly.json');
let cached:{at:number;data:AldiWeeklyData|null}|null=null;
let pending:Promise<AldiWeeklyData|null>|null=null;
export async function fetchAldiWeeklyData(fetcher:typeof fetch=fetch):Promise<AldiWeeklyData|null>{
 if(cached&&Date.now()-cached.at<30*60*1000)return cached.data;
 if(pending)return pending;
 pending=(async()=>{
  try{
   const response=await fetcher(SOURCE,{cache:'no-cache'});
   if(!response.ok)throw Error('ALDI Nord summary unavailable');
   const data=parseAldiWeeklyData(await response.json());
   cached={at:Date.now(),data};return data;
  }catch{
   cached={at:Date.now(),data:null};return null;
  }finally{pending=null}
 })();
 return pending;
}
