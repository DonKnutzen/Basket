'use client';
import {tr,phrase,locale} from '../lib/i18n';
import React, { useState } from 'react';
const KEY = 'basket-text-size';
const SIZES = ['small', 'medium', 'large'] as const;
type TextSize = typeof SIZES[number];
function storedSize(): TextSize {
    try {
        const value = localStorage.getItem(KEY);
        if (SIZES.includes(value as TextSize))
            return value as TextSize;
    }
    catch { }
    return 'small';
}
export function initializeTextSize() {
    if (typeof document !== 'undefined')
        document.documentElement.dataset.textSize = storedSize();
}
export default function TextSizeSettings() {
    const [size, setSize] = useState<TextSize>(storedSize);
    function choose(next: TextSize) {
        setSize(next);
        document.documentElement.dataset.textSize = next;
        try {
            localStorage.setItem(KEY, next);
        }
        catch { }
    }
    return <fieldset className="text-size-settings"><legend>{tr("Text size")}</legend><div className="text-size-options">{SIZES.map((value, index) => <button key={value} type="button" className="text-size-option" data-option={value} aria-pressed={value === size} onClick={() => choose(value)}><span aria-hidden="true">{tr("Aa")}</span><b>{tr(['Small', 'Medium', 'Large'][index])}</b></button>)}</div><p>{tr("Applies to all screens on this device.")}</p></fieldset>;
}
