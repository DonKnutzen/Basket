'use client';
import React,{useState} from 'react';
import {getLanguage} from '../lib/i18n';
import {germanStoreName} from '../lib/german-central-offers';
import {matchGermanDrafts,searchGermanDraftCatalogue,type GermanDraft} from '../lib/german-offer-drafts';
import {useCentralGermanOffers} from '../lib/german-offer-store';
import {OfferSourceLink} from './offer-source-link';

const eur=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n/100);
function DraftRow({draft:d}:{draft:GermanDraft}){
 const de=getLanguage()==='de';
 return <div className="central-offer-detail german-draft-row">
  <strong>{germanStoreName(d.retailer)} · {d.brand?d.brand+' · ':''}{d.name}</strong>
  <small>{d.packSize|| (de?'Menge unklar':'Unknown pack size')} · {de?'PDF-Seite':'PDF page'} {d.page}</small>
  <small><b>{de?'Ungeprüfter PDF-Treffer':'Unverified PDF match'}</b> · {d.status==='unreadable'?(de?'Lesbarkeit unzureichend':'Unreadable'):(de?'Produktzuordnung zu prüfen':'Product match needs review')}</small>
  {d.priceUsable?<span>{de?'Preisvorschlag (nicht bestätigt): ':'Tentative price (not verified): '}{eur(d.priceCents)}</span>:
   <small>{de?'Preis nicht zuverlässig zugeordnet – Original prüfen.':'Price cannot be safely linked – inspect original.'}</small>}
  {d.issues.length>0&&<small>{d.issues.slice(0,2).join(' · ')}</small>}
  {d.sourceUrl&&<OfferSourceLink url={d.sourceUrl}>{de?'Originalprospekt prüfen':'Inspect original flyer'}</OfferSourceLink>}
 </div>;
}
/** Operator-only candidate preview: no draft ever enters the verified badge price. */
export function GermanDraftMatches({name,stores}:{name:string;stores:readonly string[]}){
 const state=useCentralGermanOffers(),[showAll,setShowAll]=useState(false),de=getLanguage()==='de';
 if(!state.isOperator)return null;
 const matches=matchGermanDrafts(name,state.drafts,stores);
 if(!matches.length)return null;
 return <details className="german-draft-matches">
  <summary>{de?`${matches.length} weitere PDF-Treffer zur Kontrolle (ungeprüft)`:`${matches.length} additional PDF matches to review (unverified)`}</summary>
  <small>{de?'Diese Produkte/Preise sind nicht bestätigt und werden nicht in den Preisvergleich eingerechnet.':'These items/prices are unverified and excluded from confirmed comparisons.'}</small>
  {(showAll?matches.slice(0,40):matches.slice(0,4)).map(d=><DraftRow key={d.id} draft={d}/>)}
  {matches.length>4&&<button type="button" className="offer-again" onClick={()=>setShowAll(!showAll)}>{showAll?(de?'Weniger zeigen':'Show less'):(de?'Weitere PDF-Treffer':'More PDF matches')}</button>}
 </details>;
}
/** A searchable listing of all interpretable draft regions from the 3 PDFs. */
export function GermanDraftCatalogue({stores}:{stores:readonly string[]}){
 const state=useCentralGermanOffers(),[search,setSearch]=useState(''),[limit,setLimit]=useState(24),de=getLanguage()==='de';
 if(!state.isOperator)return null;
 const candidates=searchGermanDraftCatalogue(search,state.drafts,stores);
 const count=state.drafts.filter(d=>!stores.length||stores.includes(d.retailer==='aldi-nord'?'aldi':d.retailer)).length;
 return <details className="german-offer-admin">
  <summary>{de?`Ungeprüfte Prospekt-Treffer durchsuchen (${count})`:`Search unverified flyer matches (${count})`}</summary>
  <div className="german-admin-body">
   <p>{de?'Nur für den Betreiber sichtbar. Der Katalog enthält erkannte Prüfausschnitte, nicht notwendigerweise einzelne Lebensmittel. Preise sind unverbindliche PDF-Vorschläge; unlesbare Zuordnungen werden ohne Preis angezeigt.':'Operator only. Regions may mix products and are not confirmed offers. Prices are provisional; unreadable matches show no price.'}</p>
   <label>{de?'Suche nach Marke, Lebensmittel, Sorte oder Menge':'Search brand, food, variant or size'}
    <input type="search" value={search} onChange={e=>{setSearch(e.target.value);setLimit(24)}} placeholder="z. B. Butter, Joghurt, Coca-Cola, 250 g"/>
   </label>
   <small>{de?`${candidates.length} mögliche Treffer aus ausgewählten Märkten`:`${candidates.length} possible matches in selected stores`}</small>
   {candidates.slice(0,limit).map(d=><DraftRow key={d.id} draft={d}/>)}
   {!candidates.length&&<p>{de?'Keine erkannten Bereiche passend zur Suche. Die PDF kann trotzdem unerkannte Produkte enthalten.':'No parsed regions matched; the original PDF may contain additional products.'}</p>}
   {candidates.length>limit&&<button type="button" className="offer-again" onClick={()=>setLimit(n=>n+24)}>{de?'Weitere 24 Treffer anzeigen':'Show 24 more matches'}</button>}
  </div>
 </details>;
}
