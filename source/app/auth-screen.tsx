'use client';
import {tr,phrase,locale} from '../lib/i18n';
import React, { useEffect, useState } from 'react';
import { ShoppingBasket, Mail, ArrowRight, ArrowLeft, LoaderCircle, CheckCircle2, ShieldCheck, Eye, EyeOff, KeyRound } from 'lucide-react';
import { browserAuth, setIdentityPreference } from '../lib/supabase-browser';
import { PAGES_BUILD, appPath, apiUrl, confirmationUrl } from '../lib/hosting';
import { Scene } from './art';
type Mode = 'signin' | 'signup' | 'reset' | 'password';
function friendly(error: any) {
    const code = error?.code || '', message = error?.message || '';
    if (code === 'email_not_confirmed')
        return 'Please confirm your email before signing in. You can resend the confirmation below.';
    if (code === 'invalid_credentials')
        return 'The email or password is incorrect. Please try again.';
    if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit|too many/i.test(message))
        return 'Too many attempts. Please wait a little before trying again.';
    if (/email address not authorized|email_address_not_authorized/i.test(message + code))
        return 'Confirmation emails are not enabled for this address yet. The app owner needs to configure email delivery.';
    if (/smtp|email.*send|send.*email/i.test(message))
        return 'Your email could not be sent. Please try later; email delivery may need to be configured by the app owner.';
    if (/fetch|network/i.test(message))
        return 'Could not connect. Check your internet connection and try again.';
    if (code === 'weak_password')
        return 'Choose a stronger password with at least 6 characters.';
    return message || 'Something went wrong. Please try again.';
}
export default function AuthScreen({ success, demo, chatgpt, back, initialMode = 'signin' }: {
    success: () => void;
    demo?: () => void;
    chatgpt?: () => void;
    back?: () => void;
    initialMode?: Mode;
}) {
    const [mode, setMode] = useState<Mode>(initialMode), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [repeat, setRepeat] = useState(''), [name, setName] = useState(''), [visible, setVisible] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [confirmation, setConfirmation] = useState(false), [cooldown, setCooldown] = useState(0), [config, setConfig] = useState<{
        available: boolean;
        signupEnabled: boolean;
        emailConfirmationRequired: boolean;
    } | null>(null);
    useEffect(() => { let live = true; fetch(apiUrl('/api/account-config'), { cache: 'no-store' }).then(r => r.json()).then(d => { if (live)
        setConfig(d as any); }).catch(() => { if (live)
        setConfig({ available: false, signupEnabled: false, emailConfirmationRequired: false }); }); return () => { live = false; }; }, []);
    useEffect(() => { if (!cooldown)
        return; const t = setTimeout(() => setCooldown(c => Math.max(0, c - 1)), 1000); return () => clearTimeout(t); }, [cooldown]);
    useEffect(() => { const { data } = browserAuth().auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') {
        setMode('password');
        setMessage('Choose a new password for your account.');
    } }); return () => data.subscription.unsubscribe(); }, []);
    const change = (m: Mode) => { setMode(m); setError(''); setMessage(''); setConfirmation(false); setPassword(''); setRepeat(''); };
    const redirect = confirmationUrl;
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy)
            return;
        setError('');
        setMessage('');
        setBusy(true);
        try {
            const auth = browserAuth().auth;
            if (mode === 'signup') {
                if (!config?.available || !config.signupEnabled || !config.emailConfirmationRequired)
                    throw Error('Registration with email confirmation is not ready yet. Please try again later.');
                if (password !== repeat)
                    throw Error('Your passwords do not match.');
                const { data, error } = await auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() }, emailRedirectTo: redirect() } });
                if (error)
                    throw error;
                if (data.session) {
                    await auth.signOut({ scope: 'local' });
                    throw Error('Email verification is not configured correctly. Please contact the app owner.');
                }
                setConfirmation(true);
                setMessage('If this address can be registered, a confirmation email is on its way. Open its link, then return here to sign in. Already registered? Use Sign in.');
                setCooldown(60);
                setPassword('');
                setRepeat('');
            }
            else if (mode === 'signin') {
                const { data, error } = await auth.signInWithPassword({ email: email.trim(), password });
                if (error)
                    throw error;
                if (!data.user?.email_confirmed_at) {
                    await auth.signOut({ scope: 'local' });
                    throw Error('Please confirm your email before signing in.');
                }
                setIdentityPreference('email');
                success();
            }
            else if (mode === 'reset') {
                const { error } = await auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect() });
                if (error)
                    throw error;
                setMessage('If an account exists for this email, a password reset link is on its way.');
                setCooldown(60);
            }
            else {
                if (password !== repeat)
                    throw Error('Your passwords do not match.');
                const { error } = await auth.updateUser({ password });
                if (error)
                    throw error;
                setIdentityPreference('email');
                success();
            }
        }
        catch (e) {
            setError(friendly(e));
        }
        finally {
            setBusy(false);
        }
    };
    const resend = async () => { if (busy || cooldown || !email.trim())
        return; setBusy(true); setError(''); try {
        const { error } = await browserAuth().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirect() } });
        if (error)
            throw error;
        setMessage('If this account is awaiting confirmation, a fresh email is on its way.');
        setCooldown(60);
    }
    catch (e) {
        setError(friendly(e));
    }
    finally {
        setBusy(false);
    } };
    const recovery = mode === 'reset' || mode === 'password';
    return <main className="auth-page"><section className="auth-story"><a className="brand" href={appPath()}><span><ShoppingBasket size={26}/></span>{tr("basket")}<b>{tr(".")}</b></a><div><p className="eyebrow">{tr("A LITTLE MORE TOGETHER")}</p><h1>{tr("One home.")}<br />{tr("One shared basket")}<span>{tr(".")}</span></h1><p>{tr("Make your list. Share the shopping.")}<br />{tr("See where your everyday spending goes.")}</p><div className="auth-scene"><Scene /></div><div className="auth-promise"><ShieldCheck size={18}/><p>{tr("Your shopping stays in your household.")}<br />{tr("You choose who joins.")}</p></div></div><small>{tr("Made for the everyday.")}</small></section><section className="auth-panel">{back && <button className="text-link auth-back" onClick={back}><ArrowLeft size={14}/>{tr("Back to Basket")}</button>}<div className="auth-mobile-brand"><ShoppingBasket size={26}/><b>{tr("basket")}<span>{tr(".")}</span></b></div><div className="auth-form-wrap"><p className="eyebrow">{tr("YOUR HOUSEHOLD STARTS HERE")}</p><h2>{confirmation ? tr("Check your inbox.") : mode === 'signup' ? tr("A good shop starts together.") : mode === 'reset' ? tr("Let\u2019s get you back in.") : mode === 'password' ? tr("A fresh password.") : tr("Welcome back.")}</h2><p className="auth-subtitle">{confirmation ? tr("Confirm your email to finish creating your account.") : mode === 'signup' ? tr("Create an account, then invite your partner.") : mode === 'reset' ? tr("We\u2019ll send you a link to reset your password.") : mode === 'password' ? tr("Use at least 6 characters.") : tr("Your lists, receipts and budgets are right here.")}</p>{!recovery && !confirmation && <div className="auth-tabs"><button className={mode === 'signin' ? 'active' : ''} onClick={() => change('signin')}>{tr("Sign in")}</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => change('signup')}>{tr("Create account")}</button></div>}
 {confirmation ? <div className="confirmation-card"><span><Mail size={31} strokeWidth={1.4}/></span><b>{email}</b><p>{tr("Follow the confirmation link in your email, then return to Basket and sign in.")}</p>{message && <p role="status">{tr(message)}</p>}<button className="primary" onClick={() => change('signin')}>{tr("I\u2019ve confirmed \u2014 sign in ")}<ArrowRight size={16}/></button><button className="text-link" disabled={busy || cooldown > 0} onClick={resend}>{cooldown ? phrase("Resend available in {0}s", cooldown) : tr("Resend confirmation email")}</button></div> : <form className="auth-form" onSubmit={submit}>
 {mode === 'signup' && <label>{tr("Your name")}<input value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder={tr("e.g. Alex")} autoComplete="given-name" required/></label>}
 {mode !== 'password' && <label>{tr("Email address")}<input type="email" value={email} maxLength={254} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required placeholder={tr("you@example.com")}/></label>}
 {mode !== 'reset' && <label>{tr("Password")}<span className="password-input"><input value={password} type={visible ? 'text' : 'password'} minLength={mode === 'signin' ? 1 : 6} maxLength={128} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required placeholder={mode === 'signin' ? tr("Your password") : tr("At least 6 characters")}/><button type="button" aria-label={visible ? tr("Hide password") : tr("Show password")} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span></label>}
 {(mode === 'signup' || mode === 'password') && <label>{tr("Confirm password")}<input value={repeat} type={visible ? 'text' : 'password'} minLength={6} maxLength={128} onChange={e => setRepeat(e.target.value)} autoComplete="new-password" required placeholder={tr("Enter your password again")}/></label>}
 {mode === 'signin' && <div className="auth-help-links"><button type="button" className="text-link" onClick={() => change('reset')}>{tr("Forgot password?")}</button><button type="button" className="text-link" disabled={!email.trim() || busy || cooldown > 0} onClick={resend}>{tr("Resend confirmation")}</button></div>}
 {mode === 'signup' && <p className="auth-confirm-note"><Mail size={14}/>{tr("Confirm your email before your first sign-in.")}</p>}
 {mode === 'signup' && config && (!config.available || !config.signupEnabled || !config.emailConfirmationRequired) && <p className="form-error" role="alert">{tr("Registration with email confirmation is temporarily unavailable.")}</p>}
 {message && <p className="auth-success" role="status"><CheckCircle2 size={17}/>{tr(message)}</p>}
 {error && <p className="form-error" role="alert">{tr(error)}</p>}
 <button className="primary auth-submit" disabled={busy || mode === 'signup' && (!config?.available || !config.signupEnabled || !config.emailConfirmationRequired) || mode === 'reset' && cooldown > 0}>{busy ? <LoaderCircle className="spin" size={17}/> : mode === 'reset' ? <Mail size={17}/> : mode === 'password' ? <KeyRound size={17}/> : <ArrowRight size={17}/>} {busy ? tr("One moment\u2026") : mode === 'signup' ? tr("Create account") : mode === 'reset' ? tr("Send reset link") : mode === 'password' ? tr("Save new password") : tr("Sign in")}</button>
 {recovery && <button type="button" className="text-link" onClick={() => change('signin')}><ArrowLeft size={14}/>{tr("Back to sign in")}</button>}
 </form>}
 {confirmation && error && <p className="form-error" role="alert">{tr(error)}</p>}
 {!recovery && <div className="auth-alternatives">{demo && <button className="text-link" onClick={demo}>{tr("Explore a sample household ")}<ArrowRight size={14}/></button>}{chatgpt && !PAGES_BUILD && <button className="text-link legacy-signin" onClick={chatgpt}>{tr("Use my previous ChatGPT sign-in")}</button>}</div>}
 <p className="auth-footnote">{tr("You and your partner each use your own account.")}<br />{tr("An invitation brings your lists and budgets together.")}</p>
 </div></section></main>;
}
