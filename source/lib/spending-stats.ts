import {comparisonBasis,productNameKey} from './price-history';
import {CATEGORIES,localDate,normalize,type BasketData,type PriceLine,type Receipt} from './types';

// Household spending insights computed from confirmed receipts only.
// Money stays in integer cents and currencies are never mixed.
export type PeriodKey='month'|'3m'|'12m'|'all';
export type DateRange={from:string;to:string};

const pad=(n:number)=>String(n).padStart(2,'0');
function monthStart(year:number,month:number){const d=new Date(Date.UTC(year,month,1));return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-01`}
function monthEnd(year:number,month:number){const d=new Date(Date.UTC(year,month+1,0));return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`}
function parts(day:string){return [Number(day.slice(0,4)),Number(day.slice(5,7))-1] as const}
function addDays(day:string,n:number){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function daysBetween(a:string,b:string){return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000)}

/** Calendar ranges: one month, or the last 3 / 12 calendar months including the current one. */
export function periodRange(period:PeriodKey,month:string,today=localDate()):DateRange{
 if(period==='all')return {from:'',to:'9999-12-31'};
 if(period==='month'){const [y,m]=parts(month+'-01');return {from:monthStart(y,m),to:monthEnd(y,m)}}
 const [y,m]=parts(today),span=period==='3m'?3:12;
 return {from:monthStart(y,m-span+1),to:monthEnd(y,m)};
}
/** The equally long range directly before, for "compared with" figures. */
export function previousRange(period:PeriodKey,range:DateRange):DateRange|null{
 if(period==='all')return null;
 const [y,m]=parts(range.from),span=period==='month'?1:period==='3m'?3:12;
 return {from:monthStart(y,m-span),to:monthEnd(y,m-1)};
}
/** Currencies with receipts, most used first. */
export function receiptCurrencies(receipts:readonly Receipt[]){
 const count=new Map<string,number>();for(const r of receipts)count.set(r.currency,(count.get(r.currency)||0)+1);
 return [...count].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([c])=>c);
}
const inRange=(day:string,r:DateRange)=>day>=r.from&&day<=r.to;

export type TimeBucket={key:string;from:string;to:string;cents:number;trips:number};
/** Weeks (Monday start) for ranges up to ~3 months, months beyond; empty periods are kept as zero. */
export function timeline(receipts:readonly Receipt[],range:DateRange,today=localDate()):{unit:'week'|'month';buckets:TimeBucket[]}{
 const dates=receipts.map(r=>r.date).sort();
 const from=range.from||dates[0]||today,to=range.to<today?range.to:today;
 const end=to<from?from:to;
 const unit=daysBetween(from,end)<=100?'week':'month';
 const buckets:TimeBucket[]=[];
 if(unit==='week'){
  const weekday=(new Date(from+'T12:00:00Z').getUTCDay()+6)%7;
  for(let start=addDays(from,-weekday);start<=end;start=addDays(start,7))buckets.push({key:start,from:start,to:addDays(start,6),cents:0,trips:0});
 }else{
  const [y,first]=parts(from);
  for(let m=first,start=monthStart(y,m);start<=end;m++,start=monthStart(y,m))buckets.push({key:start.slice(0,7),from:start,to:monthEnd(y,m),cents:0,trips:0});
 }
 for(const r of receipts){const b=buckets.find(b=>r.date>=b.from&&r.date<=b.to);if(b){b.cents+=r.totalCents;b.trips++}}
 return {unit,buckets};
}

export type CategoryStat={name:string;cents:number;share:number;products:{name:string;cents:number}[]};
export type StoreStat={name:string;cents:number;trips:number;averageCents:number;share:number};
export type ProductStat={key:string;name:string;category:string;cents:number;quantity:number;purchases:number;stores:string[]};
export type StorePrice={store:string;unitCents:number;purchases:number;lastDate:string};
export type PriceComparison={key:string;name:string;unit:string;stores:StorePrice[];spread:number};
export type StoreIndex={store:string;index:number;products:number};
export type PriceChange={key:string;name:string;unit:string;store:string;previousCents:number;latestCents:number;change:number;date:string};

