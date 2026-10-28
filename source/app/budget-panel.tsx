'use client';
import {tr,phrase,locale} from '../lib/i18n';
import React, { useState } from 'react';
import { Users, Plus, Pencil, Trash2, Check, ChartNoAxesCombined, LoaderCircle } from 'lucide-react';
import { Modal } from './basket-app';
import { CATEGORIES, money, type BasketData, type Budget } from '../lib/types';
import { budgetSpent } from '../lib/budgets';
export default function BudgetPanel({ data, month, currency, busy, act }: {
    data: BasketData;
    month: string;
    currency: string;
    busy: boolean;
    act: (a: string, b?: any, m?: string) => Promise<any>;
}) {
    const [editing, setEditing] = useState<string | null>(null);
    const budgets = data.budgets.filter(b => b.month === month && b.currency === currency), overall = budgets.find(b => b.category === 'Overall'), categories = budgets.filter(b => b.category !== 'Overall');
    const card = (b: Budget) => { const spent = budgetSpent(b, data), remaining = b.amountCents - spent, percent = Math.round(spent / b.amountCents * 100); return <article className={'budget-card ' + (remaining < 0 ? 'over-budget' : '')} key={b.id}><div className="budget-card-heading"><div><p>{b.category === 'Overall' ? tr("MONTHLY HOUSEHOLD BUDGET") : tr(b.category)}</p><h3>{money(b.amountCents, b.currency)} <small>{b.currency}</small></h3></div><button className="icon-button" onClick={() => setEditing(b.category)} aria-label={phrase("Edit {0} budget", b.category)}><Pencil size={17}/></button></div><div className="budget-progress" role="progressbar" aria-label={phrase("{0} budget used", b.category)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percent)} aria-valuetext={phrase("{0}% of budget used", percent)}><span style={{ width: Math.min(100, spent / b.amountCents * 100) + '%' }}/></div><div className="budget-figures"><span><b>{money(spent, b.currency)}</b>{tr(" spent")}</span><span><b>{money(Math.abs(remaining), b.currency)}</b> {remaining < 0 ? tr("over budget") : tr("left")}</span></div></article>; };
    return <section className="budget-section"><div className="budget-title"><div><h2>{tr("Your shared budget")}</h2><p><Users size={13}/>{data.household.name}{tr(" \u00B7 ")}{data.members.length} {data.members.length === 1 ? tr("member") : tr("members")}</p></div><button className="secondary" onClick={() => setEditing(overall ? 'Produce' : 'Overall')}><Plus size={15}/>{overall ? tr("Category budget") : tr("Set a budget")}</button></div>{overall ? card(overall) : <div className="budget-empty"><span><ChartNoAxesCombined size={28} strokeWidth={1.4}/></span><div><h3>{tr("A little plan for your everyday shop.")}</h3><p>{tr("Set a monthly limit together. Saved receipts keep your spending in view.")}</p></div><button className="text-link" onClick={() => setEditing('Overall')}>{tr("Set monthly budget ")}<Plus size={15}/></button></div>}{categories.length > 0 && <div className="category-budgets">{categories.map(card)}</div>}<p className="budget-note">{tr("The monthly budget includes recorded tax and fees. Category budgets use item totals before tax. Budgets stay with this household and month.")}</p>{editing && <BudgetEditor data={data} month={month} currency={currency} category={editing} busy={busy} close={() => setEditing(null)} save={async (b) => { if (await act('saveBudget', b, 'Shared budget saved'))
        setEditing(null); }} remove={async (id) => { if (await act('deleteBudget', { id }, 'Budget removed'))
        setEditing(null); }}/>}</section>;
}
function BudgetEditor({ data, month, currency, category: initial, busy, close, save, remove }: {
    data: BasketData;
    month: string;
    currency: string;
    category: string;
    busy: boolean;
    close: () => void;
    save: (b: any) => void;
    remove: (id: string) => void;
}) {
    const existing = (category: string) => data.budgets.find(b => b.month === month && b.currency === currency && b.category === category);
    const [category, setCategory] = useState(initial), [amount, setAmount] = useState(() => existing(initial) ? (existing(initial)!.amountCents / 100).toFixed(2) : ''), [confirm, setConfirm] = useState(false);
    const current = existing(category);
    return <Modal title={tr("A plan you can share.")} subtitle={new Date(month + '-15T12:00:00').toLocaleDateString(locale(), { month: 'long', year: 'numeric' }) + ' · ' + currency} close={close}><form className="dialog-form" onSubmit={e => { e.preventDefault(); save({ month, currency, category, amount }); }}><label>{tr("Budget for")}<select value={category} onChange={e => { setCategory(e.target.value); const b = existing(e.target.value); setAmount(b ? (b.amountCents / 100).toFixed(2) : ''); setConfirm(false); }}><option value="Overall">{tr("Whole household \u2014 monthly total")}</option>{CATEGORIES.map(c => <option key={c} value={c}>{tr(c)}</option>)}</select></label><label>{tr("Monthly amount (")}{currency}{tr(")")}<input type="number" inputMode="decimal" step="0.01" min="0.01" max="1000000" value={amount} onChange={e => setAmount(e.target.value)} placeholder={tr("e.g. 600.00")} required/></label><p className="hint">{tr("Everyone in ")}{data.household.name}{tr(" can see and update this budget. It applies to ")}{month}{tr(" only. Changing a budget never changes your saved receipts.")}</p><div className="modal-actions">{current ? <button className="danger" type="button" disabled={busy} onClick={() => confirm ? remove(current.id) : setConfirm(true)}><Trash2 size={15}/>{confirm ? tr("Yes, remove budget") : tr("Remove budget")}</button> : <button className="secondary" type="button" onClick={close}>{tr("Cancel")}</button>}<button className="primary" disabled={busy || !amount}>{busy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>}{tr("Save shared budget")}</button></div></form></Modal>;
}
