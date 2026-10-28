'use client';
import {createClient,type SupabaseClient,type Session} from '@supabase/supabase-js';
import {apiUrl} from './hosting';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase-config';
import {withDeadline} from './request-deadline';
let client:SupabaseClient|undefined;
export function browserAuth(){
 if(typeof window==='undefined')throw new Error('Browser authentication is only available in the browser.');
 return client??=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  auth:{storageKey:'basket-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'},
  global:{fetch:(input,init)=>withDeadline(signal=>fetch(input,{...init,signal}),{timeoutMs:12000,signal:init?.signal??undefined,message:'Could not finish signing in. Check your connection and try again.'})}
 });
}
export function setIdentityPreference(value:'email'|'chatgpt'){try{localStorage.setItem('basket-identity',value)}catch{}}
export function isEndedSessionError(error:unknown){return !!error&&typeof error==='object'&&'code'in error&&['session_not_found','session_expired','refresh_token_not_found','refresh_token_already_used','invalid_refresh_token'].includes(String(error.code))}
export async function readBrowserSession(signal?:AbortSignal):Promise<Session|null>{
 const {data,error}=await withDeadline(()=>browserAuth().auth.getSession(),{timeoutMs:12000,signal,message:'Checking your session took too long. Please try again.'});
 if(error){if(isEndedSessionError(error))return null;throw error}
 return data.session;
}
export async function basketFetch(path:string,init:RequestInit={},knownSession?:Session|null){
 const headers=new Headers(init.headers);let preference='email';try{preference=localStorage.getItem('basket-identity')||'email'}catch{}
 const session=knownSession===undefined?await readBrowserSession(init.signal??undefined):knownSession;
 if(session?.access_token){headers.set('Authorization','Bearer '+session.access_token);headers.set('X-Basket-Identity','email')}
 else headers.set('X-Basket-Identity',preference);
 return withDeadline(signal=>fetch(apiUrl(path),{...init,headers,signal,cache:'no-store'}),{timeoutMs:15000,signal:init.signal??undefined,message:'Basket cannot reach its data server right now. Please try again.'});
}
