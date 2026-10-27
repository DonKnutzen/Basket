export const PAGES_BUILD=Boolean(import.meta.env.VITE_BASKET_API_URL);
export const APP_BASE=import.meta.env.BASE_URL||'/';
export const API_ORIGIN=import.meta.env.VITE_BASKET_API_URL||'';
export function appPath(path=''){return APP_BASE+path.replace(/^\//,'')}
export function apiUrl(path:string){return API_ORIGIN+path}
export function confirmationUrl(){return new URL(appPath(PAGES_BUILD?'account-complete.html':'account-complete'),window.location.origin).href}
