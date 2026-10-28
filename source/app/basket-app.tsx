'use client';
import {comparisonBasis,history,comparableLines,cheapest,weightedAverage,observationFromDraft,productIdentity,productNameKey} from '../lib/price-history';
import {createHouseholdLoader} from '../lib/household-loader';
import {readBrowserSession} from '../lib/supabase-browser';
import {tr,phrase,locale} from '../lib/i18n';
import { SHOPPING_GROUPS, shoppingGroup, shoppingCategory, foodGroupClass, sortShoppingItems } from '../lib/food-presentation';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShoppingBasket, ListChecks, ReceiptText, BookOpen, ChartNoAxesCombined, Plus, Search, X, Check, ArrowRight, ArrowUpRight, Users, House, Settings2, ScanLine, Trash2, MoreHorizontal, LoaderCircle, CheckCheck, ShieldCheck, Copy, Link2, Sprout, ChevronRight, Camera, Upload, FileText, Pencil, ArrowLeft, CircleAlert, CheckCircle2, Download } from 'lucide-react';
import { CATEGORIES, normalize, inferCategory, localDate, money, toCents, newId, type BasketData, type Item, type Product, type Receipt, type ReceiptDraft } from '../lib/types';
import { demoData } from '../lib/demo';
import { parseReceipt, newLine, difference } from '../lib/receipt-parser';
import { foodIcon, iconLabel, FOOD_ICONS, type FoodIconKey } from '../lib/food-icons';
import { Food } from './art';
import LanguageSettings, {useLanguage} from './language-settings';
import {getLanguage} from '../lib/i18n';
import TextSizeSettings, { initializeTextSize } from './text-size-settings';
import ReceiptScanner from './scanner';
import { appPath, PAGES_BUILD, API_ORIGIN } from '../lib/hosting';
import AuthScreen from './auth-screen';
import ProtectedImage from './protected-image';
import BudgetPanel from './budget-panel';
import { monthOptions } from '../lib/budgets';
import { shoppingSummary } from '../lib/receipt-shopping';
import { householdSharing } from '../lib/household-display';
import { RegionalPricesSettings, RegionalPricesForItem, useGroceryRegion } from './regional-price-panel';
import {HalifaxListComparison} from './halifax-comparison';
import { browserAuth, basketFetch, setIdentityPreference } from '../lib/supabase-browser';
const TABS = [{ id: 'lists', label: 'Shopping lists', short: 'Lists', icon: ListChecks }, { id: 'receipts', label: 'Receipts', short: 'Receipts', icon: ReceiptText }, { id: 'prices', label: 'Price book', short: 'Prices', icon: BookOpen }, { id: 'spending', label: 'Spending', short: 'Spending', icon: ChartNoAxesCombined }];
export function Modal({ title, subtitle, children, close, wide = false }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    close: () => void;
    wide?: boolean;
}) { const el = useRef<HTMLDivElement>(null), closeRef = useRef(close); closeRef.current = close; useEffect(() => { const old = document.activeElement as HTMLElement, overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; const focusable = () => Array.from(el.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select,textarea,a[href]') || []).filter(e => e.offsetParent !== null); focusable()[0]?.focus(); const key = (e: KeyboardEvent) => { if (e.key === 'Escape')
    closeRef.current(); if (e.key === 'Tab') {
    const a = focusable(), first = a[0], last = a[a.length - 1];
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
    }
    else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
    }
} }; document.addEventListener('keydown', key); return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); old?.focus(); }; }, []); return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget)
    close(); }}><section ref={el} role="dialog" aria-modal="true" aria-label={title} className={'modal ' + (wide ? 'wide' : '')}><header className="modal-heading"><div><h2>{title}</h2>{subtitle && <p>{tr(subtitle)}</p>}</div><button className="icon-button" onClick={close} aria-label={tr("Close dialog")}><X size={20}/></button></header>{children}</section></div>; }
