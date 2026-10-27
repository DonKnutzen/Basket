import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const req=createRequire(import.meta.url),esbuild=req(req.resolve('esbuild',{paths:[dirname(req.resolve('vite'))]}));await mkdir('.sites-runtime/tests',{recursive:true});
await esbuild.build({entryPoints:['tests/core.test.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/core.test.mjs',plugins:[{name:'test-bindings',setup(build){build.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));build.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'supabase',namespace:'mock'}));build.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'mock'}));build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='supabase'?`export const createClient=()=>({auth:{getUser:async(token)=>({data:{user:globalThis.__tokens.get(token)||null},error:globalThis.__tokens.has(token)?null:{message:'Invalid token'}})}});`:args.path==='env'?`export const env=new Proxy({},{get:(_,key)=>globalThis.__env[key]});`:`export const getChatGPTUser=async()=>globalThis.__user;`,loader:'js'}))}}]});
process.exit(spawnSync(process.execPath,['--test','.sites-runtime/tests/core.test.mjs'],{stdio:'inherit'}).status??1);
