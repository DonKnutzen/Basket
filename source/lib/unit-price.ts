import {toCents} from './types';
// Loose fruit, veggies, meat and fish are priced by weight: either the weight or the price per kg/lb is known.
export const WEIGHED_CATEGORIES=new Set(['Fruit','Veggies','Produce','Meat & fish']);
export type WeightUnit='kg'|'lb';
export const LB_IN_KG=0.45359237;
/** A positive decimal such as "0,856" or "1.2"; NaN otherwise. */
export function parseAmount(value:string){const v=value.trim().replace(',','.');return /^\d+(?:\.\d+)?$/.test(v)&&Number(v)>0?Number(v):NaN}
/** Weights are stored with at most six decimals, as the price history expects. */
export function weightText(weight:number){return weight>0&&Number.isFinite(weight)?String(Math.round(weight*1e6)/1e6):''}
/** Price per kg or lb in cents for a paid line total. */
export function pricePerUnit(amountCents:number,weight:number){return weight>0&&amountCents>=0?Math.round(amountCents/weight):NaN}
/** The weight that a line total buys at a given price per kg or lb. */
export function weightForPrice(amountCents:number,unitPrice:string){const c=toCents(unitPrice);return c>0&&amountCents>0?amountCents/c:NaN}
/** Converts a price per kg into a price per lb and back. */
export function convertUnitPrice(cents:number,from:WeightUnit,to:WeightUnit){return from===to?cents:from==='kg'?Math.round(cents*LB_IN_KG):Math.round(cents/LB_IN_KG)}
