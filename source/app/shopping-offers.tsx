'use client';
import React,{useEffect,useState} from 'react';
import {locale,tr} from '../lib/i18n';
import {GermanFlyerImport,GermanFlyerMatches} from './flyer-import';
import {fetchRewePartialData,berlinDay,type RewePartialData} from '../lib/rewe-official-weekly';
import {fetchAldiWeeklyData,type AldiWeeklyData} from '../lib/aldi-nord-weekly';
import {isCopyOnlyOfferLinkContext} from '../lib/offer-link-navigation';
import {
 DEFAULT_OFFER_REGION,OFFER_PROVINCES,GERMAN_OFFER_CITIES,officialGermanFlyers,checkOffers,providerAvailable,restoreOfferRegion,storeChoices,isStoreOfferConnected,
 type Deal,type OfferRegion,
} from '../lib/current-offers';

const KEY='basket-deal-region-v1';
/**
 * In iOS home-screen / embedded views, a new cross-origin tab can leave Basket
 * white or unresponsive. Offer a one-tap URL copy rather than starting a
 * second in-app WebKit page. The user can open the source in Safari manually.
 */
function OfferSourceLink({url,children,className,title}:{url:string;children:React.ReactNode;className?:string;title?:string}){
 const [copyOnly,setCopyOnly]=useState(false);
 const [copied,setCopied]=useState(false);
 useEffect(()=>setCopyOnly(isCopyOnlyOfferLinkContext()),[]);
 const copy=async()=>{
  let ok=false;
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);ok=true}}catch{}
  if(!ok)try{
   const el=document.createElement('textarea');
   el.value=url;el.setAttribute('readonly','');el.style.position='fixed';el.style.opacity='0';
   document.body.appendChild(el);el.select();ok=document.execCommand('copy');el.remove();
  }catch{}
  if(ok)setCopied(true);
  else window.prompt(tr('Copy the link and open it in Safari:'),url);
 };
 if(copyOnly)return <button type="button" className={className} title={tr('Copy link to open in Safari')} onClick={copy}>
  {children}<small className="offer-copy-label">{copied?tr('Copied — paste into Safari'):tr('Copy link for Safari')}</small>
 </button>;
 return <a href={url} className={className} title={title} target="_blank" rel="noopener noreferrer">{children}</a>;
}

