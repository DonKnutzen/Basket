'use client';
import React,{useState,useSyncExternalStore} from 'react';
import {tr} from '../lib/i18n';
import {isCopyOnlyOfferLinkContext} from '../lib/offer-link-navigation';

const noEvents=()=>()=>{};
export function OfferSourceLink({url,children,className,title}:{url:string;children:React.ReactNode;className?:string;title?:string}){
 const copyOnly=useSyncExternalStore(noEvents,isCopyOnlyOfferLinkContext,()=>false),[copied,setCopied]=useState(false);
 const copy=async()=>{
  let ok=false;
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);ok=true}}catch{}
  if(!ok)try{const el=document.createElement('textarea');el.value=url;el.setAttribute('readonly','');el.style.position='fixed';el.style.opacity='0';document.body.appendChild(el);el.select();ok=document.execCommand('copy');el.remove()}catch{}
  if(ok)setCopied(true);else window.prompt(tr('Copy the link and open it in Safari:'),url);
 };
 if(copyOnly)return <button type="button" className={className} title={tr('Copy link to open in Safari')} onClick={copy}>{children}<small className="offer-copy-label">{copied?tr('Copied — paste into Safari'):tr('Copy link for Safari')}</small></button>;
 return <a href={url} className={className} title={title} target="_blank" rel="noopener noreferrer">{children}</a>;
}