function sumBy<T>(items:readonly T[],value:(item:T)=>number){return items.reduce((s,i)=>s+value(i),0)}
function topProducts(lines:readonly PriceLine[]):ProductStat[]{
 const map=new Map<string,ProductStat>();
 for(const l of lines){
  const key=productNameKey(l.productName||l.label);let p=map.get(key);
  if(!p){p={key,name:l.productName||l.label,category:l.category,cents:0,quantity:0,purchases:0,stores:[]};map.set(key,p)}
  p.cents+=l.amountCents;p.quantity+=l.quantity>0?l.quantity:1;p.purchases++;if(!p.stores.includes(l.store))p.stores.push(l.store);
 }
 return [...map.values()].sort((a,b)=>b.cents-a.cents||a.name.localeCompare(b.name));
}
/** A product is comparable across stores per kg, per litre, per piece, or per identical pack. */
function priceKey(l:PriceLine){const basis=comparisonBasis(l);if(!basis||l.amountCents<=0)return null;return {key:productNameKey(l.productName||l.label)+'|'+basis.unit+(basis.unit==='recorded unit'?'|'+normalize(l.packSize):''),unit:basis.unit==='recorded unit'?(l.packSize||'item'):basis.unit,cents:basis.cents}}

export function priceComparisons(lines:readonly PriceLine[]):PriceComparison[]{
 const groups=new Map<string,{name:string;unit:string;stores:Map<string,{total:number;n:number;lastDate:string}>}>();
 for(const l of lines){
  const p=priceKey(l);if(!p)continue;
  let g=groups.get(p.key);if(!g){g={name:l.productName||l.label,unit:p.unit,stores:new Map()};groups.set(p.key,g)}
  const s=g.stores.get(l.store)||{total:0,n:0,lastDate:''};s.total+=p.cents;s.n++;if(l.date>s.lastDate)s.lastDate=l.date;g.stores.set(l.store,s);
 }
 const rows:PriceComparison[]=[];
 for(const [key,g] of groups){
  if(g.stores.size<2)continue;
  const stores=[...g.stores].map(([store,s])=>({store,unitCents:Math.round(s.total/s.n),purchases:s.n,lastDate:s.lastDate})).sort((a,b)=>a.unitCents-b.unitCents||a.store.localeCompare(b.store));
  const low=stores[0].unitCents,high=stores[stores.length-1].unitCents;
  rows.push({key,name:g.name,unit:g.unit,stores,spread:low>0?(high-low)/low:0});
 }
 return rows.sort((a,b)=>b.spread-a.spread||a.name.localeCompare(b.name));
}
/** 100 = average price level of the stores where the same products were bought; below 100 is cheaper. */
export function storePriceIndex(comparisons:readonly PriceComparison[]):StoreIndex[]{
 const ratios=new Map<string,number[]>();
 for(const c of comparisons){
  const mean=sumBy(c.stores,s=>s.unitCents)/c.stores.length;if(!mean)continue;
  for(const s of c.stores){const list=ratios.get(s.store)||[];list.push(s.unitCents/mean);ratios.set(s.store,list)}
 }
 return [...ratios].map(([store,r])=>({store,index:Math.round(sumBy(r,x=>x)/r.length*1000)/10,products:r.length})).sort((a,b)=>a.index-b.index||a.store.localeCompare(b.store));
}
/** Latest versus previous price of the same product at the same store. */
export function priceChanges(lines:readonly PriceLine[]):PriceChange[]{
 const groups=new Map<string,{name:string;unit:string;store:string;points:{date:string;receiptId:string;cents:number}[]}>();
 for(const l of lines){
  const p=priceKey(l);if(!p)continue;
  const key=p.key+'|'+normalize(l.store);let g=groups.get(key);
  if(!g){g={name:l.productName||l.label,unit:p.unit,store:l.store,points:[]};groups.set(key,g)}
  g.points.push({date:l.date,receiptId:l.receiptId,cents:p.cents});
 }
 const rows:PriceChange[]=[];
 for(const [key,g] of groups){
  const points=g.points.sort((a,b)=>a.date.localeCompare(b.date)||a.receiptId.localeCompare(b.receiptId));
  const latest=points[points.length-1],previous=[...points].reverse().find(p=>p.receiptId!==latest.receiptId&&p.date<=latest.date);
  if(!previous||!previous.cents)continue;
  const change=(latest.cents-previous.cents)/previous.cents;
  if(Math.abs(change)>=0.01)rows.push({key,name:g.name,unit:g.unit,store:g.store,previousCents:previous.cents,latestCents:latest.cents,change,date:latest.date});
 }
 return rows.sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)||b.date.localeCompare(a.date));
}

