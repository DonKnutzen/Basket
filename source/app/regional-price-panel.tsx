'use client';
import React, {useEffect, useState} from 'react';
import {tr} from '../lib/i18n';
import {
  DEFAULT_GROCERY_REGION, GROCERY_STORES, PROVINCES,
  availableProviderStores, getObservedPrices, localStores, normalizePostal,
  readGroceryRegion, type GroceryRegion, type ProductPriceResult,
} from '../lib/regional-prices';

const LOCAL_KEY='basket-grocery-region-v1';
export function useGroceryRegion() {
  const [region,setRegion]=useState<GroceryRegion>(DEFAULT_GROCERY_REGION);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    try { setRegion(readGroceryRegion(localStorage.getItem(LOCAL_KEY))); } catch {}
    setReady(true);
  },[]);
  useEffect(()=>{
    if (!ready) return;
    try {localStorage.setItem(LOCAL_KEY,JSON.stringify(region));}catch{}
  },[region,ready]);
  return [region,setRegion] as const;
}

export function RegionalPricesSettings({region,update}:{
  region:GroceryRegion;update:React.Dispatch<React.SetStateAction<GroceryRegion>>;
}) {
  const [postal,setPostal]=useState(region.postalCode);
  const [error,setError]=useState('');
  useEffect(()=>{setPostal(region.postalCode);setError('')},[region.country,region.postalCode]);
  const stores=localStores(region);
  const enabled=availableProviderStores(region);
  return <details className="regional-price-settings">
    <summary>{tr('Local price comparison')} <span>{region.country}{region.province ? ' · '+region.province : ''}{region.postalCode ? ' · '+region.postalCode : ''}</span></summary>
    <div className="regional-price-settings-body">
      <p>{tr('Choose your region and favourite stores. Settings stay on this device.')}</p>
      <div className="regional-price-fields">
        <label>{tr('Country')}
          <select value={region.country} onChange={e=>update({country:e.target.value==='DE'?'DE':'CA',province:e.target.value==='DE'?'':'NS',postalCode:'',preferredStores:[]})}>
            <option value="CA">{tr('Canada')}</option><option value="DE">{tr('Germany')}</option>
          </select>
        </label>
        {region.country==='CA' && <label>{tr('Province')}
          <select value={region.province} onChange={e=>update(prev=>({...prev,province:e.target.value,preferredStores:[]}))}>
            {PROVINCES.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        </label>}
        <form onSubmit={e=>{
          e.preventDefault();
          const clean=normalizePostal(region.country,postal);
          if (postal.trim() && !clean) {setError(tr('Enter a valid postal code.'));return;}
          update(prev=>({...prev,postalCode:clean}));setPostal(clean);setError('');
        }}>
          <label>{tr('Postal code')}
            <input maxLength={9} autoComplete="postal-code" value={postal}
              onChange={e=>setPostal(e.target.value)} placeholder={region.country==='DE'?'10115':'B3V 1A1'} />
          </label>
          <button type="submit">{tr('Save')}</button>
        </form>
      </div>
      {error && <p role="alert" className="regional-price-error">{error}</p>}
      <div className="regional-price-storechoices">
        <span>{tr('Preferred stores')} <small>{tr('(none selected = all available stores)')}</small></span>
        <div>{stores.map(store=>{
          const isConnected=region.country==='CA'&&region.province==='QC'&&store.provider==='epiceries-ca';
          const selected=region.preferredStores.includes(store.id);
          return <button type="button" key={store.id} aria-pressed={selected} title={isConnected?tr('Quebec-wide observed prices'):tr('Price feed not connected')}
            className={selected?'selected':''} onClick={()=>update(current=>({
              ...current,preferredStores:selected?current.preferredStores.filter(id=>id!==store.id):[...current.preferredStores,store.id],
            }))}>{store.name}{isConnected?' · ✓':''}</button>;
        })}</div>
      </div>
      <p className="regional-price-source">
        {enabled.length ? tr('Quebec: prices observed weekly across chains, not exact branch or pickup prices. No verified offer expiry dates.') :
          tr('No permitted live price feed is connected for this region or store selection yet.')}
      </p>
      {enabled.length>0 && <p className="regional-price-source">{tr('Source: épiceries.ca · Indicative prices · Updated by the provider weekly · Regional availability is not guaranteed.')}</p>}
    </div>
  </details>;
}
const fmtMoney=(cents:number)=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(cents/100);
function relativeDate(value:string) {
  const d=new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}
export function RegionalPricesForItem({name,region}: {name:string;region:GroceryRegion}) {
  const [result,setResult]=useState<ProductPriceResult|null>(null);
  const [loading,setLoading]=useState(false);
  const [failed,setFailed]=useState(false);
  const active=availableProviderStores(region).length>0;
  const storeKey=region.preferredStores.join(',');
  useEffect(()=>{
    let cancelled=false;
    setResult(null);setFailed(false);
    if (!active) {setLoading(false);return;}
    setLoading(true);
    getObservedPrices(name,region)
      .then(value=>{if(!cancelled)setResult(value)})
      .catch(()=>{if(!cancelled)setFailed(true)})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[name,region.country,region.province,storeKey,active]);
  if(!active)return null;
  return <div className="regional-price-item" aria-live="polite">
    {loading ? <small>{tr('Checking observed prices…')}</small>
      : failed ? <small>{tr('Price source unavailable')}</small>
      : !result ? <small>{tr('No recent matching prices')}</small>
      : <>
        <small>{tr('Possible match:')} {result.productName}{result.brand?' · '+result.brand:''}{result.packSize?' · '+result.packSize:''}</small>
        <strong>{tr('From')} {fmtMoney(result.prices[0].priceCents)} <span>· {result.prices[0].storeName}</span></strong>
        <details>
          <summary>{tr('Compare observed prices')} ({result.prices.length})</summary>
          {result.prices.map(item=><div className="regional-price-row" key={item.storeId}>
            <span>{item.storeName}{item.discounted?' · '+tr('Marked discounted'):''}</span>
            <span><b>{fmtMoney(item.priceCents)}</b>{item.unitPriceCents!==undefined && <small>{fmtMoney(item.unitPriceCents)}/{item.unit}</small>}</span>
            <small>{relativeDate(item.observedAt)}</small>
          </div>)}
          <p>{tr('Check product variant and pack size. A recorded discount is not a verified current flyer offer.')}</p>
          <a href="https://epiceries.ca" target="_blank" rel="noopener noreferrer">{tr('Price data: épiceries.ca')}</a>
        </details>
      </>}
  </div>;
}
