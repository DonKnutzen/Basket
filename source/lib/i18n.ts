import german from './de.json';
export type Language='en'|'de';
const KEY='basket-language';let language:Language='en';const listeners=new Set<()=>void>();
export function getLanguage(){return language}
export function locale(){return language==='de'?'de-DE':'en-CA'}
export function initializeLanguage(){try{const value=localStorage.getItem(KEY);if(value==='de'||value==='en')language=value}catch{}if(typeof document!=='undefined')document.documentElement.lang=language}
export function setLanguage(next:Language){language=next;try{localStorage.setItem(KEY,next)}catch{}if(typeof document!=='undefined')document.documentElement.lang=next;for(const notify of listeners)notify()}
export function subscribeLanguage(notify:()=>void){listeners.add(notify);const sync=(e:StorageEvent)=>{if(e.key===KEY){language=e.newValue==='de'?'de':'en';if(typeof document!=='undefined')document.documentElement.lang=language;for(const fn of listeners)fn()}};if(typeof window!=='undefined')window.addEventListener('storage',sync);return()=>{listeners.delete(notify);if(typeof window!=='undefined')window.removeEventListener('storage',sync)}}
export function translate(text:string,lang:Language):string{if(lang==='en')return text;const trimmed=text.trim(),key=trimmed.replace(/\s+/g,' ');const value=(german as Record<string,string>)[key];if(value!==undefined)return text.slice(0,text.indexOf(trimmed))+value+text.slice(text.lastIndexOf(trimmed)+trimmed.length);if(text.startsWith('Shared with '))return 'Geteilt mit '+text.slice(12);return text}
export function tr(text?:string){return translate(text||'',language)}
export function phrase(template:string,...values:unknown[]){return tr(template).replace(/\{(\d+)\}/g,(_,i)=>String(values[Number(i)]??''))}
