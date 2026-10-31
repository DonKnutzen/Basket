'use client';
import React, { useState } from 'react';
import { ShoppingBasket, ReceiptText, ChartNoAxesCombined, CalendarDays, ScanLine, ShieldCheck, TrendingUp, TrendingDown, ChevronDown, Store } from 'lucide-react';
import { tr, phrase, locale } from '../lib/i18n';
import { localDate, money, type BasketData } from '../lib/types';
import { monthOptions } from '../lib/budgets';
import { receiptCurrencies, spendingStats, type PeriodKey, type TimeBucket } from '../lib/spending-stats';
import BudgetPanel from './budget-panel';
import { Empty, Intro } from './basket-app';

const PERIODS: { id: PeriodKey; label: string }[] = [{ id: 'month', label: 'Month' }, { id: '3m', label: '3 months' }, { id: '12m', label: '12 months' }, { id: 'all', label: 'All time' }];
const percent = (value: number, digits = 0) => new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: digits, signDisplay: 'exceptZero' }).format(value);
const share = (value: number) => new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 0 }).format(value);
const day = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
const monthName = (m: string, style: 'short' | 'long' = 'long') => new Date(m + '-15T12:00:00').toLocaleDateString(locale(), { month: style, year: style === 'long' ? 'numeric' : '2-digit' });
const unitText = (unit: string) => unit === 'kg' || unit === 'L' ? unit : unit === 'piece' ? tr('piece') : unit;

function bucketLabel(b: TimeBucket, unit: 'week' | 'month') { return unit === 'week' ? day(b.from) : monthName(b.key, 'short'); }

