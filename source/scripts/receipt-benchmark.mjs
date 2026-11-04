// Real-photo benchmark for the receipt scanner: every photo in tests/receipt-photos/images is read by the
// app's own pipeline (lib/receipt-image prepareForOcr → lib/receipt-ocr readReceiptPhoto → parseReceipt),
// once as taken and once per simulated lighting/capture condition, and compared with the hand-checked
// reference JSON next to it. Photos are not in git (card digits, addresses); see tests/receipt-photos/README.md.
//   node scripts/receipt-benchmark.mjs [--label baseline] [--only de-famila-kiel] [--variants orig,dark] [--jobs 4] [--lang eng+deu]
import {createRequire} from 'node:module';import {dirname,join} from 'node:path';import {readFileSync,readdirSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
const req=createRequire(import.meta.url),esbuild=req(req.resolve('esbuild',{paths:[dirname(req.resolve('vite'))]}));
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:fallback};
const label=arg('label','run'),only=arg('only',''),jobs=Number(arg('jobs','4')),lang=arg('lang','eng+deu');
const dir='tests/receipt-photos',out=join(dir,'results');mkdirSync(out,{recursive:true});mkdirSync('.sites-runtime',{recursive:true});
await esbuild.build({stdin:{contents:`export * from './lib/receipt-image';export * from './lib/receipt-ocr';export * from './lib/receipt-parser';`,resolveDir:'.',loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/receipt-benchmark-lib.mjs',logLevel:'error'});
const lib=await import(new URL('../.sites-runtime/receipt-benchmark-lib.mjs',import.meta.url));
const sharpDir=readdirSync('node_modules/.pnpm').find(d=>d.startsWith('sharp@'));const sharp=req(join(process.cwd(),'node_modules/.pnpm',sharpDir,'node_modules/sharp'));
const {createWorker}=req('tesseract.js');

// Simulated conditions, applied to the photo as taken (after EXIF rotation, before the app's own steps).
const overlay=(w,h,svg)=>({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${svg}</svg>`),blend:'multiply'});
const VARIANTS={
 orig:s=>s,
 dim:s=>s.linear(.6,0),                                  // gedämpftes Innenlicht
 dark:s=>s.linear(.32,0),                                // dunkles Bild
 side:(s,w,h)=>s.composite([overlay(w,h,`<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#555"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`)]), // einseitige Beleuchtung
 shadow:(s,w,h)=>s.composite([overlay(w,h,`<defs><linearGradient id="g"><stop offset=".45" stop-color="#fff"/><stop offset=".6" stop-color="#6a6a6a"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`)]), // Schatten über der Preisspalte
 bright:s=>s.linear(1.6,40),                             // überbelichtet, ausgefressene Stellen
 faint:s=>s.linear(.45,140),                             // blasser Thermodruck
 blur:s=>s.blur(1.6),                                    // leicht unscharf
 small:(s,w)=>s.resize(Math.round(w/2)).jpeg({quality:55}), // kleines, stark komprimiertes Bild
};
const variants=arg('variants',Object.keys(VARIANTS).join(',')).split(',');

const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9ÄÖÜ]/g,'');
const grams=s=>{const g=[];for(let i=0;i<s.length-1;i++)g.push(s.slice(i,i+2));return g};
const similar=(a,b)=>{a=norm(a);b=norm(b);if(!a||!b)return 0;if(b.includes(a)||a.includes(b))return 1;const x=grams(a),y=grams(b);let n=0;const pool=[...y];for(const g of x){const i=pool.indexOf(g);if(i>=0){n++;pool.splice(i,1)}}return 2*n/(x.length+y.length)};
const cents=v=>Math.round(Number(v)*100);

// Each reference item is matched to at most one parsed line by its name (similarity ≥ .6), preferring the same amount.
function score(ref,d,ms){
 const used=new Set(),items=[];
 for(const r of ref.items){let pick=-1,best=0;
  d.lines.forEach((l,i)=>{if(used.has(i))return;const s=Math.max(similar(r.label,l.label),similar(r.label,l.name))+(cents(l.amount)===cents(r.amount)?.5:0);if(Math.max(similar(r.label,l.label),similar(r.label,l.name))>=.6&&s>best){best=s;pick=i}});
  if(pick>=0)used.add(pick);const l=d.lines[pick];items.push({ref:r.label,amount:r.amount,found:!!l,read:l?.label,readAmount:l?.amount,pairOk:!!l&&cents(l.amount)===cents(r.amount)})}
 const extra=d.lines.filter((_,i)=>!used.has(i)).map(l=>l.label+' '+l.amount);
 const totalOk=!!d.total&&cents(d.total)===cents(ref.total),balanced=!!d.total&&lib.difference(d)===0;
 const pairs=items.filter(i=>i.pairOk).length,found=items.filter(i=>i.found).length;
 // Prices read right regardless of the name: each reference amount consumes one parsed line with that amount.
 const pool=d.lines.map(l=>cents(l.amount)),prices=ref.items.filter(r=>{const i=pool.indexOf(cents(r.amount));if(i<0)return false;pool.splice(i,1);return true}).length;
 const complete=totalOk&&pairs===ref.items.length&&!extra.length;
 // "Presented as safe": a total, items that add up to it, no warning — what the review screen shows without any hint.
 const safe=balanced&&!(d.warnings||[]).length;
 return {id:ref.id,country:ref.country,type:ref.receiptType,ms,store:d.store,storeOk:similar(ref.store,d.store)>=.6,date:d.date,total:d.total,totalOk,balanced,refItems:ref.items.length,found,pairs,prices,extra,complete,safe,silentError:safe&&!complete,warnings:d.warnings,items};
}

const refs=readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(join(dir,f),'utf8'))).filter(r=>(!only||only.split(',').includes(r.id))&&existsSync(join(dir,'images',r.id+'.jpg')));
const queue=refs.flatMap(ref=>variants.map(v=>({ref,v}))),results=[];
async function run(worker,{ref,v}){
 const file=join(dir,'images',ref.id+'.jpg'),base=sharp(file).rotate(),{data:oriented,info}=await base.toBuffer({resolveWithObject:true});
 const shot=await VARIANTS[v](sharp(oriented),info.width,info.height).toBuffer(),meta=await sharp(shot).metadata();
 // app/scanner.tsx: canvas scaled to ~1600 px width (max 4096 px side, at most 2.5×), white background.
 const scale=Math.min(4096/Math.max(meta.width,meta.height),Math.max(1,1600/meta.width),2.5),w=Math.round(meta.width*scale),h=Math.round(meta.height*scale);
 const {data}=await sharp(shot).resize(w,h).flatten({background:'#fff'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const t0=Date.now(),prepared=lib.prepareForOcr(data,w,h).image;
 const pending=new Map(),toImage=img=>{const key={};pending.set(key,sharp(Buffer.from(img.data),{raw:{width:img.width,height:img.height,channels:1}}).png().toBuffer());return key};
 const r=await lib.readReceiptPhoto({setParameters:p=>worker.setParameters(p),recognize:async(k,o,x)=>worker.recognize(await pending.get(k),o,x)},prepared,toImage);
 const d=lib.dateFromPasses(lib.parseReceipt(r.text),r);
 return {...score(ref,d,Date.now()-t0),variant:v,confidence:Math.round(r.confidence),text:r.text};
}
await Promise.all(Array.from({length:Math.min(jobs,queue.length)},async()=>{
 const worker=await createWorker(lang.split('+'),1,{cachePath:join(process.env.TEMP||'.','basket-tessdata')});
 for(let job;(job=queue.shift());){try{const r=await run(worker,job);results.push(r);console.log(`${r.id.padEnd(26)} ${r.variant.padEnd(7)} total ${r.totalOk?'ok ':'BAD'} pairs ${r.pairs}/${r.refItems} extra ${r.extra.length} ${r.safe?'safe':'flag'}${r.silentError?' SILENT-ERROR':''} ${Math.round(r.ms/1000)}s`)}
  catch(e){results.push({id:job.ref.id,country:job.ref.country,variant:job.v,crash:String(e)});console.log(job.ref.id,job.v,'CRASH',String(e))}}
 await worker.terminate()}));

// Summary per country × condition. Definitions: tests/receipt-photos/README.md.
const rows=[];const groups=new Map();for(const r of results)for(const k of [r.country+' '+r.variant,r.country+' all','all all']){if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
for(const [k,rs] of [...groups].sort()){const ok=rs.filter(r=>!r.crash),sum=f=>ok.reduce((s,r)=>s+f(r),0),ms=ok.map(r=>r.ms).sort((a,b)=>a-b);
 rows.push({group:k,receipts:rs.length,crashes:rs.length-ok.length,totals:`${sum(r=>r.totalOk)}/${rs.length}`,items:`${sum(r=>r.found)}/${sum(r=>r.refItems)}`,pairs:`${sum(r=>r.pairs)}/${sum(r=>r.refItems)}`,prices:`${sum(r=>r.prices)}/${sum(r=>r.refItems)}`,extra:sum(r=>r.extra.length),complete:`${sum(r=>r.complete)}/${rs.length}`,safe:sum(r=>r.safe),silentErrors:sum(r=>r.silentError),flaggedWrong:`${sum(r=>!r.safe&&!r.complete)}/${sum(r=>!r.complete)}`,meanS:Math.round(sum(r=>r.ms)/ok.length/1000),maxS:Math.round((ms.at(-1)||0)/1000)})}
console.table(rows);
writeFileSync(join(out,label+'.json'),JSON.stringify({label,lang,date:new Date().toISOString(),rows,results},null,1));
console.log('wrote',join(out,label+'.json'));
