'use client';
import React,{useSyncExternalStore} from 'react';
import {isSameTabOfferLinkContext} from '../lib/offer-link-navigation';

const noEvents=()=>()=>{};
/** Always render an actual clickable link to the original retailer URL.
 * Same-tab navigation avoids empty popups in embedded iOS/PWA browsers.
 * No clipboard permissions or extra steps are required.
 */
export function OfferSourceLink({url,children,className,title}:{url:string;children:React.ReactNode;className?:string;title?:string}){
 const sameTab=useSyncExternalStore(noEvents,isSameTabOfferLinkContext,()=>false);
 return <a href={url} className={className} title={title} target={sameTab?'_self':'_blank'} rel="noopener noreferrer">{children}</a>;
}
