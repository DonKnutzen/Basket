'use client';
/* eslint-disable @next/next/no-img-element -- private evidence uses revocable local blob URLs, not public image optimization */
import React,{useCallback,useEffect,useState} from 'react';
import {browserAuth} from '../lib/supabase-browser';
import {uploadGermanFlyer,uploadGermanFlyerFromPennyUrl} from '../lib/german-offer-upload';
import {refreshGermanOffers} from '../lib/german-offer-store';
import {berlinDay} from '../lib/rewe-official-weekly';
import {PRODUCT_CATALOG} from '../lib/product-catalog';
import {germanStoreName,germanCategoryExact,suggestGermanCategory,GERMAN_STAPLE_CATEGORIES,type GermanProduct} from '../lib/german-central-offers';
type Import={id:string;retailer:'rewe'|'aldi-nord'|'penny';filename:string;status:string;valid_from:string;valid_until:string;total_pages:number|null;revision:number;error:string|null;rights_confirmed:boolean;dates_confirmed:boolean;source_url:string;rights_note:string};
type Page={page:number;status:string;image_key:string;error:string|null;date_hints:{from:string;until:string;yearFromImport:boolean}[]};
type Candidate={id:string;page:number;data:GermanProduct;status:string;crop_key:string;issues:string[];revision:number};
const labels:Record<string,string>={uploading:'Upload unvollständig',queued:'Wartet auf Verarbeitung',processing:'Wird verarbeitet',review:'Zur Kontrolle',failed:'Verarbeitung fehlgeschlagen',published:'Veröffentlicht'};
function message(e:unknown){return e&&typeof e==='object'&&'message' in e?String(e.message):String(e)}
async function rpc(name:string,args:Record<string,unknown>){const r=await browserAuth().rpc(name,args);if(r.error)throw r.error;return r.data}
function Evidence({path,label}:{path:string;label:string}){
 const [image,setImage]=useState({path:'',url:'',error:''});
 const url=image.path===path?image.url:'',error=image.path===path?image.error:'';
 useEffect(()=>{let active=true;let objectUrl='';if(path)void browserAuth().storage.from('german-flyers').download(path).then(({data,error})=>{if(!active)return;if(error)setImage({path,url:'',error:'Ausschnitt nicht abrufbar.'});else {objectUrl=URL.createObjectURL(data);setImage({path,url:objectUrl,error:''})}});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[path]);
 return url?<a href={url} target="_blank" rel="noopener noreferrer" title="Original vergrößern"><img src={url} alt={label} className="german-evidence"/></a>:<small role="status">{error||'Originalausschnitt wird geladen …'}</small>;
}
function ReviewRow({row,busy,onSave}:{row:Candidate;busy:boolean;onSave:(fields:GermanProduct,decision:string)=>Promise<void>}){
 const [fields,setFields]=useState({...row.data,category:row.data.category||suggestGermanCategory(row.data.name)?.de||''}),[price,setPrice]=useState((row.data.priceCents/100).toFixed(2).replace('.',','));
 const edit=(key:keyof GermanProduct,value:string|number)=>setFields(x=>({...x,[key]:value}));
 const save=(decision:string)=>{
  const parsed=/^\d{1,4}(?:[.,]\d{1,2})?$/.test(price)?Math.round(Number(price.replace(',','.'))*100):0;
  if(decision==='verified'&&!germanCategoryExact(fields.category)){window.alert('Eine Kategorie aus der Liste auswählen.');return}
  void onSave({...fields,priceCents:parsed},decision);
 };
 return <article className={'german-review-row '+row.status}>
  <div className="german-review-evidence"><small>Seite {row.page} · {row.status==='verified'?'Verifiziert':row.status==='rejected'?'Ausgeschlossen':row.status==='unreadable'?'Nicht zuverlässig erkennbar':'Prüfung erforderlich'}</small><Evidence path={row.crop_key} label={`Originalbereich auf Seite ${row.page}`}/><ul>{row.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></div>
  <div className="german-review-fields">
   <label>Marke<input value={fields.brand||''} maxLength={100} onChange={e=>edit('brand',e.target.value)}/></label>
   <label className="wide">Vollständiger Produktname<input value={fields.name} maxLength={250} onChange={e=>edit('name',e.target.value)}/></label>
   <label>Variante<input value={fields.variant||''} onChange={e=>edit('variant',e.target.value)}/></label>
   <label>Kategorie<input list="german-offer-categories" value={fields.category} onChange={e=>edit('category',e.target.value)}/></label>
   <label>Packungsgröße / Varianten<input value={fields.packSize} onChange={e=>edit('packSize',e.target.value)}/></label>
   <label>Verkaufspreis / Gesamtpreis (€)<input inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)}/></label>
   <label>Grundpreis (mit Einheit)<input value={fields.basePrice||''} onChange={e=>edit('basePrice',e.target.value)}/></label>
   <label>Belegter Vergleichspreis (€)<input value={fields.regularPrice||''} onChange={e=>edit('regularPrice',e.target.value)}/></label>
   <label>Preisart<select value={fields.priceKind} onChange={e=>edit('priceKind',e.target.value)}><option value="standard">Normaler Angebotspreis</option><option value="multi">Mehrstückangebot (Gesamtpreis)</option><option value="loyalty">App / Bonus / Mitgliedschaft</option><option value="from">Ab-Preis</option><option value="tiered">Staffelpreis</option></select></label>
   <label>Erforderliche Anzahl<input type="number" min="1" max="1000" value={fields.minQuantity} onChange={e=>edit('minQuantity',Number(e.target.value))}/></label>
   <label className="wide">Bedingungen<input value={fields.conditions} maxLength={1000} onChange={e=>edit('conditions',e.target.value)}/></label>
   <label>Gültig ab<input type="date" value={fields.validFrom} onChange={e=>edit('validFrom',e.target.value)}/></label>
   <label>Gültig bis<input type="date" value={fields.validUntil} onChange={e=>edit('validUntil',e.target.value)}/></label>
   <div className="german-admin-actions wide"><button type="button" disabled={busy} onClick={()=>save('verified')}>Mit Original verglichen · bestätigen</button><button type="button" disabled={busy} onClick={()=>save('review')}>Entwurf speichern</button><button type="button" disabled={busy} onClick={()=>save('rejected')}>Ausschließen</button></div>
  </div>
 </article>;
}
export function GermanOfferAdmin(){
 const [operator,setOperator]=useState(false),[imports,setImports]=useState<Import[]>([]),[selected,setSelected]=useState('');
 const [rows,setRows]=useState<Candidate[]>([]),[pages,setPages]=useState<Page[]>([]);
 const [file,setFile]=useState<File|null>(null),[retailer,setRetailer]=useState<'rewe'|'aldi-nord'|'penny'>('rewe');
 const [from,setFrom]=useState(''),[until,setUntil]=useState(''),[source,setSource]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[progress,setProgress]=useState('');
 const [rights,setRights]=useState(''),[rightsChecked,setRightsChecked]=useState(false),[datesChecked,setDatesChecked]=useState(false);
 const [page,setPage]=useState(1),[filter,setFilter]=useState('pending'),[search,setSearch]=useState('');
 const job=imports.find(i=>i.id===selected);
 const load=useCallback(async(id:string)=>{
  const db=browserAuth();const list=await db.from('german_offer_imports').select('*').order('created_at',{ascending:false}).limit(100);
  if(list.error)throw list.error;setImports(list.data);
  if(!id){setRows([]);setPages([]);return}
  const pageResult=await db.from('german_offer_pages').select('page,status,image_key,error,date_hints').eq('import_id',id).order('page');
  if(pageResult.error)throw pageResult.error;setPages(pageResult.data);setPage(current=>pageResult.data.some(p=>p.page===current)?current:pageResult.data[0]?.page||1);
  const candidates:Candidate[]=[];
  for(let offset=0;;offset+=1000){const result=await db.from('german_offer_candidates').select('*').eq('import_id',id).order('page').order('id').range(offset,offset+999);if(result.error)throw result.error;candidates.push(...result.data);if(result.data.length<1000)break}
  setRows(candidates);
 },[]);
 function chooseImport(id:string){setSelected(id);setRightsChecked(false);setDatesChecked(false);setRights('');setPage(1);setFilter('pending');setSearch('');void load(id).catch(e=>setError(message(e)))}
 useEffect(()=>{let active=true;void browserAuth().from('german_offer_operators').select('user_id').then(({data})=>{if(active&&data?.length){setOperator(true);void load('').catch(e=>setError(message(e)))}});return()=>{active=false}},[load]);
 useEffect(()=>{if(!operator||!['queued','processing'].includes(job?.status||''))return;const timer=setInterval(()=>void load(selected).catch(e=>setError(message(e))),15000);return()=>clearInterval(timer)},[operator,selected,job?.status,load]);
 async function action(work:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await work()}catch(e){setError(message(e))}finally{setBusy(false);setProgress('')}}
 if(!operator)return null;
 const ready=rows.filter(r=>r.status==='verified').length,pending=rows.filter(r=>['review','unreadable'].includes(r.status)).length;
 const searchTerm=search.trim().toLocaleLowerCase('de');
 const shown=rows.filter(r=>searchTerm?
  [r.data.name,r.data.brand,r.data.variant||'',r.data.category].join(' ').toLocaleLowerCase('de').includes(searchTerm):
  r.page===page&&(filter==='all'||filter==='pending'&&['review','unreadable'].includes(r.status)||r.status===filter));
 return <details className="german-offer-admin"><summary>Prospekte verwalten · Betreiberbereich</summary><div className="german-admin-body">
  <p>REWE Kiel 561204 / ALDI Nord / PENNY (regionale Ausgabe prüfen). Originale bleiben privat. Der zentrale Runner startet gewöhnlich innerhalb von 15 Minuten; GitHub kann geplante Läufe verzögern.</p>
  <div className="german-admin-form">
   <label>Händler<select value={retailer} onChange={e=>setRetailer(e.target.value as typeof retailer)}><option value="rewe">REWE · Holtenauer Str. 69–71 · 561204</option><option value="aldi-nord">ALDI Nord · Region Kiel</option><option value="penny">PENNY · Region Kiel</option></select></label>
   <label>Gültig ab<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Gültig bis<input type="date" value={until} onChange={e=>setUntil(e.target.value)}/></label>
   <label className="wide">Originalprospekt-URL (bei PENNY auch direkt importierbar)<input type="url" value={source} onChange={e=>setSource(e.target.value)} placeholder="https://…"/></label>
   <label className="wide">PDF · bis 250 MiB<input type="file" accept=".pdf,application/pdf" disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
  </div>
  <button type="button" disabled={!file||busy} onClick={()=>void action(async()=>{const id=await uploadGermanFlyer(file!,{retailer,validFrom:from,validUntil:until,sourceUrl:source},setProgress);chooseImport(id);setNotice('Import gespeichert. Vorhandene Uploads werden fortgesetzt; identische Prospekte werden nicht doppelt angelegt.')})}>Hochladen und zentral analysieren</button>
  {retailer==='penny'&&<button type="button" disabled={busy||!source||!from||!until} onClick={()=>void action(async()=>{
   const id=await uploadGermanFlyerFromPennyUrl(source,{retailer:'penny',validFrom:from,validUntil:until},setProgress);
   chooseImport(id);
   setNotice('PENNY-Prospekt aus offiziellem Link in die geschützte Prüfwarteschlange übernommen. Vor Veröffentlichung sind Produktpreise, Region und Nutzungsrechte zu bestätigen.');
  })}>PENNY-PDF aus offiziellem Link laden und zentral analysieren</button>}
  {retailer==='penny'&&<small>Der Betreiber lädt das große PDF nur einmal. Vor Veröffentlichung sind alle Preis-Kandidaten anhand der Originalausschnitte zu prüfen; PENNY kann regional unterschiedliche Ausgaben haben. Empfohlen: Desktop-Browser.</small>}

  {progress&&<p role="status">{progress}</p>}{error&&<p className="flyer-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <label>Import<select value={selected} disabled={busy} onChange={e=>chooseImport(e.target.value)}><option value="">Import auswählen</option>{imports.map(i=><option key={i.id} value={i.id}>{germanStoreName(i.retailer)} · {i.valid_from} · {labels[i.status]}</option>)}</select></label>
  {job&&<>
   <div className="german-import-stats"><strong>{labels[job.status]}</strong><span>{pages.filter(p=>p.status==='done').length} / {job.total_pages??'?'} Seiten verarbeitet</span><span>{rows.length} Angebotsbereiche erkannt</span><span>{ready} bestätigt · {pending} offen · {rows.filter(r=>r.status==='unreadable').length} nicht eindeutig</span></div>
    {job.status==='review'&&ready>0&&<p role="status">{ready} bestätigte Angebote sind derzeit nur in der privaten Betreibervorschau sichtbar. Erst nach dokumentierter Freigabe und Veröffentlichung erscheinen sie auch bei anderen Haushalten im Warenkorb.</p>}
   {job.error&&<p className="flyer-error">{job.error}</p>}
   {pages.filter(p=>p.status==='failed').map(p=><p key={p.page} className="flyer-error">Seite {p.page}: {p.error}</p>)}
   {job.status==='failed'&&<button type="button" disabled={busy} onClick={()=>void action(async()=>{await rpc('offer_import_queue',{target:job.id});await load(selected)})}>Fehlgeschlagene Seiten erneut verarbeiten</button>}
   {['review','published'].includes(job.status)&&<>
    <label>Produkt oder Marke auf allen Prospektseiten suchen<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="z. B. Coca-Cola, Butter, Kaffee"/></label>
    <div className="german-admin-form"><label>Seite<select value={page} onChange={e=>setPage(Number(e.target.value))}>{pages.map(p=><option key={p.page} value={p.page}>Seite {p.page} · {rows.filter(r=>r.page===p.page).length} Bereiche</option>)}</select></label><label>Anzeige<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="pending">Prüfung erforderlich</option><option value="verified">Bestätigt</option><option value="all">Alle</option><option value="rejected">Ausgeschlossen</option></select></label></div>
    <details><summary>Originalseite ansehen · fehlende Produkte ergänzen</summary>{pages.find(p=>p.page===page)?.image_key&&<Evidence path={pages.find(p=>p.page===page)!.image_key} label={`Prospektseite ${page}`}/>}</details>
    {pages.find(p=>p.page===page)?.date_hints?.map((h,i)=><p key={i}>Gedruckter Seitenzeitraum: {h.from} – {h.until}{h.yearFromImport?' · Jahr aus Import übernommen; bestätigen.':''}</p>)}
    {['review','published'].includes(job.status)&&<button type="button" disabled={busy} onClick={()=>void action(async()=>{await rpc('offer_candidate_add',{target:job.id,page_number:page});setFilter('pending');await load(selected)})}>Produkt auf dieser Seite manuell ergänzen</button>}
    <datalist id="german-offer-categories">{[...new Set([...PRODUCT_CATALOG.map(x=>x.de),...GERMAN_STAPLE_CATEGORIES])].map(name=><option key={name} value={name}/>)}</datalist>
    {shown.map(row=>job.status==='published'&&row.status==='verified'?<p key={row.id}>{row.data.brand} {row.data.name} · {row.data.packSize} · {(row.data.priceCents/100).toFixed(2)} € · {row.status}</p>:<ReviewRow key={row.id+':'+row.revision} row={row} busy={busy} onSave={async(fields,decision)=>action(async()=>{await rpc('offer_candidate_review',{target:row.id,expected_revision:row.revision,fields,decision});await load(selected);await refreshGermanOffers()})}/>)}
    {!shown.length&&<p>Keine Einträge in dieser Ansicht. Die Originalseite kann auf fehlende Produkte geprüft werden.</p>}
   </>}
   {['review','published'].includes(job.status)&&<div className="german-publish">
    {job.retailer==='penny'?<>
     <p><strong>PENNY-Testbetrieb:</strong> Nur manuell überprüfte Preisangaben werden in Basket sichtbar. PDFs, OCR-Text und Originalausschnitte bleiben privat. Diese Freigabe behauptet keine Nutzungsrechte.</p>
     <label className="german-checkbox"><input type="checkbox" checked={datesChecked} onChange={e=>setDatesChecked(e.target.checked)}/>Zeitraum {job.valid_from} – {job.valid_until} und eventuelle abweichende Aktionsdaten mit dem Original abgeglichen.</label>
     <button type="button" disabled={busy||!ready||!datesChecked} onClick={()=>void action(async()=>{
      await rpc('offer_import_confirm_test_dates',{target:job.id});
      const fresh=await browserAuth().from('german_offer_imports').select('revision').eq('id',job.id).single();
      if(fresh.error)throw fresh.error;
      const count=await rpc('offer_import_publish_test',{target:job.id,expected_revision:fresh.data.revision});
      const current=await browserAuth().from('german_published_offers').select('id',{count:'exact',head:true}).eq('import_id',job.id);
      if(current.error)throw current.error;
      const today=berlinDay(),expected=rows.filter(r=>r.status==='verified'&&r.data.validFrom<=today&&r.data.validUntil>=today).length;
      if(current.count!==expected)throw Error('Gespeichert, aber PENNY-Testanzeige nicht vollständig bestätigt. Bitte neu laden.');
      await refreshGermanOffers();await load(selected);
      setNotice(`${count} überprüfte PENNY-Angebote veröffentlicht, ${current.count} davon im Datenzugriff bestätigt.`);
     })}>{ready} überprüfte PENNY-Angebote für den Test anzeigen</button>
     <small>Ungeprüfte oder unlesbare Bereiche bleiben unveröffentlicht. Für jede neue PENNY-Woche gelten dieselben Datums- und Preisprüfungen.</small>
    </>:<>
    <label className="german-checkbox"><input type="checkbox" checked={datesChecked} onChange={e=>setDatesChecked(e.target.checked)}/>Zeitraum {job.valid_from} – {job.valid_until} und abweichende Aktionsdaten mit dem Prospekt abgeglichen.</label>
    <label className="german-checkbox"><input type="checkbox" checked={rightsChecked} onChange={e=>setRightsChecked(e.target.checked)}/>Die Nutzung und Veröffentlichung der bestätigten Angebotsdaten ist freigegeben.</label>
    <label>Grundlage / Quellenfreigabe<textarea value={rights} maxLength={2000} onChange={e=>setRights(e.target.value)} placeholder="Berechtigung oder Freigabe dokumentieren"/></label>
    <button type="button" disabled={busy||!ready||!datesChecked||!rightsChecked||rights.trim().length<10} onClick={()=>void action(async()=>{
     await rpc('offer_import_confirm',{target:job.id,rights});
     const fresh=await browserAuth().from('german_offer_imports').select('revision').eq('id',job.id).single();if(fresh.error)throw fresh.error;
     const count=await rpc('offer_import_publish',{target:job.id,expected_revision:fresh.data.revision});
     // Verify the consumer table, rather than claiming a Git commit deployed data.
     const current=await browserAuth().from('german_published_offers').select('id',{count:'exact',head:true}).eq('import_id',job.id);if(current.error)throw current.error;
     const today=berlinDay(),expected=rows.filter(r=>r.status==='verified'&&r.data.validFrom<=today&&r.data.validUntil>=today).length;
     if(current.count!==expected)throw Error('Gespeichert, aber Auslieferungsprüfung fehlgeschlagen. Bitte Importstatus neu laden.');
     await refreshGermanOffers();await load(selected);setNotice(`${count} Angebote zentral veröffentlicht. ${current.count} davon heute über den Nutzerzugriff bestätigt.`);
    })}>{ready} bestätigte Angebote veröffentlichen</button>
    <small>Offene und ausgeschlossene Einträge bleiben unveröffentlicht. Alle PDF-Seiten müssen erfolgreich verarbeitet sein.</small>

    </>}
   </div>}
  </>}
 </div></details>;
}