function Timeline({ buckets, unit, currency }: { buckets: TimeBucket[]; unit: 'week' | 'month'; currency: string }) {
    const [active, setActive] = useState<number | null>(null);
    const max = Math.max(...buckets.map(b => b.cents), 1);
    // Axis labels are spaced back from the newest bar so the last label never collides.
    const every = Math.ceil(buckets.length / 6);
    const shown = active === null ? null : buckets[active];
    return <section className="chart-card timeline-card">
        <h2>{tr('Spending over time')}</h2>
        <p>{unit === 'week' ? tr('Per week') : tr('Per month')} · {tr('tap a bar for details')}</p>
        <div className="timeline-tip" aria-live="polite">{shown ? <><b>{money(shown.cents, currency)}</b><span>{unit === 'week' ? phrase('Week of {0}', day(shown.from)) : monthName(shown.key)} · {shown.trips} {shown.trips === 1 ? tr('trip') : tr('trips')}</span></> : <span>{tr('Highest')}: <b>{money(max, currency)}</b></span>}</div>
        <div className="timeline-bars" role="group" aria-label={buckets.map(b => bucketLabel(b, unit) + ': ' + money(b.cents, currency)).join('; ')} onMouseLeave={() => setActive(null)}>
            {buckets.map((b, i) => <button type="button" key={b.key} className={'timeline-bar' + (active === i ? ' active' : '')} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)} aria-label={bucketLabel(b, unit) + ': ' + money(b.cents, currency)}>
                <span><i style={{ height: b.cents ? Math.max(3, b.cents / max * 100) + '%' : '0' }} /></span>
                <small>{(buckets.length - 1 - i) % every === 0 ? bucketLabel(b, unit) : ''}</small>
            </button>)}
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
    const [month, setMonth] = useState(localDate().slice(0, 7));
    const [chosenCurrency, setCurrency] = useState('');
    const [openCategory, setOpenCategory] = useState('');
    const [allComparisons, setAllComparisons] = useState(false);
    const currency = chosenCurrency || currencies[0] || 'CAD';
    const s = spendingStats(data, period, month, currency);
    const delta = s.previousTotalCents ? (s.totalCents - s.previousTotalCents) / s.previousTotalCents : null;
    const periodText = period === 'month' ? monthName(month) : period === 'all' ? tr('All time') : tr(PERIODS.find(p => p.id === period)!.label);
    const maxCategory = s.categories[0]?.cents || 1, maxStore = s.stores[0]?.cents || 1, maxProduct = s.products[0]?.cents || 1;
    const comparisons = allComparisons ? s.comparisons : s.comparisons.slice(0, 6);
    const rises = s.changes.filter(c => c.change > 0).slice(0, 5), drops = s.changes.filter(c => c.change < 0).slice(0, 5);
    return <>
        <Intro eyebrow="SMALL SHOPS. A CLEARER PICTURE." title={tr('Where it all goes')} action={<div className="period">
            {period === 'month' && <select value={month} onChange={e => setMonth(e.target.value)} aria-label={tr('Spending month')}>{months.map(m => <option key={m} value={m}>{monthName(m)}</option>)}</select>}
            <select value={currency} onChange={e => setCurrency(e.target.value)} aria-label={tr('Spending currency')}>{(currencies.length ? currencies : ['CAD', 'EUR']).map(c => <option key={c} value={c}>{tr(c)}</option>)}</select>
        </div>}>{tr('Every scanned receipt flows in here: totals, categories, stores and prices.')}</Intro>
        <div className="period-chips" role="group" aria-label={tr('Period')}>{PERIODS.map(p => <button type="button" key={p.id} aria-pressed={period === p.id} className={period === p.id ? 'active' : ''} onClick={() => setPeriod(p.id)}>{tr(p.label)}</button>)}</div>
        {period === 'month' && <BudgetPanel data={data} month={month} currency={currency} busy={busy} act={act}/>}
        <div className="stats stats-four">
            <div className="stat featured"><span>{tr('TOTAL SPENT ')}<ShoppingBasket size={19}/></span><strong>{money(s.totalCents, currency)}</strong><small>{delta === null ? periodText : phrase('{0} vs. previous period', percent(delta))}</small></div>
            <div className="stat"><span>{tr('SHOPPING TRIPS ')}<ReceiptText size={19}/></span><strong>{String(s.trips).padStart(2, '0')}</strong><small>{tr('Across ')}{s.stores.length}{tr(' stores')}</small></div>
            <div className="stat"><span>{tr('AVERAGE SHOP ')}<ChartNoAxesCombined size={19}/></span><strong>{money(s.averageTripCents, currency)}</strong><small>{s.itemCount} {tr('items recorded')}</small></div>
            <div className="stat"><span>{tr('PER WEEK ')}<CalendarDays size={19}/></span><strong>{money(s.perWeekCents, currency)}</strong><small>{tr('Average in this period')}</small></div>
        </div>
        {s.trips ? <>
            <Timeline buckets={s.timeline.buckets} unit={s.timeline.unit} currency={currency}/>
            <div className="spending-layout">
                <section className="chart-card">
                    <h2>{tr('By category')}</h2>
                    <p>{tr('Tap a category to see what was in it')}</p>
                    <div className="rank-list">{s.categories.map(c => <div key={c.name} className={'rank-row' + (openCategory === c.name ? ' open' : '')}>
                        <button type="button" onClick={() => setOpenCategory(openCategory === c.name ? '' : c.name)} aria-expanded={openCategory === c.name}>
                            <span className="rank-head"><b>{tr(c.name)}</b><strong>{money(c.cents, currency)}</strong></span>
                            <span className="rank-bar"><i style={{ width: c.cents / maxCategory * 100 + '%' }}/></span>
                            <small>{share(c.share)} {tr('of item spending')} <ChevronDown size={13}/></small>
                        </button>
                        {openCategory === c.name && <ul className="rank-detail">{c.products.map(p => <li key={p.name}><span>{p.name}</span><b>{money(p.cents, currency)}</b></li>)}</ul>}
                    </div>)}</div>
                    <p className="chart-note">{tr('Tax is separate: ')}{money(s.taxCents, currency)}{tr('. Amounts reflect reviewed line totals.')}</p>
                </section>
                <section className="chart-card">
                    <h2>{tr('By store')}</h2>
                    <p>{tr('Your places to shop')}</p>
                    {s.stores.map(st => <div className="store-bar" key={st.name}><div><b>{st.name}</b><strong>{money(st.cents, currency)}</strong></div><span><i style={{ width: `${st.cents / maxStore * 100}%`, background: 'var(--green)' }}/></span><small>{st.trips} {st.trips === 1 ? tr('trip') : tr('trips')} · {tr('Ø per shop')} {money(st.averageCents, currency)} · {share(st.share)}</small></div>)}
                </section>
            </div>
            <div className="spending-layout">
                <section className="chart-card">
                    <h2>{tr('Which store is cheaper?')}</h2>
                    <p>{tr('Same product, compared per kg, litre or identical pack across all your receipts')}</p>
                    {s.storeIndex.length ? <>
                        <div className="index-list">{s.storeIndex.map(x => <div key={x.store} className="index-row"><Store size={16}/><b>{x.store}</b><span className={x.index < 99.5 ? 'cheaper' : x.index > 100.5 ? 'pricier' : ''}>{x.index < 99.5 ? phrase('{0} cheaper', percent((100 - x.index) / 100)).replace('+', '') : x.index > 100.5 ? phrase('{0} more expensive', percent((x.index - 100) / 100)).replace('+', '') : tr('average')}</span><small>{phrase('{0} products compared', x.products)}</small></div>)}</div>
                        <div className="compare-list">{comparisons.map(c => <div key={c.key} className="compare-row"><b>{c.name}</b><span>{c.stores.map((p, i) => <em key={p.store} className={i === 0 ? 'best' : ''}>{p.store} {money(p.unitCents, currency)}/{unitText(c.unit)}</em>)}</span>{c.spread > 0.005 && <small>{phrase('{0} difference', share(c.spread))}</small>}</div>)}</div>
                        {s.comparisons.length > 6 && <button type="button" className="secondary compare-more" onClick={() => setAllComparisons(v => !v)}>{allComparisons ? tr('Show fewer') : phrase('Show all {0} products', s.comparisons.length)}</button>}
                    </> : <p className="muted-note">{tr('Buy the same product at two different stores and Basket compares the prices here.')}</p>}
                </section>
                <section className="chart-card">
                    <h2>{tr('Most bought')}</h2>
                    <p>{tr('Products with the highest spending in this period')}</p>
                    <div className="rank-list">{s.products.slice(0, 8).map(p => <div key={p.key} className="rank-row static">
                        <span className="rank-head"><b>{p.name}</b><strong>{money(p.cents, currency)}</strong></span>
                        <span className="rank-bar"><i style={{ width: p.cents / maxProduct * 100 + '%' }}/></span>
                        <small>{p.purchases}× {tr('bought')} · {p.stores.join(', ')}</small>
                    </div>)}</div>
                </section>
            </div>
            {(rises.length > 0 || drops.length > 0) && <section className="chart-card price-moves">
                <h2>{tr('Price changes')}</h2>
                <p>{tr('Latest price compared with your previous purchase at the same store')}</p>
                <div className="moves">
                    <div><h3><TrendingUp size={16}/>{tr('More expensive')}</h3>{rises.length ? rises.map(c => <div key={c.key} className="move-row"><span><b>{c.name}</b><small>{c.store} · {day(c.date)}</small></span><span className="pricier">{percent(c.change)}<small>{money(c.previousCents, currency)} → {money(c.latestCents, currency)}/{unitText(c.unit)}</small></span></div>) : <p className="muted-note">{tr('No price increases recorded.')}</p>}</div>
                    <div><h3><TrendingDown size={16}/>{tr('Cheaper')}</h3>{drops.length ? drops.map(c => <div key={c.key} className="move-row"><span><b>{c.name}</b><small>{c.store} · {day(c.date)}</small></span><span className="cheaper">{percent(c.change)}<small>{money(c.previousCents, currency)} → {money(c.latestCents, currency)}/{unitText(c.unit)}</small></span></div>) : <p className="muted-note">{tr('No price drops recorded.')}</p>}</div>
                </div>
            </section>}
        </> : <Empty title={tr('The bigger picture starts with one shop.')} action={<button className="primary" onClick={scan}><ScanLine size={17}/>{tr('Scan a receipt')}</button>}>{tr('Scan a receipt in this period and currency to see where your money goes.')}</Empty>}
        <p className="spending-note"><ShieldCheck size={16}/>{tr('Based on saved receipts. Different currencies are never added together.')}</p>
    </>;
}
