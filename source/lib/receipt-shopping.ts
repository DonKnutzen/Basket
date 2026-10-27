import {normalize,type Item,type ReceiptDraft,type ReceiptShopping} from './types';
// Compare only positive evidence. Unbought list items never become forgotten purchases.
export function purchaseType(name:string,items:Pick<Item,'name'>[]){
 const key=normalize(name);
 return items.some(item=>normalize(item.name)===key)?'planned' as const:'extra' as const;
}
export function shoppingSummary(draft:ReceiptDraft,listName?:string,firstPurchases:string[]=[]):ReceiptShopping{
 return {listName,extraItems:listName?draft.lines.filter(line=>line.purchaseType==='extra').map(line=>line.name):[],firstPurchases};
}
// Versioned envelope in the existing receipt raw_text field; old receipts remain readable.
export function readShopping(raw:unknown):ReceiptShopping|undefined{
 if(typeof raw!=='string')return;
 try{const value=JSON.parse(raw);if(value?.kind!=='basket-receipt-v1')return;const s=value.shopping;
 if(!s||!Array.isArray(s.extraItems)||!Array.isArray(s.firstPurchases))return;
 return {listName:typeof s.listName==='string'?s.listName:undefined,extraItems:s.extraItems.filter((x:unknown)=>typeof x==='string'),firstPurchases:s.firstPurchases.filter((x:unknown)=>typeof x==='string')};
 }catch{return}
}