function Avatar({ name, alt = false }: {
    name: string;
    alt?: boolean;
}) { return <span className={'avatar ' + (alt ? 'alt' : '')}>{name[0]?.toUpperCase()}</span>; }
function Empty({ title, children, action }: {
    title: string;
    children: React.ReactNode;
    action?: React.ReactNode;
}) { return <div className="empty"><span><ShoppingBasket size={32} strokeWidth={1.3}/></span><h3>{title}</h3><p>{children}</p>{action}</div>; }
function applyDemo(data: BasketData, a: string, b: any) { const d = structuredClone(data); if (a === 'addItem')
    d.items.push({ ...b, checked: 0, addedBy: d.user.name }); if (a === 'updateItem') {
    const item = d.items.find(i => i.id === b.id);
    if (item && b.icon !== undefined) {
        const key = normalize(b.name ?? item.name);
        d.iconPreferences = (d.iconPreferences || []).filter(p => p.name !== key);
        if (b.icon !== 'auto')
            d.iconPreferences.push({ name: key, icon: b.icon });
    }
    d.items = d.items.map(i => i.id === b.id ? { ...i, ...b, checked: b.checked === undefined ? i.checked : Number(b.checked) } : i);
} if (a === 'deleteItem')
    d.items = d.items.filter(i => i.id !== b.id); if (a === 'clearChecked')
    d.items = d.items.filter(i => i.listId !== b.listId || !i.checked); if (a === 'addList')
    d.lists.push({ id: b.id, name: b.name }); if (a === 'renameList')
    d.lists = d.lists.map(l => l.id === b.id ? { ...l, name: b.name } : l); if (a === 'deleteList' && d.lists.length > 1) {
    d.lists = d.lists.filter(l => l.id !== b.id);
    d.items = d.items.filter(i => i.listId !== b.id);
} if (a === 'renameHome')
    d.household.name = b.name; if (a === 'deleteReceipt') {
    d.receipts = d.receipts.filter(r => r.id !== b.id);
    d.lines = d.lines.filter(l => l.receiptId !== b.id);
} if (a === 'saveBudget') {
    const id = 'demo-budget-' + b.month + '-' + b.currency + '-' + b.category;
    d.budgets = d.budgets.filter(x => !(x.month === b.month && x.currency === b.currency && x.category === b.category));
    d.budgets.push({ id, month: b.month, currency: b.currency, category: b.category, amountCents: toCents(b.amount), updatedBy: d.user.name, updatedAt: Date.now() });
} if (a === 'deleteBudget')
    d.budgets = d.budgets.filter(x => x.id !== b.id); if (a === 'saveReceipt') {
    const r = b.draft;
    const shopping = shoppingSummary(r, d.lists.find(x => x.id === r.listId)?.name, r.lines.filter((l: any) => !d.products.some(p => p.normalized === productIdentity({...l,...observationFromDraft(l)}))).map((l: any) => l.name));
    d.receipts.unshift({ shopping,country:r.country,branch:r.branch,dateEvidence:r.dateEvidence,id: r.id, store: r.store, date: r.date, totalCents: toCents(r.total), taxCents: toCents(r.tax || '0'), currency: r.currency, createdBy: d.user.name });
    for (const l of r.lines) {
        const norm = productIdentity({...l,...observationFromDraft(l)});
        let p = d.products.find(p => p.normalized === norm);
        if (!p) {
            p = { ...observationFromDraft(l), id: newId(), name: l.name, normalized: norm, category: l.category, packSize: l.packSize };
            d.products.push(p);
        }
        d.lines.unshift({ ...observationFromDraft(l),country:r.country,branch:r.branch,id: newId(), receiptId: r.id, productId: p.id, label: l.label || l.name, quantity: Number(l.quantity), amountCents: toCents(l.amount), category: l.category, packSize: l.packSize, store: r.store, date: r.date, currency: r.currency, productName: l.name });
        d.aliases = d.aliases.filter(a => !(a.store === normalize(r.store) && a.label === normalize(l.label || l.name)));
        d.aliases.push({ store: normalize(r.store), label: normalize(l.label || l.name), productId: p.id });
    }
} return d; }
export default function BasketApp() { useLanguage();
    const [data, setData] = useState<BasketData | null>(null), [demo, setDemo] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [view, setView] = useState('lists'), [listId, setListId] = useState(''), [busy, setBusy] = useState(false), [sync, setSync] = useState(''), [toast, setToast] = useState(''), [modal, setModal] = useState(''), [scanFile, setScanFile] = useState<File | undefined>(), [editing, setEditing] = useState<Item | null>(null), [receipt, setReceipt] = useState<Receipt | null>(null), [product, setProduct] = useState<Product | null>(null);
    const [needsAuth, setNeedsAuth] = useState(false), [showAccount, setShowAccount] = useState(false);
    const pending = useRef(false), demoRef = useRef(false), needsAuthRef = useRef(false); needsAuthRef.current=needsAuth;
    useEffect(() => { initializeTextSize(); }, []);
    const loader=useRef<ReturnType<typeof createHouseholdLoader<BasketData>>|null>(null);
    if(!loader.current)loader.current=createHouseholdLoader<BasketData>({
        load:async signal=>{
            const session=PAGES_BUILD?await readBrowserSession(signal):undefined;
            if(PAGES_BUILD&&!session)return {kind:'signin'};
            const response=await basketFetch('/api/basket',{signal,cache:'no-store'},session);
            if(response.status===401)return {kind:'signin'};
            const result:any=await response.json();
            if(!response.ok)throw Error(result.error||'Household unavailable. Please retry.');
            return {kind:'ready',data:result};
        },
        ready:result=>{setData(result);setNeedsAuth(false);setSync('Up to date');setError('')},
        signin:()=>{setNeedsAuth(true);setData(null);setError('')},
        failed:error=>{setError(error instanceof Error?error.message:'Your household could not be loaded. Please retry.');setSync('Check connection')},
        settled:()=>setLoading(false)
    });
    const refresh=useCallback((_initial=false)=>demoRef.current?Promise.resolve():loader.current!.run(),[]);
    useEffect(()=>{
        let authTimer:ReturnType<typeof setTimeout>|undefined;
        const visible=()=>document.visibilityState==='visible'&&!demoRef.current&&!pending.current;
        const resume=()=>{if(visible())void refresh()};
        void refresh(true);
        const timer=setInterval(()=>{if(visible()&&!needsAuthRef.current)void refresh()},3000);
        document.addEventListener('visibilitychange',resume);
        window.addEventListener('pageshow',resume);
        window.addEventListener('focus',resume);
        window.addEventListener('online',resume);
        // Never call or await an auth API from inside its own state-change callback.
        const {data:subscription}=browserAuth().auth.onAuthStateChange(event=>{
            if(demoRef.current)return;
            if(event==='SIGNED_OUT'){
                loader.current?.cancel();setData(null);setNeedsAuth(true);setLoading(false);setModal('');setError('');
            }else if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'){
                if(authTimer)clearTimeout(authTimer);
                authTimer=setTimeout(resume,0);
            }
        });
        return()=>{
            clearInterval(timer);if(authTimer)clearTimeout(authTimer);
            document.removeEventListener('visibilitychange',resume);
            window.removeEventListener('pageshow',resume);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);
            subscription.subscription.unsubscribe();loader.current?.cancel();
        };
    },[refresh]);
    useEffect(() => { if (data && !data.lists.some(l => l.id === listId))
        setListId(data.lists[0]?.id || ''); }, [data, listId]);
    useEffect(() => { if (toast) {
        const t = setTimeout(() => setToast(''), 4000);
        return () => clearTimeout(t);
    } }, [toast]);
    const mutate = async (a: string, b: any = {}, message = '') => { if (pending.current)
        throw Error('Please wait for your change to save.'); pending.current = true; setBusy(true); loader.current?.cancel(); setSync('Saving…'); try {
        let result: any;
        if (demo) {
            const id = a === 'addList' ? newId() : b.id;
            setData(d => d ? applyDemo(d, a, { ...b, id }) : d);
            result = { id };
            setSync('Demo household');
        }
        else {
            const r = await basketFetch('/api/basket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: a, ...b }) });
            result = await r.json();
            if (!r.ok)
                throw Error(result.error || 'Unable to save.');
            await refresh();
        }
        if (message)
            setToast(message);
        return result;
    }
    catch (e: any) {
        setToast(e.message);
        setSync(demo ? 'Demo household' : 'Check connection');
        throw e;
    }
    finally {
        pending.current = false;
        setBusy(false);
    } };
    const act = async (a: string, b: any = {}, m = '') => { try {
        return await mutate(a, b, m);
    }
    catch {
        return null;
    } };
    const close = () => setModal('');
    const signedIn = () => { loader.current?.cancel(); demoRef.current = false; setDemo(false); setNeedsAuth(false); setShowAccount(false); setData(null); setLoading(true); setModal(''); refresh(true); };
    const exploreDemo = () => { loader.current?.cancel(); demoRef.current = true; setDemo(true); setData(demoData()); setNeedsAuth(false); setShowAccount(false); setSync('Demo household'); setLoading(false); };
    const legacySignIn = async () => { setIdentityPreference('chatgpt'); demoRef.current = false; setDemo(false); const r = await basketFetch('/api/basket'); if (r.status === 401) {
        window.location.assign(API_ORIGIN + '/signin-with-chatgpt?return_to=%2F');
        return;
    } signedIn(); };
    const signOut = async () => { loader.current?.cancel(); try {
        const { error } = await browserAuth().auth.signOut({ scope: 'local' });
        if (error) {
            setToast('Could not sign out. Please try again.');
            return;
        }
    }
    catch {
        setToast('Could not sign out. Please try again.');
        return;
    } setIdentityPreference('email'); demoRef.current = false; setDemo(false); setData(null); setNeedsAuth(true); setModal(''); setToast(''); setLoading(false); };
    if (showAccount || needsAuth)
        return <AuthScreen success={signedIn} demo={exploreDemo} chatgpt={() => { legacySignIn().catch(() => setError('Sign-in is temporarily unavailable.')); }} back={data && !needsAuth ? () => setShowAccount(false) : undefined}/>;
    if (loading || !data)
        return <div className="loading"><ShoppingBasket size={44}/><h1>{tr("basket")}<span>{tr(".")}</span></h1>{loading ? <><LoaderCircle size={20} className="spin"/><p>{tr("Getting your household ready\u2026")}</p></> : <><p>{tr(error)}</p><button className="primary" onClick={() => { setLoading(true); refresh(true); }}>{tr("Try again")}</button>{PAGES_BUILD && <button className="secondary" onClick={() => setNeedsAuth(true)}>{tr("Sign in")}</button>}<button className="text-link" onClick={exploreDemo}>{tr("Explore the demo")}</button></>}</div>;
    const sharing = householdSharing(data);
    const list = data.lists.find(l => l.id === listId), items = data.items.filter(i => i.listId === listId), scan = () => { setScanFile(undefined); setModal('scan'); };
    const nav = <>{TABS.map(t => <button key={t.id} className={view === t.id ? 'active' : ''} onClick={() => setView(t.id)}><t.icon size={21} strokeWidth={1.6}/><span className="desktop-label">{tr(t.label)}</span><span className="mobile-label">{tr(t.short)}</span>{t.id === 'lists' && <small>{data.lists.length}</small>}</button>)}</>;
    return <div className="app"><aside className="sidebar"><a className="brand" href={appPath()}><span><ShoppingBasket size={26}/></span>{tr("basket")}<b>{tr(".")}</b></a><p className="brand-caption">{tr("A LITTLE MORE TOGETHER")}</p><nav>{nav}</nav><div className="sidebar-bottom"><div className="side-note"><Sprout size={23}/><h3>{tr("Little shops.")}<br />{tr("Bigger picture.")}</h3><p>{tr("Save your receipts.")}<br />{tr("Get to know your spending.")}</p><button onClick={() => setView('spending')}>{tr("Take a look ")}<ArrowUpRight size={16}/></button></div><button className="home-link" onClick={() => setModal('home')}><span><House size={20}/></span><div><b>{data.household.name}</b><small>{data.members.length}{tr(" members")}</small></div><Settings2 size={17}/></button><button className="text-link help-button" onClick={() => setModal('help')}>{tr("A little help ")}<ArrowUpRight size={14}/></button></div></aside><div className="workspace"><header className="topbar"><span className="breadcrumb"><House size={15}/>{data.household.name}<ChevronRight size={12}/><b>{TABS.find(t => t.id === view)?.label}</b></span><span className="mobile-brand"><ShoppingBasket size={23}/>{tr("basket")}<b>{tr(".")}</b></span><div className="top-actions">{sync === 'Check connection' && <span className="connection-warning" role="status">{tr("Connection interrupted")}</span>}<button className="secondary invite-button" onClick={() => setModal('home')}><Users size={17}/>{tr("Invite partner")}</button><button onClick={() => setModal('home')} aria-label={tr("Profile and household settings")}><Avatar name={data.user.name}/></button></div></header>{demo && <div className="demo-banner"><span><b>{tr("DEMO")}</b>{tr("A sample household to look around. Real shopping starts fresh.")}</span><button onClick={() => setShowAccount(true)}>{tr("Open my household ")}<ArrowRight size={14}/></button></div>}<main>
    <div className="household-context"><button type="button" onClick={() => setModal('home')} aria-label={phrase("Active household: {0}. {1}. Manage household", data.household.name, sharing.label)}><Users size={16}/><span><b>{data.household.name}</b><small>{tr(sharing.label)}</small></span><ChevronRight size={14}/></button></div>
    {view === 'lists' && <><div className="list-controls"><div className="list-tabs">{data.lists.map(l => <button key={l.id} onClick={() => setListId(l.id)} className={l.id === listId ? 'selected' : ''}><ShoppingBasket size={15}/>{l.name}<small>{data.items.filter(i => i.listId === l.id && !i.checked).length}</small></button>)}</div><button className="secondary new-list-button" onClick={() => setModal('new-list')}><Plus size={16}/>{sharing.shared ? tr("Shared list") : tr("New list")}</button></div><div className="shopping-layout"><section><div className="section-heading"><div><h2>{list?.name}</h2><p>{items.filter(i => !i.checked).length}{tr(" to buy ")}<span>{tr("\u00B7")}</span> {items.filter(i => i.checked).length}{tr(" in your basket")}</p></div><div className="list-actions"><button className="icon-button" onClick={() => setModal('list-options')} aria-label={tr("List options")}><MoreHorizontal size={22}/></button></div></div><ShoppingList data={data} listId={listId} items={items} busy={busy} act={act} edit={setEditing} photograph={file => { setScanFile(file); setModal('scan'); }} scan={scan}/></section><aside className="shopping-aside"><div className="receipt-promo"><div><span className="outline-icon"><ReceiptText size={24}/></span><small>{tr("THE BIGGER PICTURE")}</small></div><h3>{tr("Your receipt has")}<br />{tr("a good memory.")}</h3><p>{tr("Turn your shop into product prices and a clearer view of what you spend.")}</p><button onClick={scan}>{tr("Scan your receipt ")}<ArrowRight size={17}/></button><small className="promo-footer"><ShieldCheck size={13}/>{tr("Review it. Save it. Remember it.")}</small></div><div className="latest"><div className="aside-heading"><h3>{tr("Latest shop")}</h3><button onClick={() => setView('receipts')} aria-label={tr("All receipts")}><ArrowUpRight size={17}/></button></div>{data.receipts.length ? <button className="latest-card" onClick={() => setReceipt(data.receipts[0])}><span className="store-icon"><ShoppingBasket size={22}/></span><span><b>{data.receipts[0].store}</b><small>{data.receipts[0].date}{tr(" \u00B7 ")}{data.lines.filter(l => l.receiptId === data.receipts[0].id).length}{tr(" items")}</small></span><strong>{money(data.receipts[0].totalCents, data.receipts[0].currency)}</strong></button> : <p>{tr("Your first receipt will appear here.")}</p>}</div><div className="aside-tip"><span>{tr("\u2733")}</span><div><b>{tr("A list that keeps up.")}</b><p>{tr("Your household shares the same lists, product prices and receipts.")}</p><button className="text-link" onClick={() => setModal('home')}>{tr("Shop together ")}<ArrowRight size={14}/></button></div></div></aside></div></>}
    {view === 'receipts' && <ReceiptsView data={data} scan={scan} detail={setReceipt}/>}{view === 'prices' && <PricesView data={data} scan={scan} detail={setProduct}/>}{view === 'spending' && <SpendingView data={data} scan={scan} busy={busy} act={act}/>}
    <footer><span>{tr("Made for the everyday.")}</span><span>{tr("Lists together. A little less guesswork. ")}<ShoppingBasket size={13}/></span></footer></main></div><nav className="mobile-nav">{nav}</nav>{toast && <div className="toast" role="status"><CheckCircle2 size={17}/>{tr(toast)}<button onClick={() => setToast('')} aria-label={tr("Dismiss notification")}><X size={15}/></button></div>}
    {modal === 'new-list' && <NameDialog title={tr("Create a household list")} subtitle={phrase("Shared with everyone in \u201C{0}\u201D.", data.household.name)} note={tr("Everyone who joins this household can see and edit this list.")} submitLabel={tr("Create shared list")} busy={busy} close={close} save={async (name) => { const r = await act('addList', { name }); if (r) {
        setListId(r.id);
        close();
    } }}/>}
    {modal === 'list-options' && list && <NameDialog title={tr("Make this list yours.")} initial={list.name} busy={busy} close={close} save={async (name) => { if (await act('renameList', { id: list.id, name }, 'List renamed'))
        close(); }} remove={data.lists.length > 1 ? async () => { if (await act('deleteList', { id: list.id }, 'List deleted'))
        close(); } : undefined}/>}
    {editing && <ItemEditor item={editing} preferences={data.iconPreferences} busy={busy} close={() => setEditing(null)} save={async (b) => { if (await act('updateItem', b, 'Item updated'))
        setEditing(null); }} remove={async () => { if (await act('deleteItem', { id: editing.id }, 'Item removed'))
        setEditing(null); }}/>}
    {modal === 'home' && <Household data={data} demo={demo} busy={busy} close={close} mutate={mutate} say={setToast} account={() => { close(); setShowAccount(true); }} signOut={signOut}/>}
    {modal === 'scan' && <ReceiptScanner data={data} demo={demo} initialFile={scanFile} initialListId={view === 'lists' ? listId : undefined} close={close} save={async (draft) => { let imageKey; if (draft.image && !demo) {
        const r = await basketFetch('/api/receipt-image', { method: 'POST', headers: { 'Content-Type': draft.image.type }, body: draft.image });
        const b: any = await r.json();
        if (!r.ok)
            throw Error(b.error || 'Photo could not be saved.');
        imageKey = b.key;
    } const saved=await mutate('saveReceipt', { draft: { ...draft, image: undefined, preview: undefined, imageKey } }, demo ? 'Sample receipt saved' : 'Receipt saved. Your price book is updated.');if(saved.duplicate)setToast(getLanguage()==='de'?'Dieser Bon ist bereits gespeichert. Keine zusätzlichen Preise angelegt.':'This receipt is already saved. No additional prices were added.'); close(); setView('receipts'); }}/>}
    {receipt && <ReceiptDetail data={data} r={receipt} close={() => setReceipt(null)} remove={async () => { if (await act('deleteReceipt', { id: receipt.id }, 'Receipt deleted'))
        setReceipt(null); }}/>}
    {product && <ProductDetail data={data} p={product} close={() => setProduct(null)} add={async () => { if (await act('addItem', { id: newId(), listId, name: product.name, quantity: product.packSize || '1', category: product.category }, phrase('Added to {0}',list?.name)))
        setProduct(null); }}/>}
    {modal === 'help' && <Modal title={tr("A little help.")} close={close}><div className="help-content"><h3>{tr("Make a list. Share the load.")}</h3><p>{tr("Add items in German or English and tap a tile when it\u2019s in your basket. Household changes refresh every 3 seconds while the app is open.")}</p><h3>{tr("Scan, check, remember.")}</h3><p>{tr("Photograph a flat, well-lit receipt. Review the product names, quantities, pack sizes, tax and total. Confirmed abbreviations are remembered for that store. Discounts should be reflected in line totals; add fees as separate items.")}</p><h3>{tr("Your prices, from your receipts.")}</h3><p>{tr("Prices are historical, not live supermarket prices. Keep brands and pack sizes consistent for fair comparisons. Different currencies remain separate.")}</p><h3>{tr("Keep it one tap away.")}</h3><p>{tr("On iPhone: Safari \u2192 Share \u2192 Add to Home Screen. An internet connection is needed to save and sync.")}</p></div></Modal>}
    </div>;
}
function ShoppingList({ data, listId, items, busy, act, edit, photograph, scan }: {
    data: BasketData;
    listId: string;
    items: Item[];
    busy: boolean;
    act: (a: string, b?: any, m?: string) => Promise<any>;
    edit: (i: Item) => void;
    photograph: (file: File) => void;
    scan: () => void;
}) {
    const [name, setName] = useState(''), [qty, setQty] = useState('1'), [filter, setFilter] = useState('All items');
    const input = useRef<HTMLInputElement>(null);
    const [groceryRegion, setGroceryRegion] = useGroceryRegion();
    const ordered = sortShoppingItems(items, data.iconPreferences);
    const active = ordered.filter(i => !i.checked), bought = ordered.filter(i => i.checked);
    useEffect(() => setFilter('All items'), [listId]);
    const add = async (value = name) => { value = value.trim(); if (!value || busy)
        return; const existing = items.find(i => normalize(i.name) === normalize(value)); let r; if (existing) {
        if (!existing.checked) {
            input.current?.setCustomValidity('Already on your list.');
            input.current?.reportValidity();
            return;
        }
        r = await act('updateItem', { id: existing.id, checked: false, quantity: qty });
    }
    else
        r = await act('addItem', { id: newId(), listId, name: value, quantity: qty || '1', category: shoppingCategory(value, data.iconPreferences, inferCategory(value)) }, 'Added to your list'); if (r) {
        setName('');
        setQty('1');
        input.current?.focus();
    } };
    const tile = (i: Item) => { const matches=history(data.lines.filter(l=>productNameKey(l.productName)===productNameKey(i.name))), price=matches[0]; const best=price?cheapest(comparableLines(matches,price)):undefined; return <div key={i.id} className={'tile with-regional-prices ' + (i.checked ? 'bought ' : '') + foodGroupClass(i.name, data.iconPreferences, i.category)}><button className="tile-hit" aria-label={phrase(i.checked?'Uncheck {0}':'Check off {0}',i.name)} aria-pressed={!!i.checked} disabled={busy} onClick={() => act('updateItem', { id: i.id, checked: !i.checked })}><Food name={i.name} preferences={data.iconPreferences} category={i.category}/><b>{i.name}</b><small>{i.quantity}{!price && <span>{getLanguage()==='de'?' · Noch keine Preisdaten':' · No price data yet'}</span>}{price && <span>{tr(" \u00B7 ")}{priceText(price)} · {[price.packSize,price.brand,price.variant,price.quality].filter(Boolean).join(' · ')} · {price.store} · {price.date}{best && <span>{getLanguage()==='de'?' · Bisher günstigster: ':' · Historical lowest: '}{best.store} · {best.date}</span>}</span>}</small></button>{!i.checked && <RegionalPricesForItem name={i.name} region={groceryRegion}/>}<button type="button" className="tile-remove" disabled={busy} aria-label={phrase("Remove item {0}", i.name)} title={phrase("Remove item {0}", i.name)} onClick={() => act('deleteItem', { id: i.id }, 'Item removed')}><X size={15}/></button><button className="tile-edit" onClick={() => edit(i)} aria-label={phrase("Edit {0}", i.name)}><MoreHorizontal size={17}/></button></div>; };
    return <><form className="add-item" onSubmit={e => { e.preventDefault(); add(); }}><Plus size={20}/><input ref={input} value={name} required maxLength={100} onChange={e => { e.target.setCustomValidity(''); setName(e.target.value); }} placeholder={tr("Add something to your list\u2026")} aria-label={tr("Item name")} list="item-suggestions" autoComplete="off"/><input className="qty" value={qty} onChange={e => setQty(e.target.value)} maxLength={40} aria-label={tr("Item quantity")}/><button className="primary" disabled={busy || !name.trim()}><Plus size={16}/>{tr("Add")}</button></form><datalist id="item-suggestions">{[...new Set([...data.products.map(p => p.name), ...(getLanguage()==='de'?['Milch','Eier','Bananen','Brot','Kaffee','Zitronen','Äpfel','Reis','Nudeln','Hähnchenbrust','Spülmittel']:['Milk','Eggs','Bananas','Bread','Coffee','Lemons','Apples','Rice','Pasta','Chicken breast','Dish soap'])])].map(n => <option key={n}>{n}</option>)}</datalist><RegionalPricesSettings region={groceryRegion} update={setGroceryRegion}/><HalifaxListComparison region={groceryRegion} items={active}/><div className="quick-add"><span>{tr("Quick add")}</span>{(getLanguage()==='de'?['Milch','Eier','Bananen','Brot']:['Milk','Eggs','Bananas','Bread']).filter(n => !active.some(i => normalize(i.name) === normalize(n))).slice(0, 3).map(n => <button key={n} disabled={busy} onClick={() => add(n)}><Plus size={11}/>{n}</button>)}</div><div className="category-tabs">{['All items', ...SHOPPING_GROUPS.filter(c => active.some(i => shoppingGroup(i.name, data.iconPreferences, i.category) === c))].map(c => <button key={c} className={filter === c ? 'active' : ''} onClick={() => setFilter(c)}>{tr(c)}{c === 'All items' && <small>{active.length}</small>}</button>)}</div>{active.length ? <div className="tile-grid">{active.filter(i => filter === 'All items' || shoppingGroup(i.name, data.iconPreferences, i.category) === filter).map(tile)}<button className="add-tile" onClick={() => input.current?.focus()}><span><Plus size={23}/></span>{tr("Add an item")}</button></div> : <Empty title={bought.length ? tr("Everything\u2019s in the basket.") : tr("A fresh list. A good start.")}>{tr("Add an item above, or tap a quick suggestion.")}</Empty>}{!!bought.length && <section className="bought-section"><div className="bought-heading"><h3><CheckCheck size={18}/>{tr("In your basket ")}<small>{bought.length}</small></h3><button disabled={busy} onClick={() => act('clearChecked', { listId }, 'Basket cleared')}>{tr("Clear bought")}</button></div><div className="tile-grid">{bought.map(tile)}</div></section>}<div className="list-receipt"><label className={'primary receipt-camera ' + (busy ? 'disabled' : '')}><Camera size={20}/>{tr("Take receipt photo")}<input type="file" accept="image/*" capture="environment" disabled={busy} aria-label={tr("Take receipt photo")} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file)
        photograph(file); }}/></label><p>{tr("Snap your receipt. Review the items and prices, then save.")}</p><button type="button" className="text-link" disabled={busy} onClick={scan}>{tr("Upload or enter a receipt")}</button></div><p className="list-note"><CheckCircle2 size={13}/>{tr("Tap an item when it\u2019s in your basket.")}<span>{tr("Prices from saved receipts.")}</span></p></>;
}
function Intro({ eyebrow, title, children, action }: {
    eyebrow: string;
    title: string;
    children: React.ReactNode;
    action?: React.ReactNode;
}) { return <section className="intro standard"><div><p className="eyebrow">{tr(eyebrow)}</p><h1>{title}<span>{tr(".")}</span></h1><p>{children}</p></div>{action}</section>; }
function ReceiptsView({ data, scan, detail }: {
    data: BasketData;
    scan: () => void;
    detail: (r: Receipt) => void;
}) { const [q, setQ] = useState(''); const rows = data.receipts.filter(r => (r.store + ' ' + r.date).toLowerCase().includes(q.toLowerCase())); return <><Intro eyebrow={tr("EVERY SHOP TELLS A STORY")} title={tr("Receipts, remembered")} action={<button className="primary" onClick={scan}><ScanLine size={18}/>{tr("Scan a receipt")}</button>}>{tr("Your everyday shops, all in one place.")}</Intro><div className="soft-banner"><ReceiptText size={30}/><div><h3>{tr("A photo now. Less guesswork later.")}</h3><p>{tr("Scan, review and save. Basket remembers your product names and prices.")}</p></div><ArrowRight size={22}/></div><div className="section-heading"><div><h2>{tr("Receipt archive ")}<em>{data.receipts.length}</em></h2><p>{tr("Confirmed receipts make up your spending.")}</p></div><div className="search-field"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={tr("Search store or date")} aria-label={tr("Search receipts")}/></div></div>{rows.length ? <div className="receipt-grid">{rows.map(r => <button className="receipt-card" key={r.id} onClick={() => detail(r)}><div className="card-top"><span className="store-icon"><ShoppingBasket size={23}/></span><ArrowUpRight size={19}/></div><small>{new Date(r.date + 'T12:00:00').toLocaleDateString(locale(), { dateStyle: 'medium' })}</small><h3>{r.store}</h3><strong>{money(r.totalCents, r.currency)} <small>{r.currency}</small></strong><div className="card-bottom"><span>{data.lines.filter(l => l.receiptId === r.id).length}{tr(" items")}</span><span><Check size={12}/>{tr("Confirmed")}</span></div></button>)}</div> : <Empty title={q ? tr("No matching receipts.") : tr("Your first shop belongs here.")} action={<button className="primary" onClick={scan}><Camera size={17}/>{tr("Add a receipt")}</button>}>{q ? tr("Try another store or date.") : tr("Save a receipt to start remembering product prices and household spending.")}</Empty>}</>; }
function PricesView({ data, scan, detail }: {
    data: BasketData;
    scan: () => void;
    detail: (p: Product) => void;
}) { const [q, setQ] = useState(''), [category, setCategory] = useState('All categories'); const products = data.products.filter(p => history(data.lines).some(l => l.productId === p.id) && normalize(p.name + ' ' + p.packSize).includes(normalize(q)) && (category === 'All categories' || p.category === category)); return <><Intro eyebrow={tr("A LITTLE KNOWLEDGE IN YOUR BASKET")} title={tr("Know what you paid")} action={<button className="secondary" onClick={scan}><Plus size={17}/>{tr("Add a receipt")}</button>}>{tr("Product prices, learned from your actual shops.")}</Intro><div className="notice"><ShieldCheck size={18}/><p>{tr("These are your recorded prices, with the store and date. Match the product, brand and pack size for a fair comparison.")}</p></div><div className="price-controls"><div className="search-field"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={tr("Find a product\u2026")} aria-label={tr("Search products")}/></div><select value={category} onChange={e => setCategory(e.target.value)} aria-label={tr("Product category")}><option>{tr("All categories")}</option>{CATEGORIES.map(c => <option key={c} value={c}>{tr(c)}</option>)}</select><span>{products.length}{tr(" products")}</span></div>{products.length ? <div className="price-table"><div className="price-head"><span>{tr("PRODUCT")}</span><span>{tr("LAST PAID")}</span><span>{tr("STORE & DATE")}</span><span /></div>{products.map(p => { const last = history(data.lines.filter(l => l.productId === p.id))[0]!; return <button className="price-row" key={p.id} onClick={() => detail(p)}><span className="product-cell"><span className={'product-art ' + foodGroupClass(p.name, data.iconPreferences, p.category)}><Food name={p.name} size={39} preferences={data.iconPreferences} category={p.category}/></span><span><b>{p.name}</b><small>{p.packSize || tr("Pack size not specified")}{tr(" \u00B7 ")}{p.category}</small></span></span><span><b>{priceText(last)}</b><small>{[p.brand,p.variant,p.quality].filter(Boolean).join(' · ')}</small></span><span className="store-cell"><b>{last.store}</b><small>{last.date}</small></span><ChevronRight size={17}/></button>; })}</div> : <Empty title={tr("Your own little price book.")} action={<button className="primary" onClick={scan}><ScanLine size={17}/>{tr("Scan a receipt")}</button>}>{tr("Save a receipt to start remembering prices. No barcode scanning needed.")}</Empty>}</>; }
const COLORS = ['#577f5f', '#b8c695', '#dda777', '#8db3aa', '#c18f80', '#d9c78d', '#8da1a5', '#a8a48e', '#c1c6b4'];
function SpendingView({ data, scan, busy, act }: {
    data: BasketData;
    scan: () => void;
    busy: boolean;
    act: (a: string, b?: any, m?: string) => Promise<any>;
}) { const months = monthOptions(data); const [month, setMonth] = useState(localDate().slice(0, 7)), [currency, setCurrency] = useState('CAD'); const receipts = data.receipts.filter(r => r.date.startsWith(month) && r.currency === currency), ids = new Set(receipts.map(r => r.id)), lines = data.lines.filter(l => ids.has(l.receiptId)), total = receipts.reduce((s, r) => s + r.totalCents, 0), tax = receipts.reduce((s, r) => s + r.taxCents, 0); const cats = CATEGORIES.map((name, i) => ({ name, value: lines.filter(l => l.category === name).reduce((s, l) => s + l.amountCents, 0), color: COLORS[i] })).filter(c => c.value > 0).sort((a, b) => b.value - a.value), catTotal = cats.reduce((s, c) => s + c.value, 0); let angle = 0; const gradient = cats.map(c => { const start = angle; angle += c.value / (catTotal || 1) * 100; return `${c.color} ${start}% ${angle}%`; }).join(','); const stores = [...new Set(receipts.map(r => r.store))].map(name => ({ name, value: receipts.filter(r => r.store === name).reduce((s, r) => s + r.totalCents, 0), count: receipts.filter(r => r.store === name).length })).sort((a, b) => b.value - a.value); return <><Intro eyebrow={tr("SMALL SHOPS. A CLEARER PICTURE.")} title={tr("Where it all goes")} action={<div className="period"><select value={month} onChange={e => setMonth(e.target.value)} aria-label={tr("Spending month")}>{months.map(m => <option key={m} value={m}>{new Date(m + '-15').toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</option>)}</select><select value={currency} onChange={e => setCurrency(e.target.value)} aria-label={tr("Spending currency")}>{['CAD', 'USD', 'EUR', 'GBP'].map(c => <option key={c} value={c}>{tr(c)}</option>)}</select></div>}>{tr("A simple view of your household spending.")}</Intro><BudgetPanel data={data} month={month} currency={currency} busy={busy} act={act}/><div className="stats"><div className="stat featured"><span>{tr("TOTAL SPENT ")}<ShoppingBasket size={19}/></span><strong>{money(total, currency)}</strong><small>{tr("From confirmed receipts this month")}</small></div><div className="stat"><span>{tr("SHOPPING TRIPS ")}<ReceiptText size={19}/></span><strong>{String(receipts.length).padStart(2, '0')}</strong><small>{tr("Across ")}{stores.length}{tr(" stores")}</small></div><div className="stat"><span>{tr("AVERAGE SHOP ")}<ChartNoAxesCombined size={19}/></span><strong>{money(receipts.length ? Math.round(total / receipts.length) : 0, currency)}</strong><small>{tr("Including recorded tax and fees")}</small></div></div>{receipts.length ? <div className="spending-layout"><section className="chart-card"><h2>{tr("By category")}</h2><p>{tr("What went into your basket")}</p><div className="category-chart"><div className="donut" style={{ background: `conic-gradient(${gradient || '#e9eddc 0% 100%'})` }} role="img" aria-label={cats.map(c => c.name + ': ' + money(c.value, currency)).join('; ')}><span><small>{tr("ITEMS TOTAL")}</small><strong>{money(catTotal, currency)}</strong></span></div><div className="legend">{cats.map(c => <div key={c.name}><i style={{ background: c.color }}/><span>{tr(c.name)}</span><b>{money(c.value, currency)}</b></div>)}</div></div><p className="chart-note">{tr("Tax is separate: ")}{money(tax, currency)}{tr(". Amounts reflect reviewed line totals.")}</p></section><section className="chart-card"><h2>{tr("By store")}</h2><p>{tr("Your places to shop")}</p>{stores.map((s, i) => <div className="store-bar" key={s.name}><div><b>{s.name}</b><strong>{money(s.value, currency)}</strong></div><span><i style={{ width: `${s.value / (stores[0]?.value || 1) * 100}%`, background: COLORS[i % COLORS.length] }}/></span><small>{s.count} {s.count === 1 ? tr("trip") : tr("trips")}</small></div>)}</section></div> : <Empty title={tr("The bigger picture starts with one shop.")} action={<button className="primary" onClick={scan}><ScanLine size={17}/>{tr("Add a receipt")}</button>}>{tr("Save a receipt in this month and currency to see where your money goes.")}</Empty>}<p className="spending-note"><ShieldCheck size={16}/>{tr("Based on saved receipts. Different currencies are never added together.")}</p></>; }
function NameDialog({ title, subtitle, note, submitLabel, initial = '', busy, close, save, remove }: {
    title: string;
    subtitle?: string;
    note?: string;
    submitLabel?: string;
    initial?: string;
    busy: boolean;
    close: () => void;
    save: (n: string) => void;
    remove?: () => void;
}) { const [name, setName] = useState(initial), [confirm, setConfirm] = useState(false); return <Modal title={title} subtitle={tr(subtitle)} close={close}><form className="dialog-form" onSubmit={e => { e.preventDefault(); save(name.trim()); }}><label>{tr("List name")}<input value={name} onChange={e => setName(e.target.value)} maxLength={60} required placeholder={tr("e.g. Weekend dinner")}/></label>{note && <p className="hint shared-list-note"><Users size={15}/>{tr(note)}</p>}<div className="modal-actions">{remove ? <button type="button" className="danger" disabled={busy} onClick={() => confirm ? remove() : setConfirm(true)}><Trash2 size={15}/>{confirm ? tr("Yes, delete list") : tr("Delete list")}</button> : <button type="button" className="secondary" onClick={close}>{tr("Cancel")}</button>}<button className="primary" disabled={busy || !name.trim()}>{initial ? tr("Save changes") : submitLabel || tr("Create list")}</button></div>{confirm && <p className="hint">{tr("This removes the list and its items for everyone.")}</p>}</form></Modal>; }
function ItemEditor({ item, preferences = [], busy, close, save, remove }: {
    item: Item;
    preferences?: import('../lib/food-icons').IconPreference[];
    busy: boolean;
    close: () => void;
    save: (b: any) => void;
    remove: () => void;
}) { const [name, setName] = useState(item.name), [qty, setQty] = useState(item.quantity), [category, setCategory] = useState(item.category), [icon, setIcon] = useState<FoodIconKey | 'auto'>(() => preferences.find(p => p.name === normalize(item.name))?.icon || 'auto'), [iconChanged, setIconChanged] = useState(false); const automatic = foodIcon(name, [], category); const previewIcon = iconChanged ? (icon === 'auto' ? automatic : icon) : foodIcon(name, preferences, category); return <Modal title={tr("A little more detail.")} close={close}><div className={'edit-art ' + foodGroupClass(name, preferences, category)}><Food name={name} size={75} icon={previewIcon}/></div><form className="dialog-form" onSubmit={e => { e.preventDefault(); save({ id: item.id, name: name.trim(), quantity: qty.trim(), category, ...(iconChanged ? { icon } : {}) }); }}><label>{tr("Item name")}<input value={name} required maxLength={100} onChange={e => setName(e.target.value)}/></label><div className="form-two"><label>{tr("Quantity or note")}<input value={qty} required maxLength={40} onChange={e => setQty(e.target.value)}/></label><label>{tr("Category")}<select value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{tr(c)}</option>)}</select></label></div><label>{tr("Item icon")}<select value={iconChanged ? icon : (preferences.find(p => p.name === normalize(name))?.icon || 'auto')} disabled={busy} onChange={e => { setIcon(e.target.value as FoodIconKey | 'auto'); setIconChanged(true); }}><option value="auto">{tr("Automatic \u00B7 ")}{tr(iconLabel(automatic))}</option>{FOOD_ICONS.map(([key, label]) => <option key={key} value={key}>{tr(label)}</option>)}</select></label><p className="hint">{tr("Choose an icon to remember it for this item name across your household\u2019s lists and price book. Choose Automatic to reset it.")}</p><p className="hint">{tr("Added by ")}{item.addedBy}</p><div className="modal-actions"><button type="button" className="danger" disabled={busy} onClick={remove}><Trash2 size={15}/>{tr("Remove item")}</button><button className="primary" disabled={busy}>{tr("Save changes")}</button></div></form></Modal>; }
function Household({ data, demo, busy, close, mutate, say, account, signOut }: {
    data: BasketData;
    demo: boolean;
    busy: boolean;
    close: () => void;
    mutate: (a: string, b?: any, m?: string) => Promise<any>;
    say: (s: string) => void;
    account: () => void;
    signOut: () => void;
}) { const [name, setName] = useState(data.household.name), [code, setCode] = useState(''), [join, setJoin] = useState(''), [error, setError] = useState(''); return <Modal title={tr("Your household")} subtitle={tr("Lists, receipts and budgets are shared within the active household.")} close={close}><div className="active-household"><House size={20}/><div><small>{tr("Active household")}</small><h3>{data.household.name}</h3><p>{tr(householdSharing(data).label)}</p></div></div>{data.homes.length > 1 && !demo && <label className="home-switch">{tr("Switch household")}<select value={data.household.id} disabled={busy} onChange={async (e) => { try {
    await mutate('switchHome', { id: e.target.value }, 'Household switched');
    close();
}
catch (error: any) {
    setError(error.message);
} }}>{data.homes.map(h => <option key={h.id} value={h.id}>{h.name}{h.id === data.household.id ? tr(" \u00B7 Active") : ''}</option>)}</select></label>}<h3 className="members-heading">{tr("Household members \u00B7 ")}{data.members.length}</h3><div className="members">{data.members.map((m, i) => <div key={m.userId}><Avatar name={m.displayName} alt={!!(i % 2)}/><span><b>{m.displayName}</b><small>{m.userId === data.household.ownerId ? tr("Household owner") : tr("Household member")}</small></span>{m.userId === data.user.id && <em>{tr("YOU")}</em>}</div>)}</div><form className="dialog-form" onSubmit={async (e) => { e.preventDefault(); try {
    await mutate('renameHome', { name }, 'Household renamed');
}
catch { } }}><label>{tr("Household name")}<div className="input-button"><input value={name} required maxLength={60} onChange={e => setName(e.target.value)}/><button className="secondary" disabled={busy || name === data.household.name}>{tr("Save")}</button></div></label></form><hr />{demo ? <div className="help-content"><h3>{tr("Make room for your real household.")}</h3><p>{tr("Sign in to save your own lists and receipts. This demo uses sample data and changes are temporary.")}</p><button className="primary" onClick={account}>{tr("Open my household ")}<ArrowRight size={16}/></button></div> : <><h3>{tr("Invite your partner")}</h3><p className="hint">{tr("Your partner signs in with their own account, then joins with this code. Invitations expire in 7 days. Only members of your household can see its shopping data.")}</p>{data.household.ownerId !== data.user.id && <p className="hint">{tr("You are a member of this household. You can create and edit its shared lists. Only the owner can invite more people.")}</p>}{data.household.ownerId === data.user.id && <button className="primary" disabled={busy} onClick={async () => { try {
    const r = await mutate('invite');
    setCode(r.code);
}
catch (e: any) {
    setError(e.message);
} }}><Link2 size={16}/>{code ? tr("Create new invitation") : tr("Create invitation")}</button>}{code && <div className="invite-code"><code>{code}</code><button className="secondary" onClick={async () => { try {
    await navigator.clipboard.writeText(code);
    say('Invitation copied');
}
catch {
    say('Select and copy the invitation code.');
} }}><Copy size={15}/>{tr("Copy")}</button></div>}<details className="join"><summary>{tr("Have an invitation?")}</summary><form className="dialog-form" onSubmit={async (e) => { e.preventDefault(); try {
    await mutate('join', { code: join }, 'You joined the household');
    close();
}
catch (e: any) {
    setError(e.message);
} }}><label>{tr("Invitation code")}<input value={join} onChange={e => setJoin(e.target.value)} maxLength={64} required/></label><p className="hint">{tr("Your previous household is kept. Switch back here at any time.")}</p><button className="secondary" disabled={busy}>{tr("Join household ")}<ArrowRight size={15}/></button></form></details>{error && <p className="form-error">{tr(error)}</p>}</>}<LanguageSettings/><TextSizeSettings />{!demo && <div className="account-settings"><h3>{tr("Your account")}</h3><p>{data.user.email || data.user.name}</p><small>{data.user.provider === 'email' ? tr("Email confirmed \u00B7 E-mail sign-in") : tr("Previous ChatGPT sign-in")}</small>{data.user.provider === 'chatgpt' ? <button className="secondary" onClick={account}>{tr("Use email and password ")}<ArrowRight size={15}/></button> : <button className="secondary" disabled={busy} onClick={signOut}>{tr("Sign out of Basket")}</button>}{data.canImportChatGPT && <div className="import-account"><p>{tr("Already started shopping with your previous ChatGPT sign-in? Connect those households, lists, receipts and budgets to this account.")}</p><button className="text-link" disabled={busy} onClick={async () => { try {
    await mutate('importChatGPT', {}, 'Previous shopping data connected');
    close();
}
catch (e: any) {
    setError(e.message);
} }}>{tr("Connect my previous shopping data ")}<ArrowRight size={15}/></button></div>}</div>}<p className="install-note"><House size={16}/>{tr("iPhone: Safari \u2192 Share \u2192 Add to Home Screen.")}</p></Modal>; }
function ReceiptDetail({ data, r, close, remove }: {
    data: BasketData;
    r: Receipt;
    close: () => void;
    remove: () => void;
}) { const lines = data.lines.filter(l => l.receiptId === r.id), [confirm, setConfirm] = useState(false); const exportItems = () => { const rows = [['Store', 'Date', 'Currency', 'Product', 'Pack size', 'Quantity', 'Line total'], ...lines.map(l => [r.store, r.date, r.currency, l.productName, l.packSize, l.quantity, (l.amountCents / 100).toFixed(2)])]; const csv = rows.map(row => row.map(c => { let s = String(c); if (/^[=+\-@\t\r]/.test(s))
    s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; }).join(',')).join('\r\n'); const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'basket-receipt-' + r.date + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }; return <Modal title={r.store} subtitle={phrase("{0} \u00B7 Added by {1}", r.date, r.createdBy)} close={close}>{r.shopping && <div className="receipt-shopping"><h3>{tr("Your purchases")}</h3>{r.shopping.listName && <><p>{tr("Compared with ")}{r.shopping.listName}</p><b>{tr("Additional purchases")}</b><p>{r.shopping.extraItems.length ? r.shopping.extraItems.join(', ') : tr("No additional items marked.")}</p></>}<b>{tr("First recorded purchases")}</b><p>{r.shopping.firstPurchases.length ? r.shopping.firstPurchases.join(', ') : tr("All products have appeared on earlier saved receipts.")}</p></div>}<div className="receipt-lines">{lines.map(l => <div key={l.id}><span><b>{l.productName}</b><small>{l.quantity}{tr(" \u00D7 ")}{money(Math.round(l.amountCents / l.quantity), r.currency)} {l.packSize ? '· ' + l.packSize : ''}</small><small>{tr("On receipt: ")}{l.label}</small></span><strong>{money(l.amountCents, r.currency)}</strong></div>)}</div><div className="receipt-total"><div><span>{tr("Items")}</span><b>{money(lines.reduce((s, l) => s + l.amountCents, 0), r.currency)}</b></div><div><span>{tr("Tax")}</span><b>{money(r.taxCents, r.currency)}</b></div><div><strong>{tr("Total")}</strong><strong>{money(r.totalCents, r.currency)} <small>{r.currency}</small></strong></div></div>{r.imageKey && <details className="photo"><summary>{tr("View receipt photo")}</summary><ProtectedImage receiptId={r.id} alt={phrase("Original receipt from {0}", r.store)}/></details>}<div className="modal-actions"><button className="danger" onClick={() => confirm ? remove() : setConfirm(true)}><Trash2 size={15}/>{confirm ? tr("Yes, delete receipt") : tr("Delete receipt")}</button><button className="secondary" onClick={exportItems}><Download size={15}/>{tr("Export items")}</button></div>{confirm && <p className="hint">{tr("Removes this receipt and its prices from your household totals.")}</p>}</Modal>; }
