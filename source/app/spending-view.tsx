'use client';
import React, { useEffect, useRef, useState } from 'react';
import { ScanLine, ShieldCheck, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, ChevronDown, Search } from 'lucide-react';
import { tr, phrase, locale } from '../lib/i18n';
import { money, normalize, type BasketData, type Receipt } from '../lib/types';
import { isWeighable, convertUnitPrice, type WeightUnit } from '../lib/unit-price';
import { monthOptions } from '../lib/budgets';
import { defaultSpendingMonth, receiptCurrencies, spendingStats, type PeriodKey, type TimeBucket, type WeekdayStat, type KindStat, type StoreStat, type StoreIndex, type PriceComparison, type ProductStat, type PriceChange } from '../lib/spending-stats';
import type { ReceiptKind } from '../lib/types';
import BudgetPanel from './budget-panel';
import { Empty, Intro } from './basket-app';

const PERIODS: { id: PeriodKey; label: string }[] = [{ id: 'month', label: 'Month' }, { id: '3m', label: '3 months' }, { id: '12m', label: '12 months' }, { id: 'all', label: 'All time' }];
const percent = (value: number, digits = 0) => new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: digits, signDisplay: 'exceptZero' }).format(value);
const share = (value: number) => new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 0 }).format(value);
const day = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
const monthName = (m: string, style: 'short' | 'long' = 'long') => new Date(m + '-15T12:00:00').toLocaleDateString(locale(), { month: style, year: style === 'long' ? 'numeric' : '2-digit' });
/** True on phone widths, where the spending cards stack and long lists are cut shorter. */
function useNarrow() {
    const [narrow, setNarrow] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia?.('(max-width: 650px)');
        if (!mq) return;
        const update = () => setNarrow(mq.matches);
        update(); mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);
    return narrow;
}
const unitText = (unit: string) => unit === 'kg' || unit === 'L' ? unit : unit === 'piece' ? tr('piece') : unit;

/** Fixed colour + emoji per category, so meat is always red and fruit/veggies always green. */
const CATEGORY_LOOK: Record<string, [string, string]> = {
    'Fruit': ['#e8833a', '🍎'], 'Veggies': ['#4f9d4a', '🥦'], 'Produce': ['#6aab4f', '🥕'], 'Processed Food': ['#b08a5a', '🥫'],
    'Meat & fish': ['#c8423b', '🥩'], 'Dairy & eggs': ['#6fa8dc', '🧀'], 'Vegetarian/Vegan alternatives': ['#5aa469', '🌱'], 'Bakery': ['#c99a4b', '🥖'], 'Snacks & sweets': ['#d9649a', '🍫'],
    'Pasta, rice & grains': ['#e0b84a', '🍝'], 'Pantry': ['#9c7b55', '🫙'], 'Oils, spices & sauces': ['#c7a227', '🫒'], 'Frozen': ['#5bb3c9', '🧊'],
    'Drinks': ['#3f7fbf', '🥤'], 'Household': ['#8a7cc0', '🧽'], 'Takeout': ['#e06d4f', '🥡'], 'Fuel': ['#5d6b75', '⛽'],
    'Medicine': ['#3fae9c', '💊'], 'Clothing': ['#a0688f', '👕'], 'Other': ['#9aa58f', '🛒'],
};
const FALLBACK_COLORS = ['#285640', '#7d9bb3', '#a98bb5', '#d4c49a', '#6f7f63'];
const catColor = (name: string, i = 0) => CATEGORY_LOOK[name]?.[0] || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
const catIcon = (name: string) => CATEGORY_LOOK[name]?.[1] || '🛒';
const weekdayName = (d: number, style: 'short' | 'long' = 'short') => new Date(Date.UTC(2024, 0, 1 + d)).toLocaleDateString(locale(), { weekday: style, timeZone: 'UTC' });

