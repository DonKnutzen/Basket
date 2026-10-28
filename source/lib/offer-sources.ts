/**
 * Offer-source boundary. Merchant links are not permission to fetch, cache or republish prices.
 * Until a written/public licence covers Basket's planned use, APPROVED_FEEDS remains empty.
 * These objects never enter receipt price history.
 */
export type Country = 'CA' | 'DE';
export type StoreLink = { id: string; name: string; country: Country; url: string; status: 'link-only' };
export const STORES: readonly StoreLink[] = [
  { id: 'sobeys', name: 'Sobeys', country: 'CA', url: 'https://www.sobeys.com/flyer', status: 'link-only' },
  { id: 'no-frills', name: 'No Frills', country: 'CA', url: 'https://www.nofrills.ca/', status: 'link-only' },
  { id: 'atlantic-superstore', name: 'Atlantic Superstore', country: 'CA', url: 'https://www.atlanticsuperstore.ca/', status: 'link-only' },
  { id: 'walmart-ca', name: 'Walmart Canada', country: 'CA', url: 'https://www.walmart.ca/en/shop/weekly-flyer-features/6000196190101', status: 'link-only' },
  { id: 'giant-tiger', name: 'Giant Tiger', country: 'CA', url: 'https://www.gianttiger.com/collections/flyers-and-deals', status: 'link-only' },
  { id: 'rewe', name: 'REWE', country: 'DE', url: 'https://www.rewe.de/angebote/nationale-angebote/', status: 'link-only' },
  { id: 'lidl', name: 'Lidl', country: 'DE', url: 'https://www.lidl.de/c/online-prospekte/s10005610', status: 'link-only' },
  { id: 'aldi-nord', name: 'ALDI Nord', country: 'DE', url: 'https://www.aldi-nord.de/angebote.html', status: 'link-only' },
  { id: 'aldi-sued', name: 'ALDI Süd', country: 'DE', url: 'https://www.aldi-sued.de/angebote', status: 'link-only' },
  { id: 'penny', name: 'PENNY', country: 'DE', url: 'https://www.penny.de/angebote', status: 'link-only' },
];
export type OfferPreferences = { country: Country; postalCode: string; preferredStores: string[] };
export const DEFAULT_OFFER_PREFERENCES: OfferPreferences = { country: 'CA', postalCode: '', preferredStores: [] };
export function cleanPostalCode(country: Country, input: string): string {
  const code = input.toUpperCase().replace(/\s+/g, '');
  if (country === 'DE') return /^\d{5}$/.test(code) ? code : '';
  return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(code)
    ? code.slice(0, 3) + ' ' + code.slice(3) : '';
}
export function officialLinks(preferences: OfferPreferences): StoreLink[] {
  const all = STORES.filter(source => source.country === preferences.country);
  return preferences.preferredStores.length
    ? all.filter(source => preferences.preferredStores.includes(source.id)) : all;
}
export function parseOfferPreferences(raw: string | null): OfferPreferences {
  if (!raw) return DEFAULT_OFFER_PREFERENCES;
  try {
    const value = JSON.parse(raw) as Partial<OfferPreferences>;
    const country: Country = value.country === 'DE' ? 'DE' : 'CA';
    const postalCode = cleanPostalCode(country, String(value.postalCode || ''));
    const allowed = new Set(STORES.filter(s => s.country === country).map(s => s.id));
    const preferredStores = Array.isArray(value.preferredStores)
      ? [...new Set(value.preferredStores.filter((id): id is string => typeof id === 'string' && allowed.has(id)))] : [];
    return { country, postalCode, preferredStores };
  } catch { return DEFAULT_OFFER_PREFERENCES; }
}
export function normalizeOfferName(name: string): string {
  return name.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
const SYNONYMS: Readonly<Record<string, string>> = {
  tomato: 'tomato', tomatoes: 'tomato', tomate: 'tomato', tomaten: 'tomato',
  apple: 'apple', apples: 'apple', apfel: 'apple', apfeln: 'apple', aepfel: 'apple',
  banana: 'banana', bananas: 'banana', banane: 'banana', bananen: 'banana',
  milk: 'milk', milch: 'milk', egg: 'egg', eggs: 'egg', ei: 'egg', eier: 'egg',
};
function canonical(name: string): string { const key = normalizeOfferName(name); return SYNONYMS[key] || key; }
export type OfferQuantity = { amount: number; unit: 'g' | 'kg' | 'ml' | 'L' | 'piece' };
export type LicensedOffer = {
  sourceId: string; country: Country; title: string; brand?: string; variant?: string;
  priceCents: number; currency: 'CAD' | 'EUR'; quantity: OfferQuantity;
  validFrom: string; validUntil: string; lastChecked: string; originalUrl: string;
  nationwide?: boolean; postalCodes?: string[]; membershipRequired?: string;
};
export type OfferMatch = { offer: LicensedOffer; confidence: number; unitPriceCents: number; unit: 'kg' | 'L' | 'piece' };
// Only sources explicitly licensed for ingestion and redistribution belong in this allowlist.
export const APPROVED_FEEDS: ReadonlySet<string> = new Set<string>();
export function unitPrice(offer: Pick<LicensedOffer, 'priceCents' | 'quantity'>) {
  const { amount, unit } = offer.quantity;
  if (!Number.isSafeInteger(offer.priceCents) || offer.priceCents < 0 || !Number.isFinite(amount) || amount <= 0) return null;
  const factor = unit === 'g' || unit === 'ml' ? 1000 : 1;
  const basis = unit === 'g' || unit === 'kg' ? 'kg' : unit === 'ml' || unit === 'L' ? 'L' : 'piece';
  return { unit: basis as 'kg' | 'L' | 'piece', cents: Math.round(offer.priceCents * factor / amount) };
}
export function matchLicensedOffers(
  name: string, pack: OfferQuantity | null, brand: string | undefined, preferences: OfferPreferences,
  offers: readonly LicensedOffer[], today: string,
  approvedSourceIds: ReadonlySet<string> = APPROVED_FEEDS, requestedVariant?: string,
): OfferMatch[] {
  const matching: OfferMatch[] = [];
  for (const offer of offers) {
    if (!approvedSourceIds.has(offer.sourceId) || offer.country !== preferences.country) continue;
    if (offer.currency !== (preferences.country === 'CA' ? 'CAD' : 'EUR')) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(offer.validFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(offer.validUntil) ||
        today < offer.validFrom || today > offer.validUntil) continue;
    if (!offer.nationwide && (!preferences.postalCode || !offer.postalCodes?.includes(preferences.postalCode))) continue;
    if (canonical(name) !== canonical(offer.title)) continue;
    if (brand && normalizeOfferName(brand) !== normalizeOfferName(offer.brand || '')) continue;
    if (offer.variant && (!requestedVariant || normalizeOfferName(requestedVariant) !== normalizeOfferName(offer.variant))) continue;
    const unit = unitPrice(offer);
    if (!unit || !/^https:\/\//.test(offer.originalUrl)) continue;
    if (pack) {
      const requested = unitPrice({ priceCents: 100, quantity: pack });
      if (!requested || requested.unit !== unit.unit) continue;
      const size = (q: OfferQuantity) => q.amount * (q.unit === 'g' || q.unit === 'ml' ? 0.001 : 1);
      if (Math.abs(size(pack) - size(offer.quantity)) > 0.000001) continue;
    }
    matching.push({ offer, unitPriceCents: unit.cents, unit: unit.unit, confidence: brand && offer.brand ? 1 : 0.9 });
  }
  return matching.sort((a, b) => a.unitPriceCents - b.unitPriceCents);
}
