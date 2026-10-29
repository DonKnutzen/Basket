import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {browserAuth} from './supabase-browser';
import {createClient} from '@supabase/supabase-js';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase-config';
import {germanDay,germanSourceUrl} from './german-central-offers';
export const FLYER_CHUNK_BYTES=8*1024*1024;
export async function uploadGermanFlyer(file:File,meta:{retailer:'rewe'|'aldi-nord';validFrom:string;validUntil:string;sourceUrl:string},progress:(message:string)=>void){
 if(!file.name.toLowerCase().endsWith('.pdf')||file.size<5||file.size>250*1024*1024)throw Error('PDF mit maximal 250 MiB auswählen.');
 if(!germanDay(meta.validFrom)||!germanDay(meta.validUntil)||meta.validUntil<meta.validFrom)throw Error('Gültigkeitszeitraum aus dem Prospekt eingeben.');
 if(meta.sourceUrl&&!germanSourceUrl(meta.sourceUrl))throw Error('Eine offizielle REWE-/ALDI-Prospekt-URL eingeben oder das Feld leer lassen.');
 if(new TextDecoder().decode(await file.slice(0,5).arrayBuffer())!=='%PDF-')throw Error('Die Datei ist kein PDF.');
 const digest=sha256.create();
 // No full-file arrayBuffer(): the live memory bound is one 8 MiB chunk.
 for(let start=0;start<file.size;start+=FLYER_CHUNK_BYTES){digest.update(new Uint8Array(await file.slice(start,start+FLYER_CHUNK_BYTES).arrayBuffer()));progress(`Datei prüfen: ${Math.round(Math.min(start+FLYER_CHUNK_BYTES,file.size)/file.size*100)} %`)}
 const db=browserAuth();
 // The normal account client has a 12-second request deadline. Large operator
 // chunks need their own transfer deadline, without changing household calls.
 const storage=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  accessToken:async()=>{const {data,error}=await db.auth.getSession();if(error)throw error;return data.session?.access_token||null},
  global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(120000)})},
 }).storage.from('german-flyers');
 const {data:id,error}=await db.rpc('offer_import_start',{meta:{...meta,filename:file.name.slice(0,200),byteSize:file.size,sha256:bytesToHex(digest.digest())}});
 if(error)throw error;
 const {data:job,error:lookupError}=await db.from('german_offer_imports').select('status').eq('id',id).single();
 if(lookupError)throw lookupError;
 if(job.status!=='uploading')return String(id);
 const {data:existing,error:listError}=await storage.list(id+'/chunks',{limit:100});
 if(listError)throw listError;
 const names=new Set(existing.map(x=>x.name));
 for(let start=0,index=0;start<file.size;start+=FLYER_CHUNK_BYTES,index++){
  const name=String(index).padStart(4,'0');
  if(!names.has(name)){
   const {error:uploadError}=await storage.upload(`${id}/chunks/${name}`,file.slice(start,start+FLYER_CHUNK_BYTES),{contentType:'application/octet-stream',upsert:false});
   if(uploadError)throw uploadError;
  }
  progress(`PDF hochladen: ${Math.round(Math.min(start+FLYER_CHUNK_BYTES,file.size)/file.size*100)} %`);
 }
 const queued=await db.rpc('offer_import_queue',{target:id});if(queued.error)throw queued.error;
 return String(id);
}
