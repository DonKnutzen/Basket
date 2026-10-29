// This gateway trusts GitHub's signed workload identity, never a browser flag.
// No GitHub PAT or Supabase service key is stored in the repository or Actions.
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {authorizeWorkload} from './workload-policy.ts';

const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const check=<T>(result:{data:T;error:unknown})=>{if(result.error)throw new Error(String(JSON.stringify(result.error)));return result.data};

Deno.serve(async request=>{
 try{
  const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!token)return reply({error:'Workload identity required'},401);
  let claims;
  try{claims=await authorizeWorkload(token)}
  catch{return reply({error:'Invalid workload identity'},403)}
  const run=String(claims.run_id)+':'+String(claims.run_attempt);
  const url=new URL(request.url);
  const action=url.searchParams.get('action');
  if(action==='sources'&&request.method==='POST'){
   return reply(check(await db.from('german_offer_imports').select('id,source_url').eq('status','published').gte('valid_until',new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date())).lt('source_checked_at',new Date(Date.now()-86400000).toISOString()))||[]);
  }
  if(action==='source-status'&&request.method==='POST'){
   const b=await request.json();check(await db.rpc('offer_worker_source',{target:b.id,available:b.available===true}));return reply({ok:true});
  }
  if(action==='claim'&&request.method==='POST')return reply(check(await db.rpc('offer_worker_claim',{run})));
  const id=url.searchParams.get('import');
  if(!id||!/^[a-f0-9-]{36}$/.test(id))return reply({error:'Invalid import'},400);
  const job=check(await db.from('german_offer_imports').select('*').eq('id',id).single());
  if(job.status!=='processing'||job.worker_run!==run||Date.parse(job.lease_until)<Date.now())return reply({error:'Worker lease lost'},409);
  if(action==='download'&&request.method==='GET'){
   const key=url.searchParams.get('key')||'';
   if(!new RegExp('^'+id+'/chunks/[0-9]{4}$').test(key))return reply({error:'Invalid chunk'},400);
   const blob=check(await db.storage.from('german-flyers').download(key));
   return new Response(blob,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store'}});
  }
  if(action==='evidence'&&request.method==='POST'){
   const key=url.searchParams.get('key')||'';
   if(!new RegExp('^'+id+'/evidence/[a-zA-Z0-9_.-]+\\.png$').test(key))return reply({error:'Invalid evidence'},400);
   const bytes=await request.arrayBuffer();
   if(bytes.byteLength>10*1024*1024)return reply({error:'Evidence too large'},413);
   check(await db.storage.from('german-flyers').upload(key,bytes,{contentType:'image/png',upsert:true}));
   return reply({ok:true});
  }
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  const b=await request.json();
  if(action==='metadata'){
   if(!Number.isInteger(b.totalPages)||b.totalPages<1||b.totalPages>1000)return reply({error:'Invalid page count'},400);
   check(await db.from('german_offer_imports').update({total_pages:b.totalPages,source_available:b.sourceAvailable===true,source_checked_at:new Date().toISOString(),lease_until:new Date(Date.now()+1200000).toISOString()}).eq('id',id).eq('worker_run',run));
   return reply({pages:check(await db.from('german_offer_pages').select('page,status').eq('import_id',id))});
  }
  if(action==='page'){
   check(await db.rpc('offer_worker_page',{target:id,run,page_number:b.page,payload:b.payload}));
   return reply({ok:true});
  }
  if(action==='finish'){
   const pages=check(await db.from('german_offer_pages').select('page,status').eq('import_id',id))||[];
   const complete=pages.length===job.total_pages&&pages.every(p=>p.status==='done');
   check(await db.from('german_offer_imports').update({status:complete?'review':'failed',error:complete?null:'Mindestens eine Seite fehlgeschlagen. Import fortsetzen.',lease_until:null}).eq('id',id).eq('worker_run',run));
   return reply({complete});
  }
  if(action==='fail'){
   check(await db.from('german_offer_imports').update({status:'failed',error:String(b.error).slice(0,500),lease_until:null}).eq('id',id).eq('worker_run',run));
   return reply({ok:true});
  }
  return reply({error:'Unknown action'},400);
 }catch(e){console.error(String(e));return reply({error:'Worker request failed'},500)}
});