function GermanAutomaticSourceStatus({stores}:{stores:readonly string[]}){
 const [rewe,setRewe]=useState<RewePartialData|null>(null);
 const [aldi,setAldi]=useState<AldiWeeklyData|null>(null);
 const storeKey=[...stores].sort().join(',');
 useEffect(()=>{
  let active=true;
  if(!stores.length||stores.includes('rewe'))void fetchRewePartialData().then(d=>{if(active)setRewe(d)});
  else setRewe(null);
  if(!stores.length||stores.includes('aldi'))void fetchAldiWeeklyData().then(d=>{if(active)setAldi(d)});
  else setAldi(null);
  return()=>{active=false};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[storeKey]);
 const today=berlinDay();
 const reweCurrent=!!rewe&&rewe.status==='partial'&&rewe.validFrom<=today&&rewe.validUntil>=today;
 const reweExpired=!!rewe&&rewe.validUntil<today;
 const aldiFresh=!!aldi&&(Date.parse(today+'T12:00:00Z')-Date.parse(aldi.checkedAt+'T12:00:00Z'))/86400000<=3;
 const aldiCurrent=!!aldi&&aldi.status==='partial'&&aldi.checkedAt<=today&&aldiFresh&&
  aldi.offers.some(x=>x.validFrom<=today&&x.validUntil>=today);
 return <div className="offer-de-feed-status">
  {(!stores.length||stores.includes('rewe'))&&<small>REWE Kiel: {reweCurrent
   ?tr('Current partial flyer matches')+' · '+rewe!.validUntil
   :reweExpired?tr('New weekly REWE PDF link needed'):tr('No verified current flyer data')}</small>}
  {(!stores.length||stores.includes('aldi'))&&<small>ALDI Nord: {aldiCurrent
   ?tr('Current partial flyer matches')+' · '+aldi!.checkedAt
   :tr('No verified current flyer data')}</small>}
 </div>;
}
export function useOfferRegion(){
 const [region,setRegion]=useState<OfferRegion>(DEFAULT_OFFER_REGION);
 const [ready,setReady]=useState(false);
 useEffect(()=>{try{setRegion(restoreOfferRegion(localStorage.getItem(KEY)))}catch{}setReady(true)},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem(KEY,JSON.stringify(region))}catch{}},[region,ready]);
 return [region,setRegion] as const;
}
export function OfferSettings({region,onChange}:{region:OfferRegion;onChange:React.Dispatch<React.SetStateAction<OfferRegion>>}){
 const eligible=providerAvailable(region);
 const stores=storeChoices(region);
 return <details className="offer-settings">
  <summary><span>🏷️ {tr('Weekly offers')}</span><small>{region.country==='DE'?'Deutschland':'Canada · '+region.province}</small></summary>
  <div className="offer-settings-inner">
   <p>{tr('Only check offers for products on your shopping list. Select your region and preferred stores.')}</p>
   <div className="offer-region-fields">
    <label>{tr('Country')}<select value={region.country} onChange={e=>onChange({
      country:e.target.value==='DE'?'DE':'CA',province:e.target.value==='DE'?'':'NS',postalCode:'',stores:e.target.value==='DE'?['rewe','aldi']:[],...(e.target.value==='DE'?{city:'Kiel'}:{}),
    })}><option value="CA">{tr('Canada')}</option><option value="DE">{tr('Germany')}</option></select></label>
    {region.country==='CA'&&<label>{tr('Province')}<select value={region.province}
     onChange={e=>onChange(x=>({...x,province:e.target.value,stores:[]}))}>
     {OFFER_PROVINCES.map(p=><option key={p} value={p}>{p}</option>)}
    </select></label>}
    {region.country==='DE'&&<label>{tr('Region')}<select value={region.city||'Kiel'}
      onChange={e=>onChange(x=>({...x,city:e.target.value,stores:[]}))}>
      {GERMAN_OFFER_CITIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
    </select></label>}
   </div>
   <p className="offer-settings-caption">{tr('Preferred stores')} · {tr('No selection means all supported stores.')}</p>
   <div className="offer-store-chips">{stores.map(s=>{
    const selected=region.stores.includes(s.id),supported=isStoreOfferConnected(region,s.id);
    return <button key={s.id} type="button" aria-pressed={selected} className={selected?'active':''}
      onClick={()=>onChange(x=>({...x,stores:selected?x.stores.filter(id=>id!==s.id):[...x.stores,s.id]}))}>
      {s.name}{supported?' ✓':''}
    </button>;
   })}</div>
   <p className="offer-source-note">
    {region.country==='DE'?tr("REWE Kiel and ALDI Nord are selected by default. For REWE, the weekly PDF link is supplied manually and Basket then automatically extracts limited matches. ALDI Nord continues daily updates. Expired prices are hidden; product and pack size must be checked.")
      : eligible&&region.province==='NS'
      ? tr('Nova Scotia: weekly flyer reference prices for 19 common staples from Aubaine.ca. A price may not be a discount, and pack size and branch may differ. Source: aubaine.ca.')
      : eligible
      ? tr('Offer checks use a third-party data source. Deals must include dates and a recent observation; availability can differ by branch.')
      : tr('No verified automated offer feed is connected for this region or store selection. Receipt price history still works normally.')}
   </p>
   {region.country==='DE'&&<GermanAutomaticSourceStatus stores={region.stores}/>}
   {region.country==='DE'&&<details className="flyer-optional-import"><summary>{tr('Optional: import your own flyer')}</summary><GermanFlyerImport/></details>}
  </div>
 </details>;
}
function localMoney(amount:number,currency:string){
 try{return new Intl.NumberFormat(locale(),{style:'currency',currency}).format(amount/100)}catch{return (amount/100).toFixed(2)+' '+currency}
}
function date(d:string){try{return new Intl.DateTimeFormat(locale(),{dateStyle:'medium'}).format(new Date(d+'T12:00:00Z'))}catch{return d}}
export function OffersForItem({name,region,automatic}:{name:string;region:OfferRegion;automatic:boolean}){
 const [state,setState]=useState<'idle'|'checking'|'none'|'error'|'done'>('idle');
 const [deals,setDeals]=useState<Deal[]>([]);
 const [showGermanFlyers,setShowGermanFlyers]=useState(false);
 const connected=providerAvailable(region),key=JSON.stringify([region.country,region.province,region.city,region.stores]);
 useEffect(()=>{setState('idle');setDeals([]);setShowGermanFlyers(false)},[name,key]);
 useEffect(()=>{
  if(!automatic||!connected)return;
  let cancelled=false;setState('checking');
  checkOffers(name,region).then(v=>{if(cancelled)return;setDeals(v);setState(v.length?'done':'none')})
    .catch(()=>{if(!cancelled)setState('error')});
  return()=>{cancelled=true};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[name,key,automatic,connected]);
 if(region.country==='DE'){
  const links=officialGermanFlyers(region);
  return <div className="offer-in-tile">
   <GermanFlyerMatches name={name} chosenStores={region.stores}/>
   {!showGermanFlyers
    ? <button type="button" className="offer-check" onClick={()=>setShowGermanFlyers(true)}>🏷️ {tr('Check official flyers')}</button>
    : <>
      <small>{tr('REWE and ALDI Nord grocery categories are checked automatically where current source data is available. Missing matches do not mean no sale, and brand and package sizes can differ.')}</small>
      <div className="offer-de-links">{links.map(l=><OfferSourceLink key={l.id} url={l.url}>{l.name}</OfferSourceLink>)}</div>
     </>}
  </div>;
 }
 if(!connected)return null;
 const lookup=()=>{setState('checking');checkOffers(name,region).then(v=>{setDeals(v);setState(v.length?'done':'none')}).catch(()=>setState('error'))};
 return <div className="offer-in-tile" aria-live="polite">
  {state==='idle'&&<button type="button" className="offer-check" onClick={lookup}>🏷️ {tr('Check offers')}</button>}
  {state==='checking'&&<small>{tr('Checking current offers…')}</small>}
  {state==='none'&&<><small>{region.province==='NS'?tr('No current matching weekly flyer price in this source'):tr('No verified active offers found')}</small><button type="button" className="offer-again" onClick={lookup}>{tr('Check again')}</button></>}
  {state==='error'&&<><small>{tr('Offer source unavailable')}</small><button type="button" className="offer-again" onClick={lookup}>{tr('Try again')}</button></>}
  {state==='done'&&<>
   <strong>🏷️ {deals.some(d=>d.provider==='aubaine')?tr('Weekly flyer reference prices'):tr('Current offers')} ({deals.length})</strong>
   {deals.slice(0,3).map(d=><OfferSourceLink key={d.id} className="offer-hit" url={d.sourceUrl}
     title={tr('View offer source')}>
     <span><b>{d.store}</b><small>{d.name}{d.packSize?' · '+d.packSize:''}</small></span>
     <span className="offer-money"><b>{localMoney(d.priceCents,d.currency)}</b>
      {d.regularCents!==undefined&&<small className="offer-was">{localMoney(d.regularCents,d.currency)}</small>}</span>
     <small className="offer-period">{tr('Valid')} {date(d.validFrom)} – {date(d.validUntil)}{d.observedAt?' · '+tr('Checked')+' '+date(d.observedAt):''}{d.loyalty?' · '+tr('Membership required'):''}</small>
   </OfferSourceLink>)}
   {deals.length>3&&<small>{tr('More matching offers exist.')}</small>}
   <small>{deals.some(d=>d.provider==='aubaine') ? tr('Source: aubaine.ca · Weekly flyer reference price, not guaranteed discount. Product, size and branch may differ. Verify before buying.') : tr('Source: Bidou · Verify price and product at the retailer.')}</small>
  </>}
 </div>;
}