/** Counts smoothly from the previous value to the new one. */
function useCountUp(target: number, ms = 750) {
    const [value, setValue] = useState(0);
    const from = useRef(0);
    useEffect(() => {
        if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { from.current = target; setValue(target); return; }
        const start = performance.now(), a = from.current; let frame = 0;
        const step = (t: number) => { const k = Math.min(1, (t - start) / ms), x = Math.round(a + (target - a) * (1 - Math.pow(1 - k, 3))); from.current = x; setValue(x); if (k < 1) frame = requestAnimationFrame(step); };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [target, ms]);
    return value;
}
function Count({ value, format }: { value: number; format: (n: number) => string }) { return <>{format(useCountUp(value))}</>; }

const KIND_LOOK: Record<ReceiptKind, [string, string, string]> = { groceries: ['#4f9d4a', '🛒', 'Groceries'], takeout: ['#e06d4f', '🥡', 'Takeout'], fuel: ['#5d6b75', '⛽', 'Fuel'], other: ['#8a7cc0', '🧾', 'Other'] };
type Slice = { key: string; label: string; icon: string; color: string; cents: number; sub: string };

/** Ring + toggle chips + list; switched-off slices drop out of the ring, total and shares. */
function SliceChart({ slices, currency, onOpen }: { slices: Slice[]; currency: string; onOpen?: (key: string) => void }) {
    const [hidden, setHidden] = useState<Set<string>>(new Set());
    const shown = slices.filter(x => !hidden.has(x.key)), total = shown.reduce((n, x) => n + x.cents, 0);
    const r = 52, c = 2 * Math.PI * r;
    let offset = 0;
    const toggle = (key: string) => setHidden(h => { const n = new Set(h); if (n.has(key)) n.delete(key); else n.add(key); return n; });
    return <>
        <div className="donut" role="img" aria-label={shown.map(x => x.label + ' ' + money(x.cents, currency)).join('; ')}>
            <svg viewBox="0 0 140 140"><circle cx="70" cy="70" r={r} className="donut-track"/>
                {shown.map(x => { const len = total ? x.cents / total * c : 0, el = <circle key={x.key} cx="70" cy="70" r={r} stroke={x.color} strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`} strokeDashoffset={-offset}/>; offset += len; return el; })}
            </svg>
            <div className="donut-center"><small>{tr('Total')}</small><b><Count value={total} format={n => money(n, currency)}/></b></div>
        </div>
        <div className="slice-chips" role="group">{slices.map(x => <button type="button" key={x.key} className="slice-chip" aria-pressed={!hidden.has(x.key)} style={{ '--accent': x.color } as React.CSSProperties} onClick={() => toggle(x.key)}>{x.icon} {x.label}</button>)}</div>
        <div className="slice-list">{shown.map(x => { const body = <><span className="slice-dot" style={{ background: x.color }}/><span className="slice-name"><b>{x.label}</b><small>{x.sub}</small></span><span className="slice-amount"><b>{money(x.cents, currency)}</b><small>{share(total ? x.cents / total : 0)}</small></span>{onOpen && <ChevronRight size={16}/>}</>;
            return onOpen ? <button type="button" key={x.key} className="slice-row" onClick={() => onOpen(x.key)}>{body}</button> : <div key={x.key} className="slice-row">{body}</div>; })}</div>
    </>;
}

function KindBreakdown({ kinds, currency }: { kinds: KindStat[]; currency: string }) {
    const [open, setOpen] = useState<ReceiptKind | ''>('');
    const k = kinds.find(x => x.kind === open);
    if (!k) return <section className="chart-card kind-card">
        <h2>{tr('By category')}</h2>
        <SliceChart currency={currency} onOpen={key => setOpen(key as ReceiptKind)} slices={kinds.map(x => ({ key: x.kind, label: tr(KIND_LOOK[x.kind][2]), icon: KIND_LOOK[x.kind][1], color: KIND_LOOK[x.kind][0], cents: x.cents, sub: x.trips + ' ' + tr('trips') }))}/>
    </section>;
    const byCategory = k.kind === 'groceries' && k.categories.length > 0;
    const slices: Slice[] = byCategory
        ? k.categories.map((x, i) => ({ key: x.name, label: tr(x.name), icon: catIcon(x.name), color: catColor(x.name, i), cents: x.cents, sub: x.products.slice(0, 3).map(p => p.name).join(', ') }))
        : k.stores.map((x, i) => ({ key: x.name, label: x.name, icon: '📍', color: FALLBACK_COLORS[i % FALLBACK_COLORS.length], cents: x.cents, sub: x.trips + ' ' + tr('trips') }));
    return <section className="chart-card kind-card">
        <button type="button" className="kind-back" onClick={() => setOpen('')}><ChevronLeft size={18}/>{tr('By category')}</button>
        <h2>{KIND_LOOK[k.kind][1]} {tr(KIND_LOOK[k.kind][2])}</h2>
        <p>{byCategory ? tr('Food only') : tr('By store')}</p>
        <SliceChart key={k.kind} currency={currency} slices={slices}/>
    </section>;
}

/** One colour per weekday, so the week reads like a little rainbow. */
const WEEKDAY_COLORS = ['#3f7fbf', '#3fae9c', '#4f9d4a', '#c7a227', '#e8833a', '#d9649a', '#8a7cc0'];
/** Store colours follow spending rank, so the biggest store keeps the same colour in every card. */
const STORE_COLORS = ['#2f8f5b', '#e8833a', '#3f7fbf', '#d9649a', '#8a7cc0', '#c7a227', '#3fae9c', '#c8423b', '#5d6b75'];
function storePalette(names: string[]) {
    const map = new Map<string, string>();
    for (const n of names) if (!map.has(n)) map.set(n, STORE_COLORS[map.size % STORE_COLORS.length]);
    return (name: string) => map.get(name) || '#9aa58f';
}

function Weekdays({ days, largest, currency }: { days: WeekdayStat[]; largest: Receipt | null; currency: string }) {
    const max = Math.max(...days.map(d => d.cents), 1), top = days.reduce((a, d) => d.cents > a.cents ? d : a, days[0]);
    const [picked, setPicked] = useState<number | null>(null);
    const shown = picked === null ? null : days[picked];
    return <section className="chart-card weekday-card">
        <h2>{tr('By weekday')}</h2>
        <p>{top.cents ? phrase('You spend the most on {0}', weekdayName(top.day, 'long')) : tr('Per week')}</p>
        <div className="weekday-tip" aria-live="polite">{shown ? <><b style={{ color: WEEKDAY_COLORS[shown.day] }}>{weekdayName(shown.day, 'long')}</b><span>{money(shown.cents, currency)} · {shown.trips} {shown.trips === 1 ? tr('trip') : tr('trips')}{shown.trips ? ' · ' + tr('Ø per shop') + ' ' + money(Math.round(shown.cents / shown.trips), currency) : ''}</span></> : <span>{tr('tap a bar for details')}</span>}</div>
        <div className="weekday-bars">{days.map(d => <button type="button" key={d.day} className={'weekday-bar' + (d === top && d.cents ? ' top' : '') + (picked === d.day ? ' active' : '')} aria-pressed={picked === d.day} aria-label={weekdayName(d.day, 'long') + ': ' + money(d.cents, currency)} onClick={() => setPicked(picked === d.day ? null : d.day)}>
            <em>{d === top && d.cents ? '👑' : d.trips || ''}</em>
            <span><i style={{ height: d.cents ? Math.max(6, d.cents / max * 100) + '%' : '0', background: WEEKDAY_COLORS[d.day], animationDelay: d.day * 60 + 'ms' }}/></span>
            <small>{weekdayName(d.day)}</small>
        </button>)}</div>
        {largest && <div className="largest-shop"><span className="largest-icon">🏆</span><span><small>{tr('Largest shop')}</small><b>{largest.store}</b><small>{day(largest.date)}</small></span><strong><Count value={largest.totalCents} format={n => money(n, currency)}/></strong></div>}
    </section>;
}

function bucketLabel(b: TimeBucket, unit: 'week' | 'month') { return unit === 'week' ? day(b.from) : monthName(b.key, 'short'); }

/** Bars stacked by receipt type, with the period average as a dashed line. */
function Timeline({ buckets, unit, currency }: { buckets: TimeBucket[]; unit: 'week' | 'month'; currency: string }) {
    const [active, setActive] = useState<number | null>(null);
    const max = Math.max(...buckets.map(b => b.cents), 1);
    const used = buckets.filter(b => b.cents > 0), average = used.length ? Math.round(used.reduce((n, b) => n + b.cents, 0) / used.length) : 0;
    const kinds = (Object.keys(KIND_LOOK) as ReceiptKind[]).filter(k => buckets.some(b => b.kinds[k]));
    // Axis labels are spaced back from the newest bar so the last label never collides.
    const every = Math.ceil(buckets.length / 6);
    const shown = active === null ? null : buckets[active], before = active ? buckets[active - 1] : null;
    return <section className="chart-card timeline-card">
        <h2>{tr('Spending over time')}</h2>
        <p>{unit === 'week' ? tr('Per week') : tr('Per month')} · {tr('tap a bar for details')}</p>
        <div className="timeline-tip" aria-live="polite">{shown ? <>
            <b>{money(shown.cents, currency)}</b>
            <span>{unit === 'week' ? phrase('Week of {0}', day(shown.from)) : monthName(shown.key)} · {shown.trips} {shown.trips === 1 ? tr('trip') : tr('trips')}</span>
            {before && before.cents > 0 && shown.cents > 0 && <span className={shown.cents > before.cents ? 'pricier' : 'cheaper'}>{shown.cents > before.cents ? '▲' : '▼'} {percent((shown.cents - before.cents) / before.cents)}</span>}
            <span className="timeline-kinds">{kinds.filter(k => shown.kinds[k]).map(k => <em key={k} style={{ '--accent': KIND_LOOK[k][0] } as React.CSSProperties}>{KIND_LOOK[k][1]} {money(shown.kinds[k] || 0, currency)}</em>)}</span>
        </> : <span>{tr('Highest')}: <b>{money(max, currency)}</b> · {tr('Average')}: <b>{money(average, currency)}</b></span>}</div>
        <div className="timeline-bars" role="group" aria-label={buckets.map(b => bucketLabel(b, unit) + ': ' + money(b.cents, currency)).join('; ')} onMouseLeave={() => setActive(null)}>
            {average > 0 && <div className="timeline-average" style={{ bottom: `calc(22px + (100% - 22px) * ${average / max})` }}><span>Ø {money(average, currency)}</span></div>}
            {buckets.map((b, i) => <button type="button" key={b.key} className={'timeline-bar' + (active === i ? ' active' : '') + (active !== null && active !== i ? ' dim' : '')} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)} aria-label={bucketLabel(b, unit) + ': ' + money(b.cents, currency)}>
                <span><i style={{ height: b.cents ? Math.max(3, b.cents / max * 100) + '%' : '0', animationDelay: Math.min(i * 35, 600) + 'ms' }}>{kinds.map(k => b.kinds[k] ? <u key={k} style={{ flexGrow: b.kinds[k], background: KIND_LOOK[k][0] }}/> : null)}</i></span>
                <small>{(buckets.length - 1 - i) % every === 0 ? bucketLabel(b, unit) : ''}</small>
            </button>)}
        </div>
        {kinds.length > 1 && <div className="kind-legend">{kinds.map(k => <span key={k}><i style={{ background: KIND_LOOK[k][0] }}/>{tr(KIND_LOOK[k][2])}</span>)}</div>}
    </section>;
}

/** Stores as coloured bars; tap one for its average shop, last visit, price level and top products. */
function Stores({ stores, index, color, currency }: { stores: StoreStat[]; index: StoreIndex[]; color: (s: string) => string; currency: string }) {
    const [open, setOpen] = useState('');
    const max = stores[0]?.cents || 1;
    return <section className="chart-card">
        <h2>{tr('By store')}</h2>
        <p>{tr('Your places to shop')} · {tr('tap a store for details')}</p>
        <div className="store-list">{stores.map(st => { const ix = index.find(x => x.store === st.name), isOpen = open === st.name;
            return <div key={st.name} className={'store-item' + (isOpen ? ' open' : '')} style={{ '--accent': color(st.name) } as React.CSSProperties}>
                <button type="button" className="store-bar" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : st.name)}>
                    <div><b><i className="store-dot"/>{st.name}</b><strong>{money(st.cents, currency)}</strong></div>
                    <span><i style={{ width: `${st.cents / max * 100}%` }}/></span>
                    <small>{st.trips} {st.trips === 1 ? tr('trip') : tr('trips')} · {share(st.share)}{ix && <em className={ix.index < 99.5 ? 'cheaper' : ix.index > 100.5 ? 'pricier' : ''}>{ix.index < 99.5 ? '▼ ' + phrase('{0} cheaper', percent((100 - ix.index) / 100)).replace('+', '') : ix.index > 100.5 ? '▲ ' + phrase('{0} more expensive', percent((ix.index - 100) / 100)).replace('+', '') : tr('average')}</em>}<ChevronDown size={14}/></small>
                </button>
                {isOpen && <div className="store-detail">
                    <span><small>{tr('Ø per shop')}</small><b>{money(st.averageCents, currency)}</b></span>
                    <span><small>{tr('Last visit')}</small><b>{st.lastDate ? day(st.lastDate) : '–'}</b></span>
                    <span><small>{tr('Compared products')}</small><b>{ix ? ix.products : '–'}</b></span>
                    {st.products.length > 0 && <ul>{st.products.map(p => <li key={p.name}><span>{p.name}</span><b>{money(p.cents, currency)}</b></li>)}</ul>}
                </div>}
            </div>; })}</div>
    </section>;
}

type PriceFilter = 'all' | 'kg' | 'L' | 'pack';
const PRICE_FILTERS: { id: PriceFilter; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'kg', label: '⚖️ per kg' }, { id: 'L', label: '💧 per litre' }, { id: 'pack', label: '📦 per pack' }];
const matchesFilter = (c: PriceComparison, f: PriceFilter) => f === 'all' || (f === 'pack' ? c.unit !== 'kg' && c.unit !== 'L' : c.unit === f);

/** Store price level as bars around the average, then the products bought at more than one store. */
function CheaperStore({ comparisons, index, color, currency }: { comparisons: PriceComparison[]; index: StoreIndex[]; color: (s: string) => string; currency: string }) {
    const [filter, setFilter] = useState<PriceFilter>('all'), [q, setQ] = useState(''), [all, setAll] = useState(false), limit = useNarrow() ? 3 : 6;
    const rows = comparisons.filter(c => matchesFilter(c, filter) && normalize(c.name).includes(normalize(q))), shown = all ? rows : rows.slice(0, limit);
    const span = Math.max(5, ...index.map(x => Math.abs(x.index - 100)));
    return <section className="chart-card">
        <h2>{tr('Which store is cheaper?')}</h2>
        <p>{tr('Same product, compared per kg, litre or identical pack across all your receipts')}</p>
        {index.length ? <>
            <div className="index-chart">{index.map(x => { const d = x.index - 100, w = Math.abs(d) / span * 50;
                return <div key={x.store} className="index-line">
                    <b><i className="store-dot" style={{ background: color(x.store) }}/>{x.store}</b>
                    <span className="index-track"><i className={d < 0 ? 'cheaper-bar' : 'pricier-bar'} style={d < 0 ? { right: '50%', width: w + '%' } : { left: '50%', width: w + '%' }}/></span>
                    <em className={d < -0.5 ? 'cheaper' : d > 0.5 ? 'pricier' : ''}>{d < -0.5 ? '▼ ' + percent(-d / 100).replace('+', '') : d > 0.5 ? '▲ ' + percent(d / 100).replace('+', '') : '±0'}</em>
                </div>; })}
                <div className="index-axis"><span>{tr('cheaper')}</span><span>Ø</span><span>{tr('more expensive')}</span></div>
            </div>
            <div className="compare-tools">
                <div className="period-chips small" role="group">{PRICE_FILTERS.map(f => <button type="button" key={f.id} aria-pressed={filter === f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>{tr(f.label)}</button>)}</div>
                <label className="compare-search"><Search size={15}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={tr('Find a product…')} aria-label={tr('Search products')}/></label>
            </div>
            <div className="compare-list">{shown.map(c => { const high = c.stores[c.stores.length - 1].unitCents || 1;
                return <div key={c.key} className="compare-row">
                    <div className="compare-head"><b>{catIcon(c.category)} {c.name}</b>{c.spread > 0.005 && <small className="spread">{phrase('{0} difference', share(c.spread))}</small>}</div>
                    {c.stores.map((p, i) => <div key={p.store} className={'compare-store' + (i === 0 ? ' best' : '')} style={{ '--accent': color(p.store) } as React.CSSProperties}>
                        <span>{i === 0 ? '🏆 ' : ''}{p.store}</span>
                        <span className="compare-bar"><i style={{ width: p.unitCents / high * 100 + '%' }}/></span>
                        <b>{money(p.unitCents, currency)}/{unitText(c.unit)}</b>
                    </div>)}
                </div>; })}
                {!rows.length && <p className="muted-note">{tr('No products match.')}</p>}
            </div>
            {rows.length > limit && <button type="button" className="secondary compare-more" onClick={() => setAll(v => !v)}>{all ? tr('Show fewer') : phrase('Show all {0} products', rows.length)}</button>}
        </> : <p className="muted-note">{tr('Buy the same product at two different stores and Basket compares the prices here.')}</p>}
    </section>;
}

/** Price per kg (or lb) for loose fruit, veggies, meat and fish, cheapest store first. */
function KiloPrices({ prices, color, currency }: { prices: PriceComparison[]; color: (s: string) => string; currency: string }) {
    const [unit, setUnit] = useState<WeightUnit>(currency === 'CAD' ? 'lb' : 'kg'), [group, setGroup] = useState('');
    const rows = prices.filter(c => c.unit === 'kg' && isWeighable(c.category, c.name));
    const groups = [...new Set(rows.map(c => c.category === 'Produce' ? 'Veggies' : c.category))];
    const shown = rows.filter(c => !group || c.category === group || (group === 'Veggies' && c.category === 'Produce'));
    const per = (cents: number) => money(convertUnitPrice(cents, 'kg', unit), currency) + '/' + unit;
    return <section className="chart-card kilo-card">
        <div className="card-head"><div><h2>⚖️ {tr('Price per kg')}</h2><p>{tr('Fruit, veggies, meat and fish by weight, cheapest store first')}</p></div>
            <div className="unit-toggle" role="radiogroup" aria-label={tr('Weight unit')}>{(['kg', 'lb'] as const).map(u => <button type="button" role="radio" key={u} aria-checked={unit === u} onClick={() => setUnit(u)}>{u}</button>)}</div></div>
        {rows.length ? <>
            {groups.length > 1 && <div className="slice-chips">{['', ...groups].map(g => <button type="button" key={g || 'all'} className="slice-chip" aria-pressed={group === g} style={{ '--accent': g ? catColor(g) : '#285640' } as React.CSSProperties} onClick={() => setGroup(g)}>{g ? catIcon(g) + ' ' + tr(g) : tr('All')}</button>)}</div>}
            <div className="kilo-grid">{shown.map(c => { const best = c.stores[0];
                return <div key={c.key} className="kilo-tile" style={{ '--accent': catColor(c.category) } as React.CSSProperties}>
                    <span className="kilo-icon">{catIcon(c.category)}</span>
                    <b>{c.name}</b>
                    <strong>{per(best.unitCents)}</strong>
                    <small><i className="store-dot" style={{ background: color(best.store) }}/>{best.store} · {day(best.lastDate)}</small>
                    {c.stores.slice(1).map(p => <small key={p.store} className="kilo-other"><i className="store-dot" style={{ background: color(p.store) }}/>{p.store} {per(p.unitCents)} <em className="pricier">+{share((p.unitCents - best.unitCents) / (best.unitCents || 1))}</em></small>)}
                </div>; })}</div>
        </> : <p className="muted-note">{tr('Open a receipt and add the weight to fruit, veggies, meat or nuts. Basket then remembers what a kilo costs where.')}</p>}
    </section>;
}

/** Top products as category-coloured bars; tap one for its unit prices per store. */
function MostBought({ products, prices, color, currency }: { products: ProductStat[]; prices: PriceComparison[]; color: (s: string) => string; currency: string }) {
    const [by, setBy] = useState<'spend' | 'count'>('spend'), [open, setOpen] = useState(''), [all, setAll] = useState(false), limit = useNarrow() ? 5 : 8;
    const top = [...products].sort((a, b) => by === 'spend' ? b.cents - a.cents : b.purchases - a.purchases || b.cents - a.cents).slice(0, 8), list = all ? top : top.slice(0, limit);
    const max = Math.max(...list.map(p => by === 'spend' ? p.cents : p.purchases), 1);
    return <section className="chart-card rank-card">
        <div className="card-head"><div><h2>{tr('Most bought')}</h2><p>{tr('Products with the highest spending in this period')}</p></div>
            <div className="unit-toggle" role="radiogroup" aria-label={tr('Sort')}><button type="button" role="radio" aria-checked={by === 'spend'} onClick={() => setBy('spend')}>{tr('Amount')}</button><button type="button" role="radio" aria-checked={by === 'count'} onClick={() => setBy('count')}>{tr('How often')}</button></div></div>
        <div className="rank-list">{list.map((p, i) => { const isOpen = open === p.key, own = prices.filter(c => c.key.startsWith(p.key + '|'));
            return <div key={p.key} className={'rank-row' + (isOpen ? ' open' : '')} style={{ '--accent': catColor(p.category, i) } as React.CSSProperties}>
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : p.key)}>
                    <span className="rank-head"><b><span className="rank-icon">{catIcon(p.category)}</span>{p.name}</b><strong>{by === 'spend' ? money(p.cents, currency) : p.purchases + '×'}</strong></span>
                    <span className="rank-bar"><i style={{ width: (by === 'spend' ? p.cents : p.purchases) / max * 100 + '%' }}/></span>
                    <small>{by === 'spend' ? p.purchases + '× ' + tr('bought') : money(p.cents, currency)} · {p.stores.join(', ')}<ChevronDown size={13}/></small>
                </button>
                {isOpen && <ul className="rank-detail">{own.length ? own.flatMap(c => c.stores.map((s, si) => <li key={c.key + s.store}><span><i className="store-dot" style={{ background: color(s.store) }}/>{si === 0 && c.stores.length > 1 ? '🏆 ' : ''}{s.store} · {s.purchases}×</span><b>{money(s.unitCents, currency)}/{unitText(c.unit)}</b></li>)) : <li><span>{tr('No price data')}</span></li>}</ul>}
            </div>; })}</div>
        {top.length > limit && <button type="button" className="secondary compare-more" onClick={() => setAll(v => !v)}>{all ? tr('Show fewer') : phrase('Show all {0} products', top.length)}</button>}
    </section>;
}

function PriceMoves({ changes, color, currency }: { changes: PriceChange[]; color: (s: string) => string; currency: string }) {
    const rises = changes.filter(c => c.change > 0).slice(0, 5), drops = changes.filter(c => c.change < 0).slice(0, 5);
    const row = (c: PriceChange) => <div key={c.key} className={'move-row ' + (c.change > 0 ? 'up' : 'down')}>
        <span className="move-badge">{c.change > 0 ? '▲' : '▼'}</span>
        <span><b>{c.name}</b><small><i className="store-dot" style={{ background: color(c.store) }}/>{c.store} · {day(c.date)}</small></span>
        <span><em>{percent(c.change)}</em><small>{money(c.previousCents, currency)} → {money(c.latestCents, currency)}/{unitText(c.unit)}</small></span>
    </div>;
    return <section className="chart-card price-moves">
        <h2>{tr('Price changes')}</h2>
        <p>{tr('Latest price compared with your previous purchase at the same store')}</p>
        <div className="moves">
            <div><h3 className="pricier"><TrendingUp size={16}/>{tr('More expensive')}</h3>{rises.length ? rises.map(row) : <p className="muted-note">{tr('No price increases recorded.')}</p>}</div>
            <div><h3 className="cheaper"><TrendingDown size={16}/>{tr('Cheaper')}</h3>{drops.length ? drops.map(row) : <p className="muted-note">{tr('No price drops recorded.')}</p>}</div>
        </div>
    </section>;
}

export function SpendingView({ data, scan, busy, act }: {
    data: BasketData;
    scan: () => void;
    busy: boolean;
    act: (a: string, b?: unknown, m?: string) => Promise<unknown>;
}) {
    const months = monthOptions(data);
    const currencies = receiptCurrencies(data.receipts);
    const [period, setPeriod] = useState<PeriodKey>('month');
    const [chosenMonth, setMonth] = useState('');
    const [chosenCurrency, setCurrency] = useState('');
    const currency = chosenCurrency || currencies[0] || 'CAD';
    const month = chosenMonth || defaultSpendingMonth(data.receipts, currency);
    const s = spendingStats(data, period, month, currency);
    const color = storePalette([...s.stores.map(x => x.name), ...s.unitPrices.flatMap(c => c.stores.map(x => x.store))]);
    return <>
        <Intro eyebrow="SMALL SHOPS. A CLEARER PICTURE." title={tr('Where it all goes')} action={<div className="period">
            {period === 'month' && <select value={month} onChange={e => setMonth(e.target.value)} aria-label={tr('Spending month')}>{months.map(m => <option key={m} value={m}>{monthName(m)}</option>)}</select>}
            <select value={currency} onChange={e => setCurrency(e.target.value)} aria-label={tr('Spending currency')}>{(currencies.length ? currencies : ['CAD', 'EUR']).map(c => <option key={c} value={c}>{tr(c)}</option>)}</select>
        </div>}>{null}</Intro>
        <div className="period-chips" role="group" aria-label={tr('Period')}>{PERIODS.map(p => <button type="button" key={p.id} aria-pressed={period === p.id} className={period === p.id ? 'active' : ''} onClick={() => setPeriod(p.id)}>{tr(p.label)}</button>)}</div>
        {s.trips ? <div className="spend-anim" key={period + month + currency}>
            <KindBreakdown kinds={s.kinds} currency={currency}/>
            {period === 'month' && <BudgetPanel data={data} month={month} currency={currency} busy={busy} act={act}/>}
            <Timeline buckets={s.timeline.buckets} unit={s.timeline.unit} currency={currency}/>
            <div className="spending-layout">
                <Weekdays days={s.weekdays} largest={s.largest} currency={currency}/>
                <Stores stores={s.stores} index={s.storeIndex} color={color} currency={currency}/>
            </div>
            <KiloPrices prices={s.unitPrices} color={color} currency={currency}/>
            <div className="spending-layout">
                <CheaperStore comparisons={s.comparisons} index={s.storeIndex} color={color} currency={currency}/>
                <MostBought products={s.products} prices={s.unitPrices} color={color} currency={currency}/>
            </div>
            {s.changes.length > 0 && <PriceMoves changes={s.changes} color={color} currency={currency}/>}
        </div> : <Empty title={tr('The bigger picture starts with one shop.')} action={<button className="primary" onClick={scan}><ScanLine size={17}/>{tr('Scan a receipt')}</button>}>{tr('Scan a receipt in this period and currency to see where your money goes.')}</Empty>}
        <p className="spending-note"><ShieldCheck size={16}/>{tr('Based on saved receipts. Different currencies are never added together.')}</p>
    </>;
}
