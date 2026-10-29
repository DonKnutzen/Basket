'use client';
import React from 'react';
import {getLanguage} from '../lib/i18n';
import {germanStoreName} from '../lib/german-central-offers';
import {currentGermanFlyerPdfLinks} from '../lib/german-flyer-links';
import {useCentralGermanOffers} from '../lib/german-offer-store';
import {officialGermanFlyers,type OfferRegion} from '../lib/current-offers';
import {OfferSourceLink} from './offer-source-link';

const retailerName=(id:string)=>id==='aldi'?'ALDI Nord':id==='rewe'?'REWE':id==='penny'?'PENNY':id;
/** Visible to every account: direct official PDF links where an active
 * import exists, and an explicit retailer-page fallback otherwise. */
export function GermanFlyerQuickLinks({region}:{region:OfferRegion}){
 const data=useCentralGermanOffers(),de=getLanguage()==='de';
 if(region.country!=='DE'||region.city!=='Kiel')return null;
 const active=currentGermanFlyerPdfLinks(data.offers,data.drafts,region.stores);
 const byStore=new Map(active.map(x=>[x.retailer==='aldi-nord'?'aldi':x.retailer,x]));
 const fallbacks=officialGermanFlyers(region).filter(x=>['rewe','aldi','penny'].includes(x.id));
 return <section className="german-direct-flyers" aria-label={de?'Direkte Prospektlinks':'Direct flyer links'}>
  <strong>{de?'Originalprospekte öffnen':'Open original flyers'}</strong>
  <div className="german-direct-flyer-links">
   {fallbacks.map(store=>{
    const pdf=byStore.get(store.id);
    return <OfferSourceLink key={store.id} url={pdf?.url||store.url} className={'german-flyer-link '+(pdf?'is-pdf':'is-retailer')}>
     <span>{retailerName(store.id)}</span>
     <small>{pdf?(de?'Original-PDF':'Original PDF'):(de?'Angebotsseite':'Offers page')}</small>
    </OfferSourceLink>;
   })}
  </div>
  <small>{de?'PDF-Links stammen aus den aktuell importierten Prospekten. Fehlt ein gültiges PDF, öffnet der Link die offizielle Händlerseite.':'PDF links come from currently imported flyers. When no current PDF is available, links open the retailer offer page.'}</small>
 </section>;
}
