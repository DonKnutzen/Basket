'use client';
import React,{useEffect,useId,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X,Tag} from 'lucide-react';
import {getLanguage} from '../lib/i18n';
import {CentralGermanOfferMatches} from './german-central-offers';
import {GermanFlyerQuickLinks} from './german-flyer-quick-links';
import type {OfferRegion} from '../lib/current-offers';

/** Native modal lives outside the shopping grid: full width, focus trap and Escape. */
export function GermanOfferDialog({name,region,close}:{name:string;region:OfferRegion;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId(),de=getLanguage()==='de';
 useEffect(()=>{
  const el=dialog.current,previous=document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';el?.showModal();
  return()=>{el?.close();document.body.style.overflow=overflow;previous?.focus()};
 },[]);
 return createPortal(<dialog ref={dialog} className="german-offer-dialog" aria-labelledby={titleId}
  onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===e.currentTarget)close()}}>
  <div className="german-offer-sheet">
   <header className="german-offer-dialog-head">
    <div><span><Tag size={14}/>{de?'Prospektangebote · Kiel':'Flyer offers · Kiel'}</span><h2 id={titleId}>{name}</h2></div>
    <button type="button" className="german-offer-close" onClick={close} aria-label={de?'Angebote schließen':'Close offers'} autoFocus><X size={22}/></button>
   </header>
   <div className="german-offer-dialog-body">
    <CentralGermanOfferMatches key={name} name={name} stores={region.stores}/>
    <GermanFlyerQuickLinks region={region} compact/>
   </div>
  </div>
 </dialog>,document.body);
}
