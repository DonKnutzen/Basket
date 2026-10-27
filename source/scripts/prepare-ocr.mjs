import {createRequire} from 'node:module';
import {dirname,resolve,join} from 'node:path';
import {mkdir,copyFile,readdir,readFile,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),tess=resolve(dirname(require.resolve('tesseract.js')),'..'),core=dirname(require.resolve('tesseract.js-core',{paths:[tess]})),root=resolve('public/ocr');
await mkdir(join(root,'core'),{recursive:true});await mkdir(join(root,'lang'),{recursive:true});await copyFile(join(tess,'dist/worker.min.js'),join(root,'worker.min.js'));
for(const f of await readdir(core))if(/\.wasm(?:\.js)?$/.test(f))await copyFile(join(core,f),join(root,'core',f));
for(const lang of ['eng','fra'])await copyFile(join(dirname(require.resolve('@tesseract.js-data/'+lang)),'4.0.0',lang+'.traineddata.gz'),join(root,'lang',lang+'.traineddata.gz'));
let license='';for(const [name,dir]of [['tesseract.js',tess],['tesseract.js-core',core]])for(const f of ['LICENSE','LICENSE.txt']){try{license+=name+'\n'+await readFile(join(dir,f),'utf8')+'\n';break}catch{}}
await writeFile(join(root,'LICENSES.txt'),license);console.log('Local OCR assets prepared.');
