'use client';
import {useSyncExternalStore} from 'react';
import {browserAuth} from './supabase-browser';
import {parseGermanOffer,untilBerlinMidnight,type GermanOffer} from './german-central-offers';
import {parseGermanDraft,type GermanDraft} from './german-offer-drafts';
type Snapshot={offers:GermanOffer[];previewOffers:GermanOffer[];drafts:GermanDraft[];isOperator:boolean;loading:boolean;error:string;updated:number};
const initial:Snapshot={offers:[],previewOffers:[],drafts:[],isOperator:false,loading:true,error:'',updated:0};
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
   const previewOffers:GermanOffer[]=[],drafts:GermanDraft[]=[];
   let isOperator=false;
   // Candidate and import RLS expose this view only to the signed-in operator.
   // It is deliberately kept separate from the published offer collection.
   const operator=await db.from('german_offer_operators').select('user_id').limit(1);
   if(!operator.error&&operator.data.length){
    isOperator=true;
    try{
     const jobs=await db.from('german_offer_imports').select('id,retailer,region,market_id,filename,status,source_url,valid_from,valid_until').in('status',['review','published']);
     if(jobs.error)throw jobs.error;
     const byId=new Map(jobs.data.map(job=>[job.id,job]));
     const publishedIds=new Set(offers.map(o=>o.id));
     for(let offset=0;;offset+=1000){
      const result=await db.from('german_offer_candidates').select('id,import_id,page,bbox,data,issues,status').order('id').range(offset,offset+999);
      if(result.error)throw result.error;
      for(const row of result.data){
       const job=byId.get(row.import_id);if(!job)continue;
       if(row.status==='verified'&&!publishedIds.has(row.id)){
        const parsed=parseGermanOffer({...row.data,id:row.id,importId:row.import_id,retailer:job.retailer,
         region:job.region,marketId:job.market_id,page:row.page,bbox:row.bbox,sourceUrl:'',
         sourceStatus:'unavailable',sourceCheckedAt:null,sourceFilename:job.filename,validationStatus:'verified'});
        if(parsed)previewOffers.push(parsed);
       }else if(row.status==='review'||row.status==='unreadable'){
        const draft=parseGermanDraft(row,job);
        if(draft)drafts.push(draft);
       }
      }
      if(result.data.length<1000)break;
     }
    }catch{previewOffers.length=0;drafts.length=0}
   }
   set({offers,previewOffers,drafts,isOperator,loading:false,error:'',updated:Date.now()});
  }catch{set({offers:[],previewOffers:[],drafts:[],isOperator:false,loading:false,error:'Zentrale Angebote derzeit nicht erreichbar.',updated:Date.now()})}
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

