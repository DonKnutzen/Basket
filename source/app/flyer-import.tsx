'use client';
import React,{useEffect,useRef,useState} from 'react';
import {tr} from '../lib/i18n';
import {
 FLYER_CHANGED_EVENT,FLYER_STORAGE_KEY,FLYER_STORES,extractFlyerCandidates,flyerMatches,
 isDay,priceCents,readPrivateFlyers,writePrivateFlyers,
 type FlyerCandidate,type FlyerPrice,type FlyerStore,
} from '../lib/flyer-prices';
import {readFlyerFile,flyerFileError} from '../lib/flyer-reader';
type Edit=FlyerCandidate&{id:number;enabled:boolean};
function kielToday(){
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
const nameFor=(id:string)=>FLYER_STORES.find(s=>s.id===id)?.name||id;
function signalChange(){window.dispatchEvent(new Event(FLYER_CHANGED_EVENT));}
function priceLabel(cents:number){return (cents/100).toFixed(2).replace('.',',')+' €'}
export function useLocalFlyerPrices(){
 const [prices,setPrices]=useState<FlyerPrice[]>([]);
 useEffect(()=>{
  const update=()=>setPrices(readPrivateFlyers(localStorage,kielToday()));
  update();window.addEventListener(FLYER_CHANGED_EVENT,update);
  window.addEventListener('storage',update);
  return ()=>{window.removeEventListener(FLYER_CHANGED_EVENT,update);window.removeEventListener('storage',update)};
 },[]);
 return prices;
}
/** Local household-only import. Nothing gets POSTed to Basket's API. */
export function GermanFlyerImport(){
 const [file,setFile]=useState<File|null>(null);
 const [startPage,setStartPage]=useState(1);
 const [store,setStore]=useState<FlyerStore>('rewe');
 const [from,setFrom]=useState(''),[until,setUntil]=useState('');
 const [rows,setRows]=useState<Edit[]>([]);
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [text,setText]=useState(''),[hasRead,setHasRead]=useState(false);
 const [confirmClear,setConfirmClear]=useState(false);
 const prices=useLocalFlyerPrices();
 const gen=useRef(0);
 useEffect(()=>()=>{gen.current++},[]);
 const edit=(id:number,patch:Partial<Edit>)=>setRows(r=>r.map(x=>x.id===id?{...x,...patch}:x));
 async function read(){
  if(!file)return;
  const token=++gen.current;
  setBusy(true);setRows([]);setHasRead(false);setError('');setNotice('');
  try{
   const validation=flyerFileError(file);
   if(validation)throw new Error(tr(validation));
   const result=await readFlyerFile(file,stage=>{if(token===gen.current)setProgress(stage)},startPage);
   if(token!==gen.current)return;
   const candidates=extractFlyerCandidates(result.text);
   setText(result.text);setHasRead(true);
   setRows(candidates.map((c,id)=>({...c,id,enabled:false})));
   const pageInfo=/\.pdf$/i.test(file.name)||file.type==='application/pdf'?
    ' '+tr('PDF pages analyzed: ')+result.pageRange+' / '+result.pages+'.'+(startPage+7<result.pages?' '+tr('Choose the next starting page to read more pages.'):''):'';
   setNotice((candidates.length?
    tr('Check each product and price against your original flyer. Select only verified entries.'):
    tr('No reliable same-line prices found. You can add an offer manually below.'))+pageInfo);
  }catch(e){if(token===gen.current)setError(e instanceof Error?e.message:tr('The flyer could not be read.'))}
  finally{if(token===gen.current){setBusy(false);setProgress('')}}
 }
 const manual=()=>{setRows(r=>[...r,{id:Math.max(-1,...r.map(x=>x.id))+1,enabled:true,name:'',price:'',packSize:'',line:''}]);setHasRead(true)};
 function save(){
  setError('');setNotice('');
  const today=kielToday();
  if(!file||!hasRead){setError(tr('Choose and read a flyer first.'));return}
  if(!isDay(from)||!isDay(until)||from>until){setError(tr('Enter the correct start and end dates shown in the flyer.'));return}
  const chosen=rows.filter(x=>x.enabled);
  if(!chosen.length){setError(tr('Select at least one checked offer.'));return}
  if(chosen.length>80){setError(tr('Too many offers selected.'));return}
  const converted:FlyerPrice[]=[];
  for(const row of chosen){
   const cents=priceCents(row.price);
   if(row.name.trim().length<2||row.name.length>110||cents===null||row.packSize.length>50){
    setError(tr('Check the product name, pack size and price of every selected offer.'));return;
   }
   converted.push({
    id:crypto.randomUUID(),name:row.name.trim(),packSize:row.packSize.trim(),
    priceCents:cents,store,validFrom:from,validUntil:until,
    region:'Kiel',sourceFile:file.name.slice(0,130),importedAt:today,
   });
  }
  try{
   const count=writePrivateFlyers(localStorage,converted,readPrivateFlyers(localStorage,today),today);
   signalChange();setNotice(tr('Verified offers saved on this device: ')+converted.length+'. '+tr('Local flyer prices currently saved: ')+count+'.');
   setRows([]);setFile(null);setHasRead(false);setText('');
  }catch{setError(tr('Cannot save on this device. Check available browser storage.'))}
 }
 function clear(){
  if(!confirmClear){setConfirmClear(true);return}
  try{localStorage.removeItem(FLYER_STORAGE_KEY);signalChange();setConfirmClear(false);setNotice(tr('Locally imported flyer offers deleted.'))}
  catch{setError(tr('Could not remove saved flyers.'))}
 }
 return <section className="flyer-import">
  <h3>{tr('Import a weekly flyer privately')}</h3>
  <p>{tr('Download an official flyer yourself, then choose its PDF or photo. Recognition happens on your device; only offers you review are saved locally. Nothing is added to receipts or shared with your household.')}</p>
  <div className="flyer-import-form">
   <label>{tr('Retailer')}
    <select value={store} onChange={e=>setStore(e.target.value as FlyerStore)}>{FLYER_STORES.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
   </label>
   <label>{tr('Valid from')}<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
   <label>{tr('Valid until')}<input type="date" value={until} onChange={e=>setUntil(e.target.value)}/></label>
  </div>
  <label className="flyer-file-label">{tr('Your flyer (PDF up to 25 MB · photos up to 12 MB)')}
   <input type="file" accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
    disabled={busy} onChange={e=>{setFile(e.target.files?.[0]||null);setStartPage(1);setRows([]);setError('');setNotice('');setHasRead(false);setText('')}}/>
  </label>
  {file&&(file.type==='application/pdf'||/\.pdf$/i.test(file.name))&&<label className="flyer-start-page">
   {tr('PDF starting page (up to eight pages per import)')}
   <input type="number" min="1" max="999" step="1" value={startPage} disabled={busy}
     onChange={e=>setStartPage(Number(e.target.value)||1)}/>
  </label>}
  <div className="flyer-import-actions">
   <button type="button" className="primary" disabled={!file||busy} onClick={()=>void read()}>{busy?tr('Reading flyer…'):tr('Read flyer on this device')}</button>
   {busy&&<small role="status">{progress}</small>}
  </div>
  {error&&<p className="flyer-error" role="alert">{error}</p>}
  {notice&&<p className="flyer-notice" role="status">{notice}</p>}
  {hasRead&&<div className="flyer-review">
   <h4>{tr('Review detected offers')} · {rows.length}</h4>
   <p>{tr('Prices are proposals from OCR, not confirmed discounts. Compare each row with the original flyer; multi-price or split-column items may need manual entry.')}</p>
   {!!rows.length&&<div className="flyer-review-head">
    <button type="button" onClick={()=>setRows(r=>r.map(x=>({...x,enabled:true})))}>{tr('Select all for review')}</button>
    <button type="button" onClick={()=>setRows(r=>r.map(x=>({...x,enabled:false})))}>{tr('Deselect all')}</button>
   </div>}
   {rows.map(row=><div key={row.id} className="flyer-review-row">
    <label className="flyer-check"><input type="checkbox" checked={row.enabled} onChange={e=>edit(row.id,{enabled:e.target.checked})}/><span>{tr('Include')}</span></label>
    <label>{tr('Product')}<input value={row.name} maxLength={110} onChange={e=>edit(row.id,{name:e.target.value})}/></label>
    <label>{tr('Price (€)')}<input value={row.price} inputMode="decimal" onChange={e=>edit(row.id,{price:e.target.value})} placeholder="1,99"/></label>
    <label>{tr('Pack size')}<input value={row.packSize} maxLength={50} onChange={e=>edit(row.id,{packSize:e.target.value})} placeholder={tr('e.g. 500 g')}/></label>
   </div>)}
   <div className="flyer-import-actions">
    <button type="button" className="secondary" onClick={manual}>{tr('Add an offer manually')}</button>
    <button type="button" className="primary" onClick={save} disabled={!rows.some(r=>r.enabled)}>{tr('Save reviewed offers locally')}</button>
   </div>
   {!!text&&<details className="flyer-raw"><summary>{tr('View recognized text to verify prices')}</summary><pre>{text.slice(0,14000)}</pre></details>}
  </div>}
  {prices.length>0&&<div className="flyer-saved">
   <small>{tr('Active imported flyer prices on this device: ')}{prices.length}</small>
   <button type="button" className="text-link" onClick={clear}>{confirmClear?tr('Confirm deleting all locally imported offers'):tr('Delete local flyer prices')}</button>
  </div>}
 </section>;
}
export function GermanFlyerMatches({name,chosenStores}:{name:string;chosenStores:readonly string[]}){
 const imported=useLocalFlyerPrices();
 const results=flyerMatches(name,imported,kielToday(),chosenStores).slice(0,4);
 if(!results.length)return null;
 return <div className="flyer-item-results">
  <strong>🏷️ {tr('Your imported flyer matches')} ({results.length})</strong>
  {results.map(x=><div className="flyer-item-hit" key={x.id}>
   <span><b>{nameFor(x.store)}</b><small>{x.name}{x.packSize?' · '+x.packSize:''}</small></span>
   <strong>{priceLabel(x.priceCents)}</strong>
   <small>{tr('Valid')} {x.validFrom} – {x.validUntil} · {tr('Kiel')} · {tr('Check exact product and branch')}</small>
  </div>)}
 </div>;
}
