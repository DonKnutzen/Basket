'use client';
import {tr,phrase,locale} from '../lib/i18n';
import React, { useState, useRef, useEffect } from 'react';
import { ScanLine, Camera, Upload, Pencil, FileText, ShieldCheck, ArrowRight, ArrowLeft, Plus, X, Check, LoaderCircle, CheckCircle2, CircleAlert } from 'lucide-react';
import { purchaseType } from '../lib/receipt-shopping';
import {RECEIPT_FIXTURES,checkReceiptFixture,type ReceiptFixture} from '../lib/receipt-fixtures';
import {getLanguage} from '../lib/i18n';
import { PAGES_BUILD } from '../lib/hosting';
import { Modal } from './basket-app';
import { parseReceipt, newLine, difference } from '../lib/receipt-parser';
import { CATEGORIES, inferCategory, normalize, localDate, money, toCents, type BasketData, type ReceiptDraft, type DraftLine } from '../lib/types';
export default function ReceiptScanner({ data, demo, initialFile, initialListId, close, save }: {
    data: BasketData;
    demo: boolean;
    initialFile?: File;
    initialListId?: string;
    close: () => void;
    save: (d: ReceiptDraft) => Promise<void>;
}) {
    const [step, setStep] = useState('start'), [draft, setDraft] = useState<ReceiptDraft | null>(null), [text, setText] = useState(''), [paste, setPaste] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('Preparing your photo…'), [progress, setProgress] = useState(0), [saving, setSaving] = useState(false), [language, setLanguage] = useState(getLanguage()==='de'?'eng+deu':'eng'), [showPhoto, setShowPhoto] = useState(false), [comparisonList, setComparisonList] = useState(initialListId || '');
    const [testFixture,setTestFixture] = useState<ReceiptFixture|null>(null), [testOcr,setTestOcr] = useState(false);
    const [listSnapshot] = useState(() => data.items.map(item => ({ ...item })));
    const worker = useRef<any>(null), run = useRef(0), preview = useRef('');
    useEffect(() => () => { run.current++; worker.current?.terminate(); if (preview.current)
        URL.revokeObjectURL(preview.current); }, []);
    const classify = (d: ReceiptDraft, id: string) => ({ ...d, listId: id || undefined, lines: d.lines.map(l => ({ ...l, purchaseType: id ? purchaseType(l.name, listSnapshot.filter(i => i.listId === id)) : 'unknown' as const })) });
    const review = (d: ReceiptDraft) => { setDraft(classify(d, comparisonList)); setStep('review'); setError(''); };
    const patch = (p: Partial<ReceiptDraft>) => setDraft(d => d ? { ...d, ...p } : d);
    const line = (id: string, p: Partial<DraftLine>) => setDraft(d => d ? { ...d, lines: d.lines.map(l => l.id === id ? { ...l, ...p } : l) } : d);
    const scan = async (file?: File, fixture?: ReceiptFixture) => {
        if (!file)
            return;
        setTestFixture(fixture || null);
        if (file.size > 25000000) {
            setError('Choose a photo under 25 MB.');
            return;
        }
        const generation = ++run.current;
        setStep('reading');
        setError('');
        setProgress(0);
        setStatus('Preparing your photo…');
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const src = URL.createObjectURL(file), image = new Image();
            image.src = src;
            try {
                await image.decode();
            }
            finally {
                URL.revokeObjectURL(src);
            }
            const scale = Math.min(1, 4096 / Math.max(image.naturalWidth, image.naturalHeight)), canvas = document.createElement('canvas');
            canvas.width = Math.round(image.naturalWidth * scale);
            canvas.height = Math.round(image.naturalHeight * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx)
                throw Error('Your browser could not prepare this photo.');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('The image could not be read.')), 'image/jpeg', .9));
            if (generation !== run.current)
                return;
            const job = (async () => { const { createWorker, PSM } = await import('tesseract.js'); const w = await createWorker(language.split('+'), 1, { ...(PAGES_BUILD ? { workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js', corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0', langPath: 'https://tessdata.projectnaptha.com/4.0.0', workerBlobURL: true } : { workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath: language.includes('deu')?'https://tessdata.projectnaptha.com/4.0.0':'/ocr/lang', workerBlobURL: false }), logger: m => { if (generation !== run.current)
                    return; setStatus(m.status === 'recognizing text' ? 'Reading your receipt…' : 'Preparing the receipt reader…'); if (m.status === 'recognizing text')
                    setProgress(Math.round(m.progress * 100)); } }); worker.current = w; if (generation !== run.current) {
                await w.terminate();
                return null;
            } await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' }); return w.recognize(canvas); })();
            const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Reading took too long. Try a sharper photo, paste receipt text, or enter the items manually.')), 90000); });
            const result = await Promise.race([job, timeout]);
            if (generation !== run.current || !result)
                return;
            const d = parseReceipt(result.data.text, data.products, data.aliases);
            if (preview.current)
                URL.revokeObjectURL(preview.current);
            preview.current = URL.createObjectURL(blob);
            d.image = blob;
            d.preview = preview.current;
            review(d);
            if (!d.lines.length)
                setError('No item lines were detected. Add them below or try a clearer photo.');
        }
        catch (e: any) {
            if (generation !== run.current)
                return;
            setError(e.message || 'The photo could not be read. Try JPG or PNG.');
            setStep('start');
        }
        finally {
            if (timer)
                clearTimeout(timer);
            worker.current?.terminate();
            worker.current = null;
        }
    };
    const scanFixturePhoto=async (fixture:ReceiptFixture)=>{
        try{
            const lines=fixture.text.split('\n');
            const canvas=document.createElement('canvas');
            canvas.width=1200;canvas.height=Math.max(520,140+lines.length*57);
            const ctx=canvas.getContext('2d');
            if(!ctx)throw Error('Cannot create the test image.');
            ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.fillStyle='#171717';ctx.font='35px monospace';
            lines.forEach((entry,index)=>ctx.fillText(entry,62,85+index*57,1080));
            const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Cannot create the test image.')),'image/png'));
            await scan(new File([blob],fixture.id+'-testbon.png',{type:'image/png'}),fixture);
        }catch(e:any){setError(e.message||'Could not create the test receipt image.');}
    };
    useEffect(() => { if (initialFile)
        void scan(initialFile); }, [initialFile]);
    const diff = draft ? difference(draft) : NaN;
    const testChecks = draft && testFixture ? checkReceiptFixture(draft,testFixture) : [];
    const valid = !testFixture && draft && draft.store.trim() && draft.date && toCents(draft.total) > 0 && Number.isFinite(diff) && Math.abs(diff) <= 1 && draft.lines.length > 0 && draft.lines.every(l => l.name.trim() && Number(l.quantity) > 0 && toCents(l.amount) >= 0);
    return <Modal title={step === 'review' ? tr("A quick check, then it\u2019s remembered.") : step === 'reading' ? tr("Reading the small print.") : tr("Give your receipt a second life.")} subtitle={step === 'review' ? tr("Check names, quantities, pack sizes and totals before saving.") : tr("A photo of your shop. A clearer picture of your spending.")} close={() => { if (!saving)
        close(); }} wide={step === 'review'}>
    {step === 'start' && <div className="scan-start"><div className="scan-art"><ScanLine size={86} strokeWidth={1}/></div><h3>{tr("The whole receipt. One clear photo.")}</h3><p>{tr("Lay it flat in good light. Keep every item and the total in frame.")}</p><div className="scan-buttons"><label className="primary"><Camera size={18}/>{tr("Take a photo")}<input type="file" accept="image/*" capture="environment" onChange={e => scan(e.target.files?.[0])}/></label><label className="secondary"><Upload size={18}/>{tr("Upload photo")}<input type="file" accept="image/*" onChange={e => scan(e.target.files?.[0])}/></label></div><label className="scan-language">{tr("Receipt language")}<select value={language} onChange={e => setLanguage(e.target.value)}><option value="eng">{tr("English")}</option><option value="deu">{tr('German')}</option><option value="eng+deu">{tr('English + German')}</option><option value="eng+fra">{tr("English + French")}</option></select></label><p className="privacy"><ShieldCheck size={15}/>{tr("Text recognition runs on your device. Photos are saved only after confirmation.")}</p><div className="scan-alternatives"><button className="text-link" onClick={() => review({ ...parseReceipt(''), lines: [newLine()] })}><Pencil size={14}/>{tr("Enter manually")}</button><button className="text-link" onClick={() => setPaste(!paste)}><FileText size={14}/>{tr("Paste receipt text")}</button></div>{paste && <form className="dialog-form paste-form" onSubmit={e => { e.preventDefault(); review(parseReceipt(text, data.products, data.aliases)); }}><label>{tr("Receipt text")}<textarea value={text} rows={7} onChange={e => setText(e.target.value)} placeholder={tr("Store name\n2026-10-27\nMILK 2L 5.49\nTOTAL 5.49")} required/></label><button className="secondary">{tr("Review receipt ")}<ArrowRight size={16}/></button></form>}<section className="receipt-test-suite"><h3>{getLanguage()==='de'?'Testbons ausprobieren':'Try test receipts'}</h3><p>{getLanguage()==='de'?'Beispiele werden mit der echten Bon-Auswertung verarbeitet. Du siehst erkannte Werte, Abweichungen und bekannte Grenzen. Die Testbons werden nicht gespeichert.':'Examples run through the real receipt parser. See recognized values, differences and known limitations. Test receipts cannot be saved.'}</p><div className="receipt-test-modes"><button type="button" className={testOcr?'secondary':'primary'} onClick={()=>setTestOcr(false)}>{getLanguage()==='de'?'Text auswerten':'Test text parser'}</button><button type="button" className={testOcr?'primary':'secondary'} onClick={()=>setTestOcr(true)}>{getLanguage()==='de'?'Foto-OCR testen':'Test photo OCR'}</button></div><div className="receipt-test-buttons">{RECEIPT_FIXTURES.map(sample=><button key={sample.id} type="button" className="secondary" onClick={()=>{if(testOcr)void scanFixturePhoto(sample);else{setTestFixture(sample);review(parseReceipt(sample.text,data.products,data.aliases));}}}>{sample.title}<ArrowRight size={14}/></button>)}</div><small>{getLanguage()==='de'?'Text testet den Parser direkt. Foto-OCR erzeugt ein lokales Testbild und durchläuft dieselbe Texterkennung wie ein echter Bon. Keine Testdaten werden gespeichert.':'Text mode checks the parser directly. Photo OCR generates a local test image and uses the real image-recognition pipeline. Test data is never saved.'}</small></section></div>}
    {step === 'reading' && <div className="scan-reading"><ScanLine size={72} strokeWidth={1}/><h3>{tr(status)}</h3><p>{tr("The first scan can take a little longer.")}</p><div className="progress"><span style={{ width: `${Math.max(4, progress)}%` }}/></div><small>{progress ? progress + '%' : tr("Getting ready\u2026")}</small><button className="secondary" onClick={() => { run.current++; worker.current?.terminate(); worker.current = null; setStep('start'); }}>{tr("Cancel scan")}</button></div>}
    {step === 'review' && draft && <form className="review" onSubmit={async (e) => { e.preventDefault(); if (!valid || saving)
        return; setSaving(true); setError(''); try {
        await save(draft);
    }
    catch (e: any) {
        setError(e.message || 'Unable to save. Your review is still here.');
    }
    finally {
        setSaving(false);
    } }}><div className="notice"><CircleAlert size={18}/><p>{tr("Receipt text can be abbreviated or misread. Use clear product names and check every amount. Confirmed names are remembered for this store.")}</p></div>{testFixture && <section className="receipt-test-results"><h3>{getLanguage()==='de'?'Testauswertung':'Test results'} · {testFixture.title}</h3><p>{testFixture.description} · {testChecks.filter(c=>c.ok).length}/{testChecks.length} {getLanguage()==='de'?'Prüfungen bestanden':'checks passed'}</p><div className="receipt-test-raw"><strong>{getLanguage()==='de'?'Original-Testbon':'Original test receipt'}</strong><pre>{testFixture.text}</pre></div><div className="receipt-test-checks">{testChecks.map((c,i)=><div key={i} className={c.ok?'receipt-test-pass':'receipt-test-fail'}><b>{c.ok?'✓':'✕'} {c.label}</b><span>{c.ok?c.actual:(getLanguage()==='de'?'Erkannt: ':'Actual: ')+c.actual+' · '+(getLanguage()==='de'?'Erwartet: ':'Expected: ')+c.expected}</span></div>)}</div><p>{getLanguage()==='de'?'Nur Testmodus – Speichern deaktiviert. Fehlgeschlagene Prüfungen zeigen tatsächliche Erkennungsgrenzen.':'Test mode only – saving disabled. Failed checks expose real parsing limitations.'}</p></section>}<div className="receipt-meta"><label>{tr("Store")}<input value={draft.store} onChange={e => patch({ store: e.target.value })} required maxLength={100} placeholder={tr("e.g. No Frills")}/></label><label>{tr("Purchase date")}<input type="date" value={draft.date} onChange={e => patch({ date: e.target.value })} required/></label><label>{tr("Currency")}<select value={draft.currency} onChange={e => patch({ currency: e.target.value })}>{['CAD', 'USD', 'EUR', 'GBP'].map(c => <option key={c} value={c}>{tr(c)}</option>)}</select></label></div>{draft.preview && <><button type="button" className="text-link view-photo" onClick={() => setShowPhoto(!showPhoto)}><Camera size={14}/>{showPhoto ? tr("Hide photo") : tr("Check against your photo")}</button>{showPhoto && <img className="review-photo" src={draft.preview} alt={tr("Receipt being reviewed")}/>}</>}<div className="receipt-shopping"><label>{tr("Compare with shopping list")}<select value={comparisonList} disabled={saving} onChange={e => { const id = e.target.value; setComparisonList(id); setDraft(d => d ? classify(d, id) : d); }}><option value="">{tr("No list comparison")}</option>{data.lists.map(l => <option value={l.id} key={l.id}>{l.name}</option>)}</select></label><p>{tr("Additional means absent from this list when you opened the scanner. Check the suggestions below. Open list items stay on your list.")}</p></div><div className="review-heading"><h3>{tr("Receipt items ")}<em>{draft.lines.length}</em></h3><span>{tr("Enter the full line total after discounts.")}</span></div><div className="review-labels"><span>{tr("PRODUCT & RECEIPT LABEL")}</span><span>{tr("PACK SIZE")}</span><span>{tr("QTY")}</span><span>{tr("LINE TOTAL")}</span><span /></div><div>{draft.lines.map((l, i) => <div className="review-line" key={l.id}><div className="review-product"><input value={l.name} required maxLength={100} aria-label={phrase("Product name {0}", (i + 1))} placeholder={tr("Product name in German or English")} list="known-products" onChange={e => { const p = data.products.find(p => normalize(p.name) === normalize(e.target.value)); line(l.id, { name: e.target.value, category: p?.category || inferCategory(e.target.value), packSize: p?.packSize || l.packSize, purchaseType: comparisonList ? purchaseType(e.target.value, listSnapshot.filter(i => i.listId === comparisonList)) : 'unknown' }); }}/><input className="original-label" aria-label={phrase("Receipt label {0}", (i + 1))} value={l.label} maxLength={150} placeholder={tr("Original receipt label")} onChange={e => line(l.id, { label: e.target.value })}/><select className="line-category" value={l.category} onChange={e => line(l.id, { category: e.target.value })} aria-label={phrase("Category {0}", (i + 1))}>{CATEGORIES.map(c => <option key={c} value={c}>{tr(c)}</option>)}</select>{comparisonList && <select className="purchase-type" aria-label={phrase("Purchase type {0}", (i + 1))} value={l.purchaseType || 'unknown'} disabled={saving} onChange={e => line(l.id, { purchaseType: e.target.value as DraftLine['purchaseType'] })}><option value="planned">{tr("On the list")}</option><option value="extra">{tr("Additional purchase")}</option><option value="unknown">{tr("Not sure / fee")}</option></select>}</div><label className="review-pack"><span>{tr("Pack size")}</span><input value={l.packSize} maxLength={50} placeholder={tr("e.g. 2 L")} aria-label={phrase("Pack size {0}", (i + 1))} onChange={e => line(l.id, { packSize: e.target.value })}/></label><label className="review-qty"><span>{tr("Qty")}</span><input type="number" min="0.001" max="10000" step="any" value={l.quantity} required aria-label={phrase("Quantity {0}", (i + 1))} onChange={e => line(l.id, { quantity: e.target.value })}/></label><label className="review-amount"><span>{tr("Line total")}</span><input type="number" min="0" max="100000" step=".01" value={l.amount} required placeholder={"0.00"} aria-label={phrase("Line total {0}", (i + 1))} onChange={e => line(l.id, { amount: e.target.value })}/></label><button type="button" className="icon-button" onClick={() => patch({ lines: draft.lines.filter(x => x.id !== l.id) })} aria-label={phrase("Remove item {0}", (i + 1))}><X size={16}/></button></div>)}</div><datalist id="known-products">{data.products.map(p => <option value={p.name} key={p.id}>{p.packSize}</option>)}</datalist><button type="button" className="secondary add-line" onClick={() => patch({ lines: [...draft.lines, newLine()] })}><Plus size={15}/>{tr("Add item or fee")}</button><p className="hint">{tr("Keep brands and sizes separate. Quantity is the number of packs; pack size is the weight or volume per pack. Apply discounts to line totals. Add deposits and fees as separate items.")}</p><div className="review-bottom"><div className={'balance ' + (Math.abs(diff) <= 1 ? 'balanced' : '')}><span>{Math.abs(diff) <= 1 ? <CheckCircle2 size={22}/> : <CircleAlert size={22}/>}</span><div><b>{Math.abs(diff) <= 1 ? tr("The numbers add up.") : tr("Let\u2019s balance the receipt.")}</b><p>{Math.abs(diff) <= 1 ? tr("Items + tax match the total.") : phrase("Difference: {0}. Check missed items, discounts and fees.", money(Number.isFinite(diff) ? diff : 0, draft.currency))}</p></div></div><div className="review-totals"><div><span>{tr("Items total")}</span><b>{money(draft.lines.reduce((s, l) => s + (toCents(l.amount) || 0), 0), draft.currency)}</b></div><label>{tr("Tax")}<input type="number" min="0" step=".01" required value={draft.tax} onChange={e => patch({ tax: e.target.value })}/></label><label>{tr("Receipt total")}<input type="number" min=".01" step=".01" required value={draft.total} placeholder={"0.00"} onChange={e => patch({ total: e.target.value })}/></label></div></div>{error && <p className="form-error" role="alert">{tr(error)}</p>}<div className="modal-actions"><button type="button" className="text-link" disabled={saving} onClick={() => {setTestFixture(null);setStep('start')}}><ArrowLeft size={15}/>{tr("Start over")}</button><button className="primary" disabled={!valid || saving}>{saving ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>} {testFixture ? (getLanguage()==='de'?'Testmodus · nicht speichern':'Test mode · cannot save') : saving ? tr("Saving\u2026") : tr("Confirm & save receipt")}</button></div></form>}{error && step !== 'review' && <p className="form-error" role="alert">{tr(error)}</p>}</Modal>;
}
