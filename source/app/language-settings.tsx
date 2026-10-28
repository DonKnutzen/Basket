'use client';
import {useEffect,useSyncExternalStore} from 'react';
import {getLanguage,initializeLanguage,setLanguage,subscribeLanguage,tr} from '../lib/i18n';
export function useLanguage(){const language=useSyncExternalStore(subscribeLanguage,getLanguage,()=> 'en' as const);useEffect(()=>{initializeLanguage();setLanguage(getLanguage())},[]);return language}
export default function LanguageSettings(){const language=useLanguage();return <fieldset className="text-size-settings language-settings"><legend>{tr('Language')}</legend><div className="text-size-options">{([['en','English'],['de','Deutsch']] as const).map(([value,label])=><button key={value} type="button" className="text-size-option" aria-pressed={language===value} onClick={()=>setLanguage(value)} lang={value}><b>{label}</b></button>)}</div><p>{tr('Choose your app language.')} {tr('Applies to all screens on this device.')}</p></fieldset>}
