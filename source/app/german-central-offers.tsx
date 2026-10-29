'use client';
import React,{useState} from 'react';
import {germanSourceUrl,germanStoreName,matchCentralGermanOffers} from '../lib/german-central-offers';
import {useCentralGermanOffers,useGermanOfferDisplay} from '../lib/german-offer-store';
import {getLanguage} from '../lib/i18n';
import {OfferSourceLink} from './offer-source-link';
const eur=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n/100);
export function CentralGermanOfferMatches({name,stores}:{name:string;stores:readonly string[]}){
 const state=useCentralGermanOffers(),[all,setAll]=useState(false),[enabled]=useGermanOfferDisplay(),de=getLanguage()==='de';
 if(!enabled)return null;
 const matches=matchCentralGermanOffers(name,[...state.offers,...state.previewOffers],stores);
 if(!matches.length)return state.error?<small className="central-offer-status">{de?state.error:'Central offers are currently unavailable.'}</small>:null;
 return <div className="central-offer-results" aria-live="polite">
  {(all?matches:matches.slice(0,3)).map(({offer:o,kind})=><details className={'central-offer '+o.retailer} key={o.id}>
   <summary>
    <span className="central-offer-identity"><small>{germanStoreName(o.retailer)}{o.testOnly?' · '+(de?'Testangebot':'Test offer'):''}{state.previewOffers.some(p=>p.id===o.id)?' · '+(de?'Interne Testvorschau, nicht veröffentlicht':'Private test preview, unpublished'):''}</small><b>{[o.brand,o.name].filter(Boolean).join(' · ')}</b><span>{o.packSize|| (de?'Packungsgröße nicht angegeben':'Pack size unspecified')}{kind==='alternative'?' · '+(de?'Andere Größe / Variante':'Different size / variant'):''}</span></span>
    <strong className="central-offer-price">{o.priceKind==='from'?(de?'ab ':'from '):''}{eur(o.priceCents)}</strong>
    {o.priceKind!=='standard'&&<span className="central-offer-condition">{o.conditions}{o.priceKind==='multi'?' · '+eur(Math.round(o.priceCents/o.minQuantity))+(de?' je Stück bei Abnahme von ':' each when buying ')+o.minQuantity:''}</span>}
   </summary>
   <div className="central-offer-detail">
    {o.variant&&<p>{o.variant}</p>}{o.basePrice&&<p>{de?'Grundpreis: ':'Unit price: '}{o.basePrice}</p>}
    {o.regularPrice&&<p>{de?'Vergleichspreis: ':'Reference price: '}{o.regularPrice} €</p>}
    {o.conditions&&<p>{o.conditions}</p>}
    <p>{de?'Gültig: ':'Valid: '}{o.validFrom} – {o.validUntil}</p>
    <p>{de?'Quelle: ':'Source: '}{o.sourceFilename} · {de?'Seite':'Page'} {o.page}</p>
    {o.sourceStatus==='checked-at-import'&&germanSourceUrl(o.sourceUrl)?<><OfferSourceLink url={o.sourceUrl}>{de?'Originalprospekt ansehen':'View original flyer'}</OfferSourceLink><small>{de?'Quelle geprüft: ':'Source checked: '}{o.sourceCheckedAt?.slice(0,10)} · {de?'Im Prospekt Seite '+o.page+' öffnen.':'Open page '+o.page+' in the flyer.'}</small></>:<small>{de?'Originalquelle dokumentiert; kein aktuell bestätigter öffentlicher Link.':'Original source recorded; no confirmed public link.'}</small>}
    <small>{kind==='exact'?(de?'Produktangaben stimmen mit der Suche überein.':'Product information matches your search.'):(de?'Passendes Angebot zur Kategorie; Marke und Größe beachten.':'Category match; check brand and size.')}</small>
   </div>
  </details>)}
  {matches.length>3&&<button type="button" className="text-link" onClick={()=>setAll(!all)}>{all?(de?'Weniger anzeigen':'Show fewer'):(de?`${matches.length-3} weitere Angebote`:`${matches.length-3} more offers`)}</button>}
 </div>;
}

