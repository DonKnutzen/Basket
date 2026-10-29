'use client';
import React,{useState} from 'react';
import {getLanguage} from '../lib/i18n';
import {matchGermanDrafts,searchGermanDraftCatalogue,unverifiedOfferCount,compactGermanDraftTitle,type GermanDraft} from '../lib/german-offer-drafts';
import {useCentralGermanOffers} from '../lib/german-offer-store';
import {OfferSourceLink} from './offer-source-link';

const eur=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n/100);

function DraftRow({draft:d}:{draft:GermanDraft}){
 const de=getLanguage()==='de',unreadable=d.status==='unreadable';
 const title=compactGermanDraftTitle(d.name,d.brand);
 const shop=d.retailer==='aldi-nord'?'ALDI Nord':d.retailer==='rewe'?'REWE':'PENNY';
 return <article className={'german-draft-card '+d.retailer+(unreadable?' is-unreadable':'')}>
  <div className="german-draft-head">
   <span className="german-draft-shop">{shop}</span>
   <span className="german-draft-status">{unreadable?(de?'Nicht eindeutig':'Unclear'):(de?'Ungeprüft':'Unverified')}</span>
  </div>
  <div className="german-draft-main">
   <div className="german-draft-info">
    <strong className="german-draft-name" title={title.full}>{title.title}</strong>
    <span className="german-draft-size">{d.packSize|| (de?'Packungsgröße unklar':'Pack size unclear')}{d.unitInferred?' · '+(de?'aus Prospekttext':'from flyer text'):''}{d.variant?' · '+d.variant:''}</span>
   </div>
   <div className="german-draft-money">
    {d.priceUsable?<><small>{d.priceFromBase?(de?'Aus Grundpreis berechnet · ungeprüft':'Calculated from unit price · unverified'):(de?'Preisvorschlag':'Possible price')}</small><strong>{d.priceFromBase?'≈ ':''}{eur(d.displayPriceCents)}</strong></>:
     <span>{de?'Preis prüfen':'Check price'}</span>}
   </div>
  </div>
  {d.priceFromBase&&<small className="german-draft-disclaimer">{de?'Nur rechnerischer Hinweis, kein bestätigter Angebotspreis. Bitte Originalprospekt prüfen.':'Calculated estimate only, not a confirmed sale price. Check the original flyer.'}</small>}
  {title.truncated&&<details className="german-draft-description">
   <summary>{de?'Vollständigen Produkttext anzeigen':'Show full product description'}</summary>
   <p>{title.full}</p>
  </details>}
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
 const state=useCentralGermanOffers(),[visibleCount,setVisibleCount]=useState(2),de=getLanguage()==='de';

 const matches=matchGermanDrafts(name,state.drafts,stores);
 if(!matches.length)return null;
 return <details className="german-draft-matches">
  <summary>{unverifiedOfferCount(matches.length,de)}</summary>
  <div className="german-draft-list">
   {state.draftError&&<small role="status">{de?state.draftError:'Unverified offers are currently unavailable.'}</small>}
   <p className="german-draft-disclaimer">{de?'Noch nicht bestätigt · Preise nicht im offiziellen Vergleich enthalten.':'Not verified · prices excluded from confirmed comparisons.'}</p>
   {matches.slice(0,visibleCount).map(d=><DraftRow key={d.id} draft={d}/>)}
   {matches.length>visibleCount&&visibleCount<8&&<button type="button" className="german-draft-more" onClick={()=>setVisibleCount(n=>Math.min(n+3,8))}>{de?`Weitere Angebote anzeigen (${Math.min(3,matches.length-visibleCount)})`:`Show more offers (${Math.min(3,matches.length-visibleCount)})`}</button>}
   {matches.length>8&&visibleCount>=8&&<small>{de?`Weitere ${matches.length-8} Angebote unter „Wöchentliche Angebote“ durchsuchen.`:`Search ${matches.length-8} more in Weekly offers.`}</small>}
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
