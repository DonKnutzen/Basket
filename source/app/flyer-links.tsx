'use client';
import React, { useEffect, useState } from 'react';
import { tr } from '../lib/i18n';
import {
  cleanPostalCode, DEFAULT_OFFER_PREFERENCES, officialLinks,
  parseOfferPreferences, STORES, type Country, type OfferPreferences,
} from '../lib/offer-sources';

const PREFERENCES_KEY = 'basket-flyer-region-v1';
// Local preferences only: no GPS and no third-party requests.
export function useFlyerPreferences() {
  const [preferences, setPreferences] = useState<OfferPreferences>(DEFAULT_OFFER_PREFERENCES);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { setPreferences(parseOfferPreferences(localStorage.getItem(PREFERENCES_KEY))); } catch { /* private mode */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* private mode */ }
  }, [preferences, ready]);
  return [preferences, setPreferences] as const;
}

export function FlyerSettings({ preferences, update }: {
  preferences: OfferPreferences; update: React.Dispatch<React.SetStateAction<OfferPreferences>>;
}) {
  const [draft, setDraft] = useState(preferences.postalCode);
  const [message, setMessage] = useState('');
  useEffect(() => { setDraft(preferences.postalCode); setMessage(''); }, [preferences.postalCode, preferences.country]);
  const save = () => {
    if (!draft.trim()) { update(current => ({ ...current, postalCode: '' })); setMessage(''); return; }
    const normalized = cleanPostalCode(preferences.country, draft);
    if (!normalized) { setMessage(tr('Enter a valid postal code for the selected country.')); return; }
    update(current => ({ ...current, postalCode: normalized }));
    setDraft(normalized); setMessage('');
  };
  const regionStores = STORES.filter(s => s.country === preferences.country);
  return <details className="flyer-settings">
    <summary>{tr('Store flyers & region')} <span>{preferences.country}{preferences.postalCode ? ' · ' + preferences.postalCode : ''}</span></summary>
    <div className="flyer-settings-body">
      <p>{tr('Official flyer links only. Automatic offer prices are not connected yet.')}</p>
      <div className="flyer-fields">
        <label>{tr('Country')}
          <select value={preferences.country} onChange={e => update({ country: e.target.value as Country, postalCode: '', preferredStores: [] })}>
            <option value="CA">{tr('Canada')}</option><option value="DE">{tr('Germany')}</option>
          </select>
        </label>
        <form onSubmit={e => { e.preventDefault(); save(); }}>
          <label>{tr('Postal code')}<input value={draft} onChange={e => setDraft(e.target.value)} placeholder={preferences.country === 'CA' ? 'B3V 1A1' : '10115'} maxLength={9} autoComplete="postal-code" /></label>
          <button type="submit">{tr('Save')}</button>
        </form>
      </div>
      {message && <p role="alert" className="flyer-error">{message}</p>}
      <p className="flyer-disclaimer">{tr('The postal code is saved on this device. Select your local store on each retailer website; Basket does not yet check regional offers.')}</p>
      <div className="flyer-favourites"><span>{tr('Preferred stores (none selected = all)')}</span><div>
        {regionStores.map(s => <button type="button" key={s.id} aria-pressed={preferences.preferredStores.includes(s.id)}
          className={preferences.preferredStores.includes(s.id) ? 'selected' : ''}
          onClick={() => update(current => ({
            ...current, preferredStores: current.preferredStores.includes(s.id)
              ? current.preferredStores.filter(id => id !== s.id)
              : [...current.preferredStores, s.id],
          }))}>{s.name}</button>)}
      </div></div>
    </div>
  </details>;
}

export function FlyerLinksForItem({ name, preferences }: { name: string; preferences: OfferPreferences }) {
  const [opened, setOpened] = useState(false);
  const stores = officialLinks(preferences);
  return <div className="tile-flyers">
    <button type="button" onClick={() => setOpened(value => !value)} aria-expanded={opened} aria-label={tr('Check official store flyers for ') + name}>
      {tr('View store flyers')}
    </button>
    {opened && <div className="tile-flyers-expanded">
      <p>{tr('No verified live offers available. These links are not product matches.')}</p>
      <nav aria-label={tr('Official store flyers')}>
        {stores.map(s => <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer">{s.name} ↗</a>)}
      </nav>
    </div>}
  </div>;
}
