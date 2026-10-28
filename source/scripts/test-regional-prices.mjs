import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const req=createRequire(import.meta.url),esbuild=req(req.resolve('esbuild',{paths:[dirname(req.resolve('vite'))]}));
await mkdir('.sites-runtime/tests',{recursive:true});
await esbuild.build({entryPoints:['tests/regional-prices.test.ts'],bundle:true,platform:'node',format:'esm',
 outdir:'.sites-runtime/tests',outExtension:{'.js':'.mjs'}});
process.exit(spawnSync(process.execPath,['--test','.sites-runtime/tests/regional-prices.test.mjs'],{stdio:'inherit'}).status??1);
