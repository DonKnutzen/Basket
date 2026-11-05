import {toCents} from './types';
// Loose fruit, veggies, meat and fish are priced by weight: either the weight or the price per kg/lb is known.
export const WEIGHED_CATEGORIES=new Set(['Fruit','Veggies','Produce','Meat & fish']);
export type WeightUnit='kg'|'lb';
export type MeasureUnit=WeightUnit|'g';
export const WEIGHT_UNITS:MeasureUnit[]=['lb','kg','g'];
export const isWeightUnit=(unit?:string):unit is MeasureUnit=>unit==='kg'||unit==='lb'||unit==='g';
/** Canadian shelves price loose food per lb, German ones per kg. */
export const defaultWeightUnit=(currency:string):WeightUnit=>currency==='CAD'?'lb':'kg';
// Nuts, seeds and the like are sorted under snacks or pantry, so these go by the product name.
const BULK_CATEGORIES=new Set(['Snacks & sweets','Pantry','Pasta, rice & grains','Other']);
const BULK_FOOD=/\bnuts?\b|(?:pea|wal|hazel)nuts?\b|n[uü]ss|nuesse|almond|mandel|cashew|pistachio|pistazie|pecan|macadamia|kerne\b|\bseeds?\b|trail mix|studentenfutter/i;
const NOT_BULK_FOOD=/butter|creme|cream|milk|milch|\b[oö]i?l\b|\bmus\b|schoko|chocolate|nougat|riegel|\bbar\b|\beis\b|flips|kuchen|ecke|joghurt/i;
/** True for food that is usually bought by weight. */
export function isWeighable(category:string,name:string){return WEIGHED_CATEGORIES.has(category)||(BULK_CATEGORIES.has(category)&&BULK_FOOD.test(name)&&!NOT_BULK_FOOD.test(name))}
/** Reads a single weight such as "500 g" from a pack size; null for "2 L" or "6 x 100 g". */
export function packWeight(packSize:string){const m=packSize.trim().match(/^(\d+(?:[.,]\d{1,6})?)\s*(kg|g|lb)$/i);return m?{quantity:m[1].replace(',','.'),unit:m[2].toLowerCase() as MeasureUnit}:null}
/** Price per kg and per lb in cents for a line total and its weight in lb, kg or g. */
export function weightPrices(amountCents:number,quantity:number,unit:MeasureUnit){if(!(quantity>0)||!(amountCents>=0))return null;const kg=unit==='g'?quantity/1000:unit==='lb'?quantity*LB_IN_KG:quantity;return {kg:Math.round(amountCents/kg),lb:Math.round(amountCents/kg*LB_IN_KG)}}
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
