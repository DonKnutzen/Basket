/**
 * iOS installed PWAs and embedded browsers may render a blank view when a
 * retailer/PDF link opens with target="_blank". A normal anchor navigating
 * in the SAME tab keeps the link clickable without relying on window.open
 * or requiring shoppers to copy URLs into Safari.
 *
 * In regular browsers keep the existing new-tab behavior.
 */
export function shouldOpenExternalOfferInSameTab(userAgent:string,standalone:boolean):boolean{
 const ios=/iPhone|iPad|iPod/i.test(userAgent)||(/Macintosh/i.test(userAgent)&&/Mobile/i.test(userAgent));
 const embedded=/CriOS|FxiOS|EdgiOS|ChatGPT|FBAN|FBAV|Instagram|GSA/i.test(userAgent);
 return ios&&(standalone||embedded);
}
export function isSameTabOfferLinkContext():boolean{
 if(typeof window==='undefined'||typeof navigator==='undefined')return false;
 const webkitStandalone=(navigator as Navigator&{standalone?:boolean}).standalone===true;
 const standalone=webkitStandalone||window.matchMedia?.('(display-mode: standalone)').matches===true;
 return shouldOpenExternalOfferInSameTab(navigator.userAgent,standalone);
}