function ProductDetail({ data, p, close, add }: {
    data: BasketData;
    p: Product;
    close: () => void;
    add: () => void;
}) { const lines = history(data.lines.filter(l => l.productId === p.id)), [currency, setCurrency] = useState(lines[0]?.currency || 'CAD'); const reference=lines.find(l=>l.currency===currency), prices=reference?comparableLines(data.lines,reference):[], latestByStore=prices.filter((l,i)=>prices.findIndex(x=>normalize(x.store)===normalize(l.store)&&(x.branch||'')===(l.branch||''))===i), best=cheapest(prices), average=weightedAverage(prices); return <Modal title={p.name} subtitle={[p.packSize||tr('Pack size not specified'),p.brand,p.variant,p.quality,p.category].filter(Boolean).join(' · ')} close={close}><div className="section-heading"><h3>{tr('Latest price by store')}</h3><select value={currency} onChange={e=>setCurrency(e.target.value)} aria-label={tr('Price currency')}>{[...new Set(lines.map(l=>l.currency))].map(c=><option key={c}>{c}</option>)}</select></div><p className="hint">{getLanguage()==='de'?'Historische Bonpreise sind keine garantierten aktuellen Ladenpreise. Unbekannte Varianten bleiben getrennt.':'Historical receipt prices are not guaranteed current store prices. Unknown variants remain separate.'}</p>{latestByStore.map(l=><div className="comparison" key={l.id}><span><b>{l.store} {l.branch}</b><small>{l.date} · {l.country||'?'} · {l.packSize}</small></span><strong>{priceText(l)}</strong></div>)}{best&&<p>{getLanguage()==='de'?'Bisher günstigster dokumentierter Preis: ':'Lowest documented historical price: '}{priceText(best)} · {best.store} · {best.date}</p>}{average&&<p>{getLanguage()==='de'?'Mengengewichteter Durchschnitt: ':'Quantity-weighted average: '}{money(average.cents,currency)}/{average.unit}</p>}<details className="join" open><summary>{tr('All ')}{prices.length}{tr(' price records')}</summary>{prices.map(l=><div className="comparison" key={l.id}><span><b>{l.store} {l.branch}</b><small>{l.date} · {l.packSize} · {l.label}</small><small>{l.saleStatus==='reduced'?(getLanguage()==='de'?'Rabatt belegt':'Evidenced reduction'):l.saleStatus==='advertised'?(getLanguage()==='de'?'Als Angebot markiert; Reduktion nicht belegt':'Advertised offer; reduction unproven'):l.saleStatus==='normal'?(getLanguage()==='de'?'Normalpreis belegt':'Evidenced normal price'):(getLanguage()==='de'?'Preisstatus unbekannt':'Price status unknown')}</small>{l.regularCents!==undefined&&<small>{getLanguage()==='de'?'Regulärer Positionspreis: ':'Regular line total: '}{money(l.regularCents,l.currency)}</small>}{l.discountCents!==undefined&&<small>{getLanguage()==='de'?'Positionsrabatt: ':'Line discount: '}{money(l.discountCents,l.currency)}</small>}<small>{getLanguage()==='de'?'Bonreferenz: ':'Receipt reference: '}{l.receiptId}</small></span><strong>{priceText(l)}</strong></div>)}</details><div className="modal-actions"><button className="secondary" onClick={close}>{tr('Close')}</button><button className="primary" onClick={add}><Plus size={16}/>{tr('Add to current list')}</button></div></Modal>; }
function priceText(line:BasketData['lines'][number]){const basis=comparisonBasis(line);return basis?money(basis.cents,line.currency)+'/'+(basis.unit==='recorded unit'?tr('recorded unit'):basis.unit):tr('No price data')}
