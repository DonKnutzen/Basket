import {withCors,preflight} from '../../../lib/cors';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from '../../../lib/supabase-config';
export const dynamic='force-dynamic';
async function getConfig(){
 try{
  const r=await fetch(SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(8000),cache:'no-store'});
  if(!r.ok)throw new Error('Unavailable');const d:any=await r.json();
  return Response.json({available:true,signupEnabled:d.disable_signup===false&&d.external?.email===true,emailConfirmationRequired:d.mailer_autoconfirm===false},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({available:false,signupEnabled:false,emailConfirmationRequired:false},{status:503,headers:{'Cache-Control':'no-store'}})}
}

export async function GET(request:Request){return withCors(await getConfig(),request)}
export const OPTIONS=preflight;
