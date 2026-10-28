export class RequestTimeoutError extends Error {constructor(message='The request took too long. Please try again.'){super(message);this.name='RequestTimeoutError'}}
/** Bounds the entire operation, even if an SDK promise ignores cancellation. */
export async function withDeadline<T>(start:(signal:AbortSignal)=>Promise<T>,options:{timeoutMs:number;signal?:AbortSignal;message?:string}):Promise<T>{
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 let cancel:()=>void=()=>{};
 const stopped=new Promise<never>((_,reject)=>{
  cancel=()=>{const reason=options.signal?.reason||new DOMException('Cancelled','AbortError');controller.abort(reason);reject(reason)};
  if(options.signal?.aborted){cancel();return}
  options.signal?.addEventListener('abort',cancel,{once:true});
  timer=setTimeout(()=>{const reason=new RequestTimeoutError(options.message);controller.abort(reason);reject(reason)},options.timeoutMs);
 });
 try{return await Promise.race([Promise.resolve().then(()=>{if(controller.signal.aborted)throw controller.signal.reason;return start(controller.signal)}),stopped])}
 finally{if(timer)clearTimeout(timer);options.signal?.removeEventListener('abort',cancel)}
}
