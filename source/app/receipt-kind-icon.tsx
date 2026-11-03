import { Fuel, ReceiptText, ShoppingBasket, UtensilsCrossed } from 'lucide-react';
import type { Receipt, ReceiptKind } from '../lib/types';

// Older receipts have no stored type; guess from their lines.
export function receiptKindOf(r: Pick<Receipt, 'kind'>, lines: { category?: string }[] = []): ReceiptKind {
    if (r.kind) return r.kind;
    if (lines.length && lines.every(l => l.category === 'Fuel')) return 'fuel';
    if (lines.length && lines.every(l => l.category === 'Takeout')) return 'takeout';
    return 'groceries';
}
export function ReceiptKindIcon({ kind, size = 20 }: { kind: ReceiptKind; size?: number }) {
    const Icon = kind === 'fuel' ? Fuel : kind === 'takeout' ? UtensilsCrossed : kind === 'other' ? ReceiptText : ShoppingBasket;
    return <Icon size={size} aria-hidden="true"/>;
}
