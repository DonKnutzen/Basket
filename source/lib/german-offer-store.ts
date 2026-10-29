'use client';
import {useSyncExternalStore} from 'react';
import {browserAuth} from './supabase-browser';
import {parseGermanOffer,untilBerlinMidnight,type GermanOffer} from './german-central-offers';
type Snapshot={offers:GermanOffer[];loading:boolean;error:string;updated:number};
const initial:Snapshot={offers:[],loading:true,error:'',updated:0};
let current=initial,pending:Promise<void>|null=null;
const listeners=new Set<()=>void>();
let stop:(()=>void)|undefined;
function set(value:Snapshot){current=value;for(const f of listeners)f()}
export async function refreshGermanOffers(){
 if(pending)return pending;
 pending=(async()=>{
  try{
   const db=browserAuth();const offers:GermanOffer[]=[];
   // Paginate, rather than losing records to PostgREST's default 1,000 row limit.
   for(let offset=0;;offset+=1000){
    const {data,error}=await db.from('german_published_offers').select('data').order('id').range(offset,offset+999);
    if(error)throw error;
    for(const row of data){const parsed=parseGermanOffer(row.data);if(parsed)offers.push(parsed)}
    if(data.length<1000)break;
   }
   set({offers,loading:false,error:'',updated:Date.now()});
  }catch{set({offers:[],loading:false,error:'Zentrale Angebote derzeit nicht erreichbar.',updated:Date.now()})}
  finally{pending=null}
 })();return pending;
}
function subscribe(listener:()=>void){
 listeners.add(listener);
 if(listeners.size===1){
  void refreshGermanOffers();const timer=window.setInterval(()=>void refreshGermanOffers(),60000);
  let midnightTimer:number;
  const midnight=()=>{set({...current,updated:Date.now()});void refreshGermanOffers();midnightTimer=window.setTimeout(midnight,untilBerlinMidnight()+10)};
  midnightTimer=window.setTimeout(midnight,untilBerlinMidnight()+10);
  const focus=()=>{if(document.visibilityState==='visible')void refreshGermanOffers()};
  window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
  const {data}=browserAuth().auth.onAuthStateChange((event)=>{
   if(event==='SIGNED_OUT')set({...initial,loading:false});
   else window.setTimeout(()=>void refreshGermanOffers(),0);
  });
  stop=()=>{clearInterval(timer);clearTimeout(midnightTimer);data.subscription.unsubscribe();window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)};
 }
 return()=>{listeners.delete(listener);if(!listeners.size){stop?.();stop=undefined}};
}
export function useCentralGermanOffers(){return useSyncExternalStore(subscribe,()=>current,()=>initial)}
const displayKey='basket-de-central-offers-visible-v1',displayEvent='basket-de-offer-display';
function displayEnabled(){try{return localStorage.getItem(displayKey)!=='false'}catch{return true}}
function subscribeDisplay(fn:()=>void){window.addEventListener(displayEvent,fn);window.addEventListener('storage',fn);return()=>{window.removeEventListener(displayEvent,fn);window.removeEventListener('storage',fn)}}
export function useGermanOfferDisplay(){
 const enabled=useSyncExternalStore(subscribeDisplay,displayEnabled,()=>true);
 return [enabled,(value:boolean)=>{try{localStorage.setItem(displayKey,String(value))}catch{}window.dispatchEvent(new Event(displayEvent))}] as const;
}
