'use client';
import {tr,phrase,locale} from '../../lib/i18n';
import { appPath } from '../../lib/hosting';
import { useEffect, useState } from 'react';
import { ShoppingBasket, LoaderCircle, ArrowRight, Mail } from 'lucide-react';
import { browserAuth, readBrowserSession, setIdentityPreference } from '../../lib/supabase-browser';
import {useLanguage} from '../language-settings';
import AuthScreen from '../auth-screen';
export default function AuthComplete() { useLanguage(); const [state, setState] = useState('loading'), [error, setError] = useState(''); useEffect(() => { let live = true; const { data } = browserAuth().auth.onAuthStateChange(event => { if (live && event === 'PASSWORD_RECOVERY')
    setState('password'); }); readBrowserSession().then(session => { if (!live)return; if (session) {
    setIdentityPreference('email');
    setState(previous => previous === 'password' ? 'password' : 'complete');
}
else
    setState('signin'); }).catch(()=>{if(live){setError('Checking your session took too long. Please try again.');setState('signin')}}); return () => { live = false; data.subscription.unsubscribe(); }; }, []); if (state === 'password' || state === 'signin')
    return <><AuthScreen initialMode={state === 'password' ? 'password' : 'signin'} success={() => { window.location.href = appPath(); }}/>{error && <div className="toast" role="status"><Mail size={16}/>{tr(error)}</div>}</>; return <div className="loading"><ShoppingBasket size={43}/><h1>{tr("basket")}<span>{tr(".")}</span></h1>{state === 'loading' ? <><LoaderCircle className="spin" size={20}/><p>{tr("Finishing your sign-in\u2026")}</p></> : <><h2>{tr("You\u2019re all set.")}</h2><p>{tr("Your email is confirmed.")}</p><a className="primary" href={appPath()}>{tr("Open your household ")}<ArrowRight size={16}/></a></>}</div>; }
