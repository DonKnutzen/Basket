'use client';
import React,{useState} from 'react';
import {getLanguage} from '../lib/i18n';
import {germanStoreName} from '../lib/german-central-offers';
import {matchGermanDrafts,searchGermanDraftCatalogue,unverifiedOfferCount,type GermanDraft} from '../lib/german-offer-drafts';
import {useCentralGermanOffers} from '../lib/german-offer-store';
import {OfferSourceLink} from './offer-source-link';

const eur=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n/100);

function DraftRow({draft:d}:{draft:GermanDraft}){
 const de=getLanguage()==='de',unreadable=d.status==='unreadable';
 const identity=d.brand&&d.name.toLocaleLowerCase('de').startsWith(d.brand.toLocaleLowerCase('de'))?d.name:
  [d.brand,d.name].filter(Boolean).join(' · ');
 return <article className={'german-draft-card '+d.retailer+(unreadable?' is-unreadable':'')}>
  <div className="german-draft-head">
   <span className="german-draft-shop">{germanStoreName(d.retailer)}</span>
   <span className="german-draft-status">{unreadable?(de?'Nicht eindeutig':'Unclear'):(de?'Ungeprüft':'Unverified')}</span>
  </div>
  <div className="german-draft-main">
   <div className="german-draft-info">
    <strong className="german-draft-name">{identity}</strong>
    <span className="german-draft-size">{d.packSize|| (de?'Packungsgröße unklar':'Pack size unclear')}{d.variant?' · '+d.variant:''}</span>
   </div>
   <div className="german-draft-money">
    {d.priceUsable?<><small>{de?'Preisvorschlag':'Possible price'}</small><strong>{eur(d.priceCents)}</strong></>:
     <span>{de?'Preis prüfen':'Check price'}</span>}
   </div>
  </div>
  <div className="german-draft-foot">
   <span>{de?'Prospekt S. ':'Flyer p. '}{d.page}</span>
   {d.sourceUrl&&<OfferSourceLink url={d.sourceUrl}>{de?'Original ansehen':'View original'}</OfferSourceLink>}
  </div>
  {d.issues.length>0&&<details className="german-draft-notes">
   <summary>{de?'Warum ungeprüft?':'Why unverified?'}</summary>
   <ul>{d.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>
  </details>}
 </article>;
}
/** Operator-only candidate preview: no draft ever enters the verified badge price. */
export function GermanDraftMatches({name,stores}:{name:string;stores:readonly string[]}){
 const state=useCentralGermanOffers(),[showAll,setShowAll]=useState(false),de=getLanguage()==='de';

 const matches=matchGermanDrafts(name,state.drafts,stores);
 if(!matches.length)return null;
 return <details className="german-draft-matches">
  <summary>{unverifiedOfferCount(matches.length,de)}</summary>
  <div className="german-draft-list">
   {state.draftError&&<small role="status">{de?state.draftError:'Unverified offers are currently unavailable.'}</small>}
   <p className="german-draft-disclaimer">{de?'Noch nicht bestätigt · Preise nicht im offiziellen Vergleich enthalten.':'Not verified · prices excluded from confirmed comparisons.'}</p>
   {(showAll?matches.slice(0,40):matches.slice(0,4)).map(d=><DraftRow key={d.id} draft={d}/>)}
   {matches.length>4&&<button type="button" className="german-draft-more" onClick={()=>setShowAll(!showAll)}>{showAll?(de?'Weniger anzeigen':'Show fewer'):(de?`Weitere Angebote ansehen (${matches.length-4})`:`More offers (${matches.length-4})`)}</button>}
   {showAll&&matches.length>40&&<small>{de?'Maximal 40 Treffer sichtbar; alle übrigen im Angebotskatalog.':'Showing at most 40; see the offer catalogue for the rest.'}</small>}
  </div>
 </details>;
}
/** Private searchable listing of candidate regions, not a verified prices feed. */
export function GermanDraftCatalogue({stores}:{stores:readonly string[]}){
 const state=useCentralGermanOffers(),[search,setSearch]=useState(''),[limit,setLimit]=useState(24),[filter,setFilter]=useState<'all'|'price'|'unclear'>('all'),de=getLanguage()==='de';

 const matched=searchGermanDraftCatalogue(search,state.drafts,stores);
 const candidates=matched.filter(d=>filter==='all'||filter==='price'&&d.priceUsable||filter==='unclear'&&!d.priceUsable);
 const count=state.drafts.filter(d=>!stores.length||stores.includes(d.retailer==='aldi-nord'?'aldi':d.retailer)).length;
 return <details className="german-offer-admin german-draft-catalogue">
  <summary>{de?`Ungeprüfte Angebote durchsuchen (${count})`:`Search unverified offers (${count})`}</summary>
  <div className="german-admin-body">
   <p className="german-draft-disclaimer">{de?'Für alle angemeldeten Konten · Diese Prospektbereiche sind noch nicht bestätigt. Angezeigte Preise sind lediglich Vorschläge.':'For all signed-in accounts · These flyer candidates are unverified. Displayed prices are suggestions only.'}</p>
   {state.draftError&&<p role="status">{de?state.draftError:'Unverified offers are currently unavailable.'}</p>}
   <label>{de?'Produkt, Marke oder Menge suchen':'Search product, brand or pack size'}
    <input type="search" value={search} onChange={e=>{setSearch(e.target.value);setLimit(24)}} placeholder={de?'z. B. Butter, Joghurt, Coca-Cola':'e.g. Butter, yogurt, Coca-Cola'}/>
   </label>
   <label>{de?'Ergebnisfilter':'Result filter'}
    <select value={filter} onChange={e=>{setFilter(e.target.value as 'all'|'price'|'unclear');setLimit(24)}}>
     <option value="all">{de?'Alle ungeprüften Angebote':'All unverified offers'}</option>
     <option value="price">{de?'Mit Preisvorschlag':'With possible price'}</option>
     <option value="unclear">{de?'Preis nicht eindeutig':'Price unclear'}</option>
    </select>
   </label>
   <small className="german-draft-count">{unverifiedOfferCount(candidates.length,de)}</small>
   <div className="german-draft-list">{candidates.slice(0,limit).map(d=><DraftRow key={d.id} draft={d}/>)}</div>
   {!candidates.length&&<p>{de?'Keine Treffer für diese Suche. Auch nicht erkannte Produkte können im Prospekt stehen.':'No matches. The flyer may still contain products that were not recognized.'}</p>}
   {candidates.length>limit&&<button type="button" className="german-draft-more" onClick={()=>setLimit(n=>n+24)}>{de?'Weitere 24 Angebote':'Show 24 more offers'}</button>}
  </div>
 </details>;
}
