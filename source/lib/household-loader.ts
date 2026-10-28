import {withDeadline} from './request-deadline';
export type HouseholdLoad<T>={kind:'ready';data:T}|{kind:'signin'};
/** Only one read at a time. Cancellation invalidates both success and error callbacks. */
export function createHouseholdLoader<T>(options:{load:(signal:AbortSignal)=>Promise<HouseholdLoad<T>>;ready:(data:T)=>void;signin:()=>void;failed:(error:unknown)=>void;settled:()=>void;timeoutMs?:number;now?:()=>number}){
 const timeoutMs=options.timeoutMs??20000,now=options.now??Date.now;
 type Flight={controller:AbortController;started:number;promise:Promise<void>};let active:Flight|undefined;
 function cancel(){const old=active;active=undefined;old?.controller.abort()}
 function run():Promise<void>{
  // iOS may suspend timers. Do not let an old, suspended request block a resumed app.
  if(active&&now()-active.started>=timeoutMs)cancel();
  if(active)return active.promise;
  const flight:Flight={controller:new AbortController(),started:now(),promise:Promise.resolve()};active=flight;
  flight.promise=withDeadline(options.load,{timeoutMs,signal:flight.controller.signal,message:'Loading took too long. Check your connection and try again.'})
   .then(result=>{if(active!==flight)return;if(result.kind==='signin')options.signin();else options.ready(result.data)})
   .catch(error=>{if(active===flight)options.failed(error)})
   .finally(()=>{if(active===flight){active=undefined;options.settled()}});
  return flight.promise;
 }
 return {run,cancel,get busy(){return !!active}};
}
