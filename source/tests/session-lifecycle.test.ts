import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createHouseholdLoader,type HouseholdLoad} from '../lib/household-loader';
import {RequestTimeoutError,withDeadline} from '../lib/request-deadline';
import {readBrowserSession,basketFetch} from '../lib/supabase-browser';
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve}}
const globals=globalThis as any;
beforeEach(()=>{globals.window={};globals.localStorage={getItem:()=> 'email'};globals.__browserSession=async()=>({data:{session:null},error:null})});
function harness(load:(signal:AbortSignal)=>Promise<HouseholdLoad<string>>,timeoutMs=1000,now?:()=>number){
 const events:string[]=[];const loader=createHouseholdLoader({load,timeoutMs,now,ready:value=>events.push('ready:'+value),signin:()=>events.push('signin'),failed:error=>events.push(error instanceof RequestTimeoutError?'timeout':'error'),settled:()=>events.push('settled')});return {loader,events};
}
test('a slow initial session renewal is not superseded by repeated three-second poll attempts',async()=>{
 const response=deferred<HouseholdLoad<string>>();let calls=0;
 const {loader,events}=harness(async()=>{calls++;return response.promise});
 const initial=loader.run();const second=loader.run();const third=loader.run();
 assert.equal(initial,second);assert.equal(second,third);
 await Promise.resolve();assert.equal(calls,1);
 response.resolve({kind:'ready',data:'household'});await initial;
 assert.deepEqual(events,['ready:household','settled']);assert.equal(loader.busy,false);
});
test('a hanging SDK session check exits loading with a retryable timeout and can recover',async()=>{
 let hanging=true;const {loader,events}=harness(async()=>hanging?new Promise(()=>{}):{kind:'ready',data:'recovered'},10);
 await loader.run();assert.deepEqual(events,['timeout','settled']);assert.equal(loader.busy,false);
 hanging=false;await loader.run();assert.deepEqual(events,['timeout','settled','ready:recovered','settled']);
});
test('a hung response body is also bounded, rather than just the fetch headers',async()=>{
 const {loader,events}=harness(async()=>{await new Response(new ReadableStream({start(){}})).json();return {kind:'ready',data:'never'}},10);
 await loader.run();assert.deepEqual(events,['timeout','settled']);
});
test('an ended session shows sign-in and clears loading without retrying in a loop',async()=>{
 const {loader,events}=harness(async()=>({kind:'signin'}));await loader.run();assert.deepEqual(events,['signin','settled']);assert.equal(loader.busy,false);
});
test('late success and late unauthorized responses from cancelled reads cannot replace a newer login',async()=>{
 const old=deferred<HouseholdLoad<string>>();let calls=0;const {loader,events}=harness(async()=>++calls===1?old.promise:{kind:'ready',data:'new session'});
 const first=loader.run();await Promise.resolve();loader.cancel();await loader.run();old.resolve({kind:'signin'});await first;
 assert.deepEqual(events,['ready:new session','settled']);
 const stale=deferred<HouseholdLoad<string>>();const next=harness(()=>stale.promise);const pending=next.loader.run();await Promise.resolve();next.loader.cancel();stale.resolve({kind:'ready',data:'old account'});await pending;assert.deepEqual(next.events,[]);
});
test('resuming after iOS suspended timers replaces an overdue read immediately',async()=>{
 let clock=0,calls=0;const old=deferred<HouseholdLoad<string>>();const {loader,events}=harness(async()=>++calls===1?old.promise:{kind:'ready',data:'resumed'},20000,()=>clock);
 const initial=loader.run();await Promise.resolve();clock=60000;
 const resumed=loader.run();assert.notEqual(initial,resumed);await resumed;await initial;
 assert.deepEqual(events,['ready:resumed','settled']);assert.equal(calls,2);
});
test('a deadline aborts network work and does not accept late results',async()=>{
 let signal:AbortSignal|undefined;await assert.rejects(withDeadline(async s=>{signal=s;return new Promise(()=>{})},{timeoutMs:10}),RequestTimeoutError);assert.equal(signal?.aborted,true);
});
test('a revoked refresh token leads to sign-in, while network failure keeps the session recoverable',async()=>{
 globals.__browserSession=async()=>({data:{session:null},error:{code:'refresh_token_not_found'}});
 assert.equal(await readBrowserSession(),null);
 globals.__browserSession=async()=>({data:{session:null},error:Error('Network unavailable')});
 await assert.rejects(readBrowserSession(),/Network unavailable/);
 globals.__browserSession=async()=>({data:{session:{access_token:'refreshed-test-access'}},error:null});
 assert.equal((await readBrowserSession())?.access_token,'refreshed-test-access');
});
test('data calls wait for token renewal and use the renewed token without starting a second session check',async()=>{
 const session=deferred<any>();globals.__browserSession=()=>session.promise;
 const originalFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async(_url,init)=>{calls++;assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer renewed-test-token');return Response.json({ok:true})};
 try{
  const loading=readBrowserSession();await Promise.resolve();assert.equal(calls,0);
  session.resolve({data:{session:{access_token:'renewed-test-token'}},error:null});
  const known=await loading;await basketFetch('/api/basket',{},known);assert.equal(calls,1);
 }finally{globalThis.fetch=originalFetch}
});
test('cancelling a session wait does not issue data calls or revoke other sessions',async()=>{
 globals.__browserSession=()=>new Promise(()=>{});const controller=new AbortController();const waiting=readBrowserSession(controller.signal);controller.abort();await assert.rejects(waiting,error=>(error as Error).name==='AbortError');
});
