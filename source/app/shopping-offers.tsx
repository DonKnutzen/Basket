'use client';
import React,{useEffect,useState} from 'react';
import {getLanguage,locale,tr} from '../lib/i18n';
import {GermanOfferDialog} from './german-offer-dialog';
import {GermanOfferAdmin} from './german-offer-admin';
import {OfferSourceLink} from './offer-source-link';
import {useCentralGermanOffers,useGermanOfferDisplay} from '../lib/german-offer-store';
import {matchCentralGermanOffers,compactGermanOfferMatches,mergeGermanOfferSources} from '../lib/german-central-offers';
import {matchGermanDrafts,unverifiedOfferCount} from '../lib/german-offer-drafts';
import {GermanDraftCatalogue} from './german-draft-catalogue';
import {GermanFlyerQuickLinks} from './german-flyer-quick-links';
import {
 DEFAULT_OFFER_REGION,OFFER_PROVINCES,GERMAN_OFFER_CITIES,checkOffers,providerAvailable,restoreOfferRegion,storeChoices,isStoreOfferConnected,
 type Deal,type OfferRegion,
} from '../lib/current-offers';
import {aubaineCategory} from '../lib/aubaine-offers';

const KEY='basket-deal-region-v1';
export function GermanOfferTileBadge({name,region}:{name:string;region:OfferRegion}){
 const state=useCentralGermanOffers(),[enabled]=useGermanOfferDisplay();
 if(region.country!=='DE'||!enabled)return null;
 const matches=matchCentralGermanOffers(name,mergeGermanOfferSources(state.offers,state.previewOffers),region.stores);
 const pending=matchGermanDrafts(name,state.drafts,region.stores).length;
 if(!matches.length)return pending?<span> · {unverifiedOfferCount(pending,getLanguage()==='de')}</span>:null;
 const available=compactGermanOfferMatches(matches);
 const eur=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'});
 return <span>{available.map(({offer:o})=><span key={o.id}> · {o.retailer==='penny'?'PENNY':o.retailer==='rewe'?'REWE':'ALDI Nord'}{(o.testOnly||state.previewOffers.some(p=>p.id===o.id)&&!state.offers.some(p=>p.id===o.id))?' Test':''}: {eur.format(o.priceCents/100)}{o.packSize?' / '+o.packSize:''}{o.priceKind==='loyalty'?' (App/Bonus)':o.priceKind!=='standard'?' ('+o.priceKind+')':''}</span>)}{matches.length>available.length?' · +'+(matches.length-available.length)+' weitere':''}{pending?' · '+unverifiedOfferCount(pending,getLanguage()==='de'):''}</span>;
}
function GermanAutomaticSourceStatus({stores}:{stores:readonly string[]}){
 const state=useCentralGermanOffers();
 const [enabled,setEnabled]=useGermanOfferDisplay();
 const current=state.offers.filter(o=>!stores.length||stores.includes(o.retailer==='aldi-nord'?'aldi':o.retailer));
 return <div className="offer-de-feed-status"><label className="german-checkbox"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Aktuelle Prospektangebote anzeigen</label><small>{state.loading?'Angebote werden geladen …':state.error||`${current.length} veröffentlichte Angebote · Kiel${state.previewOffers.length?` · ${state.previewOffers.length} interne Testvorschau`:''}`}</small></div>;
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
      country:e.target.value==='DE'?'DE':'CA',province:e.target.value==='DE'?'':'NS',postalCode:'',stores:e.target.value==='DE'?['rewe','aldi','penny']:[],...(e.target.value==='DE'?{retailerSelectionVersion:3}:{}),...(e.target.value==='DE'?{city:'Kiel'}:{}),
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
    {region.country==='DE'?tr("Confirmed REWE Kiel, ALDI Nord and PENNY flyer offers appear automatically on your shopping list. Check the advertised brand, size and conditions.")
      : eligible&&region.province==='NS'
      ? tr('Nova Scotia: weekly flyer reference prices for 19 common staples from Aubaine.ca. A price may not be a discount, and pack size and branch may differ. Source: aubaine.ca.')
      : eligible
      ? tr('Offer checks use a third-party data source. Deals must include dates and a recent observation; availability can differ by branch.')
      : tr('No verified automated offer feed is connected for this region or store selection. Receipt price history still works normally.')}
   </p>
   {region.country==='DE'&&<GermanAutomaticSourceStatus stores={region.stores}/>}
   {region.country==='DE'&&<GermanFlyerQuickLinks region={region}/>}
   {region.country==='DE'&&<GermanDraftCatalogue stores={region.stores}/>}
   {region.country==='DE'&&<GermanOfferAdmin/>}
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
 const [expanded,setExpanded]=useState(false);
 const [showAll,setShowAll]=useState(false);
 const covered=region.country!=='CA'||region.province!=='NS'||!!aubaineCategory(name);
 const connected=providerAvailable(region)&&covered,key=JSON.stringify([region.country,region.province,region.city,region.stores]);
 useEffect(()=>{setState('idle');setDeals([]);setExpanded(false);setShowAll(false)},[name,key]);
 useEffect(()=>{
  if(!automatic||!connected)return;
  let cancelled=false;setState('checking');
  checkOffers(name,region).then(v=>{if(cancelled)return;setDeals(v);setState(v.length?'done':'none')})
    .catch(()=>{if(!cancelled)setState('error')});
  return()=>{cancelled=true};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[name,key,automatic,connected]);
 if(region.country==='DE'){
  const de=getLanguage()==='de';
  return <div className="offer-in-tile">
   <button type="button" className="offer-check" aria-haspopup="dialog" onClick={()=>setExpanded(true)}>🏷️ {de?'Angebote ansehen':'View offers'}</button>
   {expanded&&<GermanOfferDialog name={name} region={region} close={()=>setExpanded(false)}/>}
  </div>;
 }
 if(!covered&&providerAvailable(region))return <div className="offer-in-tile"><small className="offer-uncovered">🏷️ {tr('Not in the Nova Scotia weekly staples list')}</small></div>;
 if(!connected)return null;
 const lookup=()=>{setState('checking');checkOffers(name,region).then(v=>{setDeals(v);setState(v.length?'done':'none')}).catch(()=>setState('error'))};
 return <div className="offer-in-tile" aria-live="polite">
  {state==='idle'&&<button type="button" className="offer-check" onClick={lookup}>🏷️ {tr('Check offers')}</button>}
  {state==='checking'&&<small>{tr('Checking current offers…')}</small>}
  {state==='none'&&<><small>{region.province==='NS'?tr('No current matching weekly flyer price in this source'):tr('No verified active offers found')}</small><button type="button" className="offer-again" onClick={lookup}>{tr('Check again')}</button></>}
  {state==='error'&&<><small>{tr('Offer source unavailable')}</small><button type="button" className="offer-again" onClick={lookup}>{tr('Try again')}</button></>}
  {state==='done'&&<>
   <strong>🏷️ {deals.some(d=>d.provider==='aubaine')?tr('Weekly flyer reference prices'):tr('Current offers')} ({deals.length})</strong>
   {deals.slice(0,showAll?deals.length:3).map(d=><OfferSourceLink key={d.id} className="offer-hit" url={d.sourceUrl}
     title={tr('View offer source')}>
     <span><b>{d.store}</b><small>{d.name}{d.packSize?' · '+d.packSize:''}</small></span>
     <span className="offer-money"><b>{localMoney(d.priceCents,d.currency)}</b>
      {d.regularCents!==undefined&&<small className="offer-was">{localMoney(d.regularCents,d.currency)}</small>}</span>
     <small className="offer-period">{tr('Valid')} {date(d.validFrom)} – {date(d.validUntil)}{d.observedAt?' · '+tr('Checked')+' '+date(d.observedAt):''}{d.loyalty?' · '+tr('Membership required'):''}</small>
   </OfferSourceLink>)}
   {deals.length>3&&<button type="button" className="offer-again" onClick={()=>setShowAll(v=>!v)}>{showAll?tr('Show fewer stores'):tr('Show all stores')+' ('+deals.length+')'}</button>}
   <small>{deals.some(d=>d.provider==='aubaine') ? tr('Source: aubaine.ca · Weekly flyer reference price, not guaranteed discount. Product, size and branch may differ. Verify before buying.') : tr('Source: Bidou · Verify price and product at the retailer.')}</small>
  </>}
 </div>;
}

