'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {apiUrl} from './hosting';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config';
let client:SupabaseClient|undefined;
export function browserAuth(){
 if(typeof window==='undefined')throw new Error('Browser authentication is only available in the browser.');
 return client??=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{storageKey:'basket-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
}
export function setIdentityPreference(value:'email'|'chatgpt'){
 try{localStorage.setItem('basket-identity',value)}catch{}
}
export async function basketFetch(path:string,init:RequestInit={}){
 const headers=new Headers(init.headers);
 let preference='email';try{preference=localStorage.getItem('basket-identity')||'email'}catch{}
 const {data}=await browserAuth().auth.getSession();
 if(data.session?.access_token){headers.set('Authorization','Bearer '+data.session.access_token);headers.set('X-Basket-Identity','email')}
 else headers.set('X-Basket-Identity',preference);
 return fetch(apiUrl(path),{...init,headers,cache:'no-store'});
}
