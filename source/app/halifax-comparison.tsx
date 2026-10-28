'use client';
import React, {useState} from 'react';
import {tr,locale} from '../lib/i18n';
import {basketFetch} from '../lib/supabase-browser';
import {catalogExactProduct} from '../lib/product-catalog';
import {HALIFAX_PROVIDER_STORES,halifaxProviderStores,type GroceryRegion} from '../lib/regional-prices';
import type {Item} from '../lib/types';

type PlanLine={status?:string;original?:string;input?:string;text?:string;name?:string;reason?:string;reasons?:string[];};
type PlanStore={key:string;name:string;totalCad?:number|null;totalScope?:string;completeRequestedList?:boolean;oldest?:string;newest?:string;items?:unknown;prices?:unknown;itemPrices?:unknown;};
type Plan={source:string;market:string;evaluatedOn:string;lines:PlanLine[];stores:PlanStore[];summary?:Record<string,unknown>;recommendation?:{status?:string;storeKey?:string;explanation?:string};comparisonUrl?:string;caveats?:string[];interpretation?:string[]};
const key='basket-halifax-personal-comparison-v1:';
const safePrice=(v:number)=>new Intl.NumberFormat(locale(),{style:'currency',currency:'CAD'}).format(v);
const cacheHours=4;
function providerLine(item:Item):string{
  // Only exact catalogue translations. No fuzzy substitution of different foods.
  const english=catalogExactProduct(item.name)?.en||item.name;
  const n=Number(item.quantity.trim());
  // Quantities like '500g' are not guessed as 500 packages. The provider will
  // mark incompatible sizes as closest/not_tracked until the user specifies them.
  return Number.isInteger(n)&&n>1&&n<=20?english+' x'+n:english;
}
export function HalifaxListComparison({region,items}:{region:GroceryRegion;items:readonly Item[]}){
  const enabled=halifaxProviderStores(region).length>0;
  const [data,setData]=useState<Plan|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const selected=halifaxProviderStores(region).map(s=>HALIFAX_PROVIDER_STORES[s.id]);
  const compared=items.filter(i=>!i.checked).slice(0,30);
  const lines=compared.map(providerLine);
  const fingerprint=JSON.stringify([region.city,selected,lines]);
  const [lastFingerprint,setLastFingerprint]=useState('');
  const current=data!==null&&lastFingerprint===fingerprint;
  const compare=async()=>{
    if(loading||!enabled||lines.length===0)return;
    setLoading(true);setError('');setData(null);setLastFingerprint(fingerprint);
    const cacheKey=key+fingerprint;
    try{
      const raw=localStorage.getItem(cacheKey);
      const existing=raw?JSON.parse(raw):null;
      if(existing?.at&&Date.now()-existing.at<cacheHours*3600000&&existing.value?.source==='GroceryPulse.ca'){
        setData(existing.value as Plan);return;
      }
      const response=await basketFetch('/api/shopper-prices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({city:'halifax',lines,stores:selected})});
      const payload=await response.json().catch(()=>({error:'invalid_response'})) as Record<string,unknown>;
      if(!response.ok)throw Error(payload?.error==='source_rate_limited'
        ? tr('Price service rate limit reached. Please try later.')
        : payload?.error==='sign_in_required'?tr('Sign in to compare prices.')
        : tr('The Halifax price comparison is unavailable right now.'));
      if(payload?.source!=='GroceryPulse.ca'||!Array.isArray(payload.stores)||!Array.isArray(payload.lines))throw Error(tr('Unexpected price comparison response.'));
      const value=payload as Plan;
      setData(value);
      try{localStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),value}));}catch{}
    }catch(e){setError(e instanceof Error?e.message:tr('The Halifax price comparison is unavailable right now.'))}
    finally{setLoading(false)}
  };
  if(!['halifax','dartmouth'].includes(region.city)||region.country!=='CA'||region.province!=='NS')return null;
  return <section className="halifax-comparison" aria-label={tr('Halifax grocery price comparison')}>
    <div className="halifax-comparison-heading">
      <div><strong>{tr('Compare prices for this list')}</strong><p>{tr('Halifax-area chain averages, not prices at your exact Halifax or Dartmouth branch.')}</p></div>
      <button type="button" className="primary" onClick={compare} disabled={!enabled||!lines.length||loading}>
        {loading?tr('Comparing…'):tr('Compare my list')}
      </button>
    </div>
    {lines.length>30&&<p>{tr('Only the first 30 open items are compared.')}</p>}
    {!enabled&&<p>{tr('Select a supported store above to compare.')}</p>}
    {error&&<p role="alert" className="regional-price-error">{error}</p>}
    {current&&data&&<div className="halifax-comparison-results">
      <p>{tr('Source: GroceryPulse.ca')} · {tr('Checked:')} {data.evaluatedOn} · {tr('CAD')}</p>
      <p>{data.recommendation?.explanation||tr('Prices are dated observations; the service may be unable to rank all stores.')}</p>
      <div className="halifax-comparison-stores">
        {data.stores.map(s=><div key={s.key} className="halifax-comparison-store">
          <b>{s.name}</b>
          {typeof s.totalCad==='number' ? <strong>{safePrice(s.totalCad)}</strong>:<span>—</span>}
          <small>{s.totalScope==='complete_requested_list'?tr('Complete compared list'):
            s.totalScope==='observed_subtotal'?tr('Only priced items — not the full list'):
              tr('Incomplete prices — not ranked')}</small>
          <small>{s.oldest?tr('Observed from:')+' '+s.oldest:''} {s.newest?tr('to')+' '+s.newest:''}</small>
        </div>)}
      </div>
      <div className="halifax-comparison-lines">
        <strong>{tr('List matching')}</strong>
        {data.lines.map((line,i)=><p key={i}><span>{line.original||line.input||line.text||line.name||lines[i]||tr('Item')}</span> · {line.status==='exact'?tr('Exact match'):
          line.status==='closest'?tr('Different product or pack size — excluded'):
          line.status==='not_tracked'?tr('Not tracked'):tr('Not compared')}</p>)}
      </div>
      <p>{tr('No substitutions are applied automatically. Unmatched items and incomplete store totals are not treated as savings.')}</p>
      <p>{tr('Retailer prices may vary by branch and date; promotions may already have ended.')}</p>
      <a href="https://grocerypulse.ca/agents" rel="noopener noreferrer" target="_blank">{tr('About GroceryPulse comparisons')}</a>
    </div>}
  </section>;
}
