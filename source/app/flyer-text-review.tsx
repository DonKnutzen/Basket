'use client';
import React,{useMemo,useState} from 'react';
import {tr} from '../lib/i18n';
import {findFlyerTextLines,flyerTextPages,flyerTextSegments} from '../lib/flyer-text-review';

/** A human-readable, bounded, per-page view of text recognized on-device. */
export default function FlyerTextReview({raw,onAddLine}:{raw:string;onAddLine:(line:string)=>void}){
 const pages=useMemo(()=>flyerTextPages(raw),[raw]);
 const [pageNumber,setPageNumber]=useState<number>(pages[0]?.number||1);
 const [query,setQuery]=useState('');
 const [priceOnly,setPriceOnly]=useState(true);
 const [limit,setLimit]=useState(60);
 const current=pages.find(p=>p.number===pageNumber)||pages[0];
 const matches=current?findFlyerTextLines(current,query,priceOnly):[];
 const amount=pages.reduce((total,p)=>total+p.lines.filter(line=>line.hasPrice).length,0);
 const showPage=(n:number)=>{setPageNumber(n);setLimit(60)};
 return <details className="flyer-raw">
  <summary>{tr('Recognized flyer text — organized by page')} · {pages.length} {tr('pages')} · {amount} {tr('lines with price-like numbers')}</summary>
  <p className="flyer-raw-help">{tr('These are unverified OCR/PDF text fragments, not confirmed offers. Highlighted amounts can also be unit or original prices. Compare each one with your original flyer.')}</p>
  <div className="flyer-raw-toolbar">
   <label>{tr('Page')}
    <select aria-label={tr('Flyer page')} value={current?.number||1} onChange={e=>showPage(Number(e.target.value))}>
     {pages.map(p=><option key={p.number} value={p.number}>{tr('Page')} {p.number} · {p.lines.length} {tr('lines')}</option>)}
    </select>
   </label>
   <label>{tr('Search recognized text')}
    <input type="search" value={query} onChange={e=>{setQuery(e.target.value);setLimit(60)}} placeholder={tr('e.g. butter, milk or 1,59')}/>
   </label>
  </div>
  <label className="flyer-raw-filter">
   <input type="checkbox" checked={priceOnly} onChange={e=>{setPriceOnly(e.target.checked);setLimit(60)}}/>
   {tr('Show only lines containing price-like numbers')}
  </label>
  <p className="flyer-raw-count">{matches.length} {tr('matching text lines')} · {tr('Page')} {current?.number||1}</p>
  {!matches.length&&<p className="flyer-raw-empty">{tr('No matching lines here. Try disabling the price filter or switching pages.')}</p>}
  <ol className="flyer-raw-lines">
   {matches.slice(0,limit).map(line=><li key={line.number} className="flyer-raw-line">
     <span className="flyer-raw-line-number" aria-label={tr('Line')+' '+line.number}>{line.number}</span>
     <div className="flyer-raw-line-text">
      <span>{flyerTextSegments(line.value).map((s,i)=>s.price?<mark key={i}>{s.value}</mark>:<React.Fragment key={i}>{s.value}</React.Fragment>)}</span>
      <small>{line.source==='ocr'?tr('Image recognition'):tr('PDF text')}</small>
     </div>
     <button type="button" onClick={()=>onAddLine(line.value)} title={tr('Copy this line into an unchecked draft offer')}>
      {tr('Use as draft')}
     </button>
   </li>)}
  </ol>
  {matches.length>limit&&<button type="button" className="secondary flyer-raw-more" onClick={()=>setLimit(n=>Math.min(n+60,600))}>
    {tr('Show more lines')} ({matches.length-limit})
   </button>}
 </details>;
}
