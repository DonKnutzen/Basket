/**
 * Basket regional price-provider boundary.
 * Only documented opt-in data feeds are queried. No retailer scraping, bot bypass,
 * private endpoints, copied product images, or insertion into receipt price history.
 *
 * epiceries.ca/developers: public read-only API, browser CORS, third-party attribution,
 * weekly observations, reasonable usage. Coverage is Quebec chains, not individual shops.
 * Source terms reviewed 2026-10-28; upstream retailer data rights remain to be verified.
 */
export type Country = 'CA' | 'DE';
export type GroceryRegion = { country: Country; province: string; postalCode: string; preferredStores: string[] };
export type GroceryStore = { id: string; name: string; country: Country; provinces?: string[]; provider?: 'epiceries-ca' };
export const GROCERY_STORES: readonly GroceryStore[] = [
  { id: 'walmart', name: 'Walmart Canada', country: 'CA', provinces: ['QC'], provider: 'epiceries-ca' },
  { id: 'maxi', name: 'Maxi', country: 'CA', provinces: ['QC'], provider: 'epiceries-ca' },
  { id: 'iga', name: 'IGA', country: 'CA', provinces: ['QC'], provider: 'epiceries-ca' },
  { id: 'superc', name: 'Super C', country: 'CA', provinces: ['QC'], provider: 'epiceries-ca' },
  { id: 'metro', name: 'Metro', country: 'CA', provinces: ['QC'], provider: 'epiceries-ca' },
  { id: 'provigo', name: 'Provigo', country: 'CA', provinces: ['QC'], provider: 'epiceries-ca' },
  { id: 'nofrills', name: 'No Frills', country: 'CA' },
  { id: 'superstore', name: 'Atlantic Superstore / Real Canadian Superstore', country: 'CA' },
  { id: 'sobeys', name: 'Sobeys', country: 'CA' },
  { id: 'freshco', name: 'FreshCo', country: 'CA' },
  { id: 'giant-tiger', name: 'Giant Tiger', country: 'CA' },
  { id: 'rewe', name: 'REWE', country: 'DE' },
  { id: 'aldi-nord', name: 'ALDI Nord', country: 'DE' },
  { id: 'aldi-sued', name: 'ALDI Süd', country: 'DE' },
  { id: 'lidl', name: 'Lidl', country: 'DE' },
  { id: 'edeka', name: 'EDEKA', country: 'DE' },
  { id: 'penny', name: 'PENNY', country: 'DE' },
  { id: 'kaufland', name: 'Kaufland', country: 'DE' },
];
export const PROVINCES = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'] as const;
export const DEFAULT_GROCERY_REGION: GroceryRegion = { country: 'CA', province: 'NS', postalCode: '', preferredStores: [] };
export function normalizePostal(country: Country, value: string): string {
  const raw = value.trim().toUpperCase().replace(/\s/g, '');
  if (country === 'DE') return /^\d{5}$/.test(raw) ? raw : '';
  return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(raw)
    ? raw.slice(0,3) + ' ' + raw.slice(3) : '';
}
export function readGroceryRegion(raw: string | null): GroceryRegion {
  try {
    const value = JSON.parse(raw || '{}');
    const country: Country = value.country === 'DE' ? 'DE' : 'CA';
    const province = country === 'CA' && PROVINCES.includes(value.province) ? value.province : (country === 'CA' ? 'NS' : '');
    const validIds = new Set(GROCERY_STORES.filter(s => s.country === country).map(s => s.id));
    return {
      country, province, postalCode: normalizePostal(country, typeof value.postalCode === 'string' ? value.postalCode : ''),
      preferredStores: Array.isArray(value.preferredStores)
        ? [...new Set<string>(value.preferredStores.filter((x: unknown): x is string => typeof x === 'string' && validIds.has(x)))] : [],
    };
  } catch { return DEFAULT_GROCERY_REGION; }
}
export function localStores(region: GroceryRegion): GroceryStore[] {
  return GROCERY_STORES.filter(s => s.country === region.country);
}
export function availableProviderStores(region: GroceryRegion): GroceryStore[] {
  if (region.country !== 'CA' || region.province !== 'QC') return [];
  return localStores(region).filter(s => s.provider === 'epiceries-ca' &&
    (!region.preferredStores.length || region.preferredStores.includes(s.id)));
}
export type ObservedPrice = {
  source: 'epiceries-ca'; productId: string; productName: string; brand: string; packSize: string;
  storeId: string; storeName: string; priceCents: number; currency: 'CAD'; discounted: boolean;
  observedAt: string; unitPriceCents?: number; unit?: 'kg' | 'L' | 'piece';
};
export type ProductPriceResult = { productName: string; brand: string; packSize: string; prices: ObservedPrice[]; sourceName: string; fetchedAt: string };
const FR_TERMS: Record<string,string> = {
  milk:'lait', milch:'lait', eggs:'oeufs', egg:'oeuf', eier:'oeufs', ei:'oeuf',
  tomatoes:'tomate', tomato:'tomate', tomaten:'tomate',
  apples:'pomme', apple:'pomme', apfel:'pomme', aepfel:'pomme',
  bananas:'banane', banana:'banane', bananen:'banane',
  potatoes:'pomme de terre', potato:'pomme de terre', kartoffeln:'pomme de terre',
  bread:'pain', brot:'pain', cheese:'fromage', kase:'fromage', kaese:'fromage',
  butter:'beurre', chicken:'poulet', hahnchen:'poulet',
  carrots:'carotte', carrot:'carotte', karotten:'carotte',
  cucumber:'concombre', gurke:'concombre', rice:'riz', reis:'riz',
  onion:'oignon', onions:'oignon', zwiebel:'oignon', zwiebeln:'oignon',
  yogurt:'yogourt', yoghurt:'yogourt', joghurt:'yogourt',
};
export function normalizedName(name: string): string {
  return name.toLocaleLowerCase('fr').replace(/œ/g,'oe').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
export function searchTerm(name: string): string {
  const clean = normalizedName(name);
  if (FR_TERMS[clean]) return FR_TERMS[clean];
  // Keep original product qualifiers when the name is more specific than a dictionary entry.
  return clean;
}
function readUnitPrice(priceCents: number, pack: string) {
  const match = pack.trim().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|unites?|unités?|pcs?|pieces?|pièces?)$/i);
  if (!match) return null;
  const n = Number(match[1].replace(',','.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = match[2].toLowerCase();
  const factor = unit === 'g' || unit === 'ml' ? 1000 : 1;
  return {
    unit: (unit === 'kg' || unit === 'g' ? 'kg' : unit === 'l' || unit === 'ml' ? 'L' : 'piece') as 'kg'|'L'|'piece',
    cents: Math.round(priceCents * factor / n),
  };
}
type ApiProduct = { id?: unknown; name?: unknown; brand?: unknown; size?: unknown };
type ApiStorePrice = { store?: unknown; price?: unknown; discounted?: unknown; size?: unknown; date?: unknown };
type ApiResponse = { ok?: unknown; data?: unknown };
function getText(v: unknown): string { return typeof v === 'string' ? v.slice(0,250) : ''; }
function asList(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
export function normalizeEpiceriesProduct(
  raw: unknown, region: GroceryRegion, observedNow = new Date(),
): ProductPriceResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as ApiProduct & { prices?: unknown };
  const productId = getText(value.id), productName = getText(value.name);
  if (!productId || !productName) return null;
  const brand = getText(value.brand), packSize = getText(value.size);
  const allowed = new Set(availableProviderStores(region).map(s => s.id));
  const freshThreshold = observedNow.getTime() - 14 * 86400000;
  const prices: ObservedPrice[] = [];
  for (const item of asList(value.prices)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as ApiStorePrice;
    const storeId = getText(row.store).toLowerCase();
    const store = GROCERY_STORES.find(s => s.id === storeId && s.provider === 'epiceries-ca');
    const price = row.price;
    const when = getText(row.date);
    const observed = Date.parse(when);
    if (!allowed.has(storeId) || !store || typeof price !== 'number' || !Number.isFinite(price) ||
        price < 0 || price > 100000 || !Number.isFinite(observed) || observed < freshThreshold ||
        observed > observedNow.getTime() + 86400000) continue;
    const priceCents = Math.round(price*100);
    const size = getText(row.size) || packSize;
    const unit = readUnitPrice(priceCents,size);
    prices.push({
      source:'epiceries-ca', productId, productName, brand, packSize:size, storeId,
      storeName:store.name, priceCents, currency:'CAD', discounted:row.discounted === true,
      observedAt:when, ...(unit ? { unitPriceCents:unit.cents, unit:unit.unit } : {}),
    });
  }
  if (!prices.length) return null;
  return { productName,brand,packSize,prices:prices.sort((a,b)=>a.priceCents-b.priceCents),sourceName:'épiceries.ca',fetchedAt:observedNow.toISOString() };
}
export type FetchLike = (url: string, init?: RequestInit) => Promise<Pick<Response,'ok'|'json'>>;
function pickProduct(products: unknown[], query: string): ApiProduct | null {
  const term = normalizedName(query), matched = asList(products).filter(p => {
    if (!p || typeof p !== 'object') return false;
    const name = normalizedName(getText((p as ApiProduct).name));
    // Show only candidates with the searched name, never an unrelated product.
    // Match complete initial words, allowing French plurals.
    // `au lait` chocolate and `laitue` are NOT milk.
    const wanted=term.split(' '), actual=name.split(' ');
    return actual.length>=wanted.length && wanted.every((token,i)=>
      actual[i]===token || actual[i]===token+'s' ||
      (token.endsWith('s') && actual[i]===token.slice(0,-1)));
  }) as ApiProduct[];
  const ranked = matched.filter(p=>{
    const full=normalizedName(getText(p.name));
    // Variants are not interchangeable: generic milk is not chocolate milk,
    // plant milk or powdered milk; generic apple is not a potato.
    if (term.startsWith('lait') && !/chocolat|vanille|fraise|soja|soya|amande|avoine|coco|poudre/.test(term) &&
        /\b(chocolat|chocolate|vanille|fraise|soja|soya|amande|avoine|coco|poudre|condense|aromatise|chevre|brebis)\b/.test(full)) return false;
    return !(term==='pomme' && /^pommes? de terre(?: |$)/.test(full));
  }).sort((a,b)=>{
    const score=(p:ApiProduct) => normalizedName(getText(p.name))===term ? 2 : normalizedName(getText(p.name)).startsWith(term+' ') ? 1 : 0;
    return score(b)-score(a);
  });
  return ranked[0] || null;
}
/** At most three documented API GETs (two searches + detail). No scraping; caller throttles/caches. */
export async function fetchQuebecPrices(
  productName: string, region: GroceryRegion, fetcher: FetchLike = fetch, now = new Date(),
): Promise<ProductPriceResult | null> {
  if (!availableProviderStores(region).length) return null;
  const query = searchTerm(productName).slice(0,60);
  if (query.length < 2) return null;
  const base = 'https://epiceries.ca/api?endpoint=';
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),8000);
  try {
    // A generic term such as `lait` can return dozens of chocolates.
    // Search a clearly labelled common variant first; keep it a possible match,
    // not an assertion that the user requested 2% milk.
    const candidates = query === 'lait' ? ['lait 2%',query] : [query];
    let id = '';
    for (const term of candidates) {
      const searchRes = await fetcher(base + 'search&q=' + encodeURIComponent(term) + '&limit=50', { signal:controller.signal });
      if (!searchRes.ok) return null;
      const searchPayload = await searchRes.json() as ApiResponse;
      if (searchPayload.ok !== true || !searchPayload.data || typeof searchPayload.data !== 'object') return null;
      id = getText(pickProduct((searchPayload.data as { results?: unknown }).results as unknown[], term)?.id);
      if (/^[a-z0-9_-]{1,80}$/i.test(id)) break;
    }
    if (!/^[a-z0-9_-]{1,80}$/i.test(id)) return null;
    const detailRes = await fetcher(base + 'product&id=' + encodeURIComponent(id), { signal:controller.signal });
    if (!detailRes.ok) return null;
    const detailPayload = await detailRes.json() as ApiResponse;
    if (detailPayload.ok !== true) return null;
    return normalizeEpiceriesProduct(detailPayload.data,region,now);
  } finally { clearTimeout(timeout); }
}
const CACHE_KEY_PREFIX = 'basket-observed-qc-v1:';
const CACHE_TTL = 6*60*60*1000;
const pending = new Map<string, Promise<ProductPriceResult | null>>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;
async function throttle() {
  const elapsed = Date.now() - lastRequest;
  if (elapsed < 850) await new Promise(resolve => setTimeout(resolve,850-elapsed));
  lastRequest = Date.now();
}
function cacheKey(name:string,region:GroceryRegion):string {
  return CACHE_KEY_PREFIX + JSON.stringify([searchTerm(name),region.province,[...region.preferredStores].sort()]);
}
/** Cache isolated from household receipts. Only stores normalized price observations. */
export function getObservedPrices(name: string, region: GroceryRegion): Promise<ProductPriceResult | null> {
  if (!availableProviderStores(region).length) return Promise.resolve(null);
  const key=cacheKey(name,region);
  try {
    const entry=JSON.parse(localStorage.getItem(key)||'null');
    if (entry && typeof entry.at==='number' && Date.now()-entry.at<CACHE_TTL) return Promise.resolve(entry.value as ProductPriceResult|null);
  } catch { /* local storage unavailable */ }
  if (pending.has(key)) return pending.get(key)!;
  const promise=queue.then(async()=>{
    await throttle();
    const result=await fetchQuebecPrices(name,region);
    try { localStorage.setItem(key,JSON.stringify({at:Date.now(),value:result})); } catch {}
    return result;
  }).finally(()=>pending.delete(key));
  queue=promise.catch(()=>null);
  pending.set(key,promise);
  return promise;
}
