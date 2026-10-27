import {createClient} from '@supabase/supabase-js';
import {getChatGPTUser,type ChatGPTUser} from '../app/chatgpt-auth';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase-config';
export type BasketUser=ChatGPTUser&{provider:'email'|'chatgpt'};
export async function getBasketUser(request:Request):Promise<BasketUser|null>{
 const header=request.headers.get('authorization');
 if(header){
  if(!/^Bearer [^\s]+$/i.test(header))return null;
  const token=header.slice(7);if(token.length>16000)return null;
  const client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await client.auth.getUser(token);
  const user=data.user;
  if(error||!user||!user.email||!user.email_confirmed_at||user.is_anonymous)return null;
  const candidate=user.user_metadata?.display_name;
  // Names are display fields only; all authorization uses the verified user ID.
  const fullName=typeof candidate==='string'&&candidate.trim()?candidate.trim().slice(0,60):null;
  return {userId:'supabase:'+user.id,email:user.email,displayName:fullName||user.email.split('@')[0],fullName,provider:'email'};
 }
 if(request.headers.get('x-basket-identity')!=='chatgpt')return null;
 const user=await getChatGPTUser();return user?{...user,provider:'chatgpt'}:null;
}
