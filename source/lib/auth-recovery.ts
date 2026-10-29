import type {Session} from '@supabase/supabase-js';
import {isEndedSessionError} from './supabase-browser';

/**
 * A single 401 from the Basket API is not proof that Supabase signed out.
 * In particular, a phone may resume with an access token just as it expires.
 * Renew once, retry once, and never clear a valid session for an API outage.
 */
export async function recoverHouseholdUnauthorized(
 initial:Response,
 session:Session|null,
 refresh:()=>Promise<{data:{session:Session|null};error:unknown}>,
 retry:(renewed:Session)=>Promise<Response>
):Promise<{kind:'response';response:Response}|{kind:'signin'}>{
 if(initial.status!==401)return {kind:'response',response:initial};
 if(!session)return {kind:'signin'};
 let result:{data:{session:Session|null};error:unknown};
 try{result=await refresh()}
 catch{throw Error('Could not verify your session right now. Check your connection and try again.')}
 if(result.error){
  if(isEndedSessionError(result.error))return {kind:'signin'};
  throw Error('Could not verify your session right now. Check your connection and try again.');
 }
 if(!result.data.session)return {kind:'signin'};
 let second:Response;
 try{second=await retry(result.data.session)}
 catch{throw Error('Basket cannot reach its data server right now. Please try again.')}
 if(second.status===401){
  // Supabase still has a valid, freshly renewed session. Treat the server's
  // refusal as a recoverable backend problem, not as a user sign-out.
  throw Error('Basket could not verify your account right now. Please try again.');
 }
 return {kind:'response',response:second};
}