export type SpendingStats={
 currency:string;range:DateRange;receipts:Receipt[];totalCents:number;taxCents:number;trips:number;averageTripCents:number;
 perWeekCents:number;itemCount:number;previousTotalCents:number|null;timeline:ReturnType<typeof timeline>;
 categories:CategoryStat[];stores:StoreStat[];products:ProductStat[];comparisons:PriceComparison[];storeIndex:StoreIndex[];changes:PriceChange[];
};
export function spendingStats(data:Pick<BasketData,'receipts'|'lines'>,period:PeriodKey,month:string,currency:string,today=localDate()):SpendingStats{
 const range=periodRange(period,month,today);
 const receipts=data.receipts.filter(r=>r.currency===currency&&inRange(r.date,range)).sort((a,b)=>b.date.localeCompare(a.date));
 const ids=new Set(receipts.map(r=>r.id));
 const lines=data.lines.filter(l=>ids.has(l.receiptId));
 const totalCents=sumBy(receipts,r=>r.totalCents),trips=receipts.length;
 const previous=previousRange(period,range);
 const previousTotalCents=previous?sumBy(data.receipts.filter(r=>r.currency===currency&&inRange(r.date,previous)),r=>r.totalCents):null;
 // Weekly average over the elapsed part of the range (a current month counts only days so far).
 const first=range.from||receipts[receipts.length-1]?.date||today,last=range.to<today?range.to:today;
 const weeks=Math.max(1,(daysBetween(first,last<first?first:last)+1)/7);
 const lineTotal=sumBy(lines,l=>l.amountCents);
 const categories=CATEGORIES.map(name=>{const own=lines.filter(l=>l.category===name);const cents=sumBy(own,l=>l.amountCents);return {name,cents,share:lineTotal>0?cents/lineTotal:0,products:topProducts(own).slice(0,5).map(p=>({name:p.name,cents:p.cents}))}}).filter(c=>c.cents>0).sort((a,b)=>b.cents-a.cents);
 const storeNames=[...new Set(receipts.map(r=>r.store))];
 const stores=storeNames.map(name=>{const own=receipts.filter(r=>r.store===name);const cents=sumBy(own,r=>r.totalCents);return {name,cents,trips:own.length,averageCents:Math.round(cents/own.length),share:totalCents>0?cents/totalCents:0}}).sort((a,b)=>b.cents-a.cents);
 // Store price comparisons use every purchase in this currency: one month rarely has the same product at two stores.
 const currencyIds=new Set(data.receipts.filter(r=>r.currency===currency&&(r.date<=range.to)).map(r=>r.id));
 const priceLines=data.lines.filter(l=>currencyIds.has(l.receiptId));
 const comparisons=priceComparisons(priceLines);
 return {currency,range,receipts,totalCents,taxCents:sumBy(receipts,r=>r.taxCents),trips,averageTripCents:trips?Math.round(totalCents/trips):0,
  perWeekCents:Math.round(totalCents/weeks),itemCount:lines.length,previousTotalCents,timeline:timeline(receipts,range,today),
  categories,stores,products:topProducts(lines),comparisons,storeIndex:storePriceIndex(comparisons),changes:priceChanges(priceLines)};
}
