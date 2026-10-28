/**
 * iOS installed PWAs and some embedded iOS browsers can leave a blank view
 * when a cross-origin offer link opens with target="_blank".
 * Keep Basket open and let the shopper copy the URL into Safari instead.
 * Regular Safari and non-iOS browsers retain normal external links.
 */
export function mustCopyExternalOfferLink(userAgent:string,standalone:boolean):boolean{
 const ios=/iPhone|iPad|iPod/i.test(userAgent)||(/Macintosh/i.test(userAgent)&&/Mobile/i.test(userAgent));
 const embedded=/CriOS|FxiOS|EdgiOS|ChatGPT|FBAN|FBAV|Instagram|GSA/i.test(userAgent);
 return ios&&(standalone||embedded);
}
export function isCopyOnlyOfferLinkContext():boolean{
 if(typeof window==='undefined'||typeof navigator==='undefined')return false;
 const webkitStandAlone=(navigator as Navigator&{standalone?:boolean}).standalone===true;
 const standalone=webkitStandAlone||window.matchMedia?.('(display-mode: standalone)').matches===true;
 return mustCopyExternalOfferLink(navigator.userAgent,standalone);
}
