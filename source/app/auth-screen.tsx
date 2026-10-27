'use client';
import React,{useEffect,useState} from 'react';
import {ShoppingBasket,Mail,ArrowRight,ArrowLeft,LoaderCircle,CheckCircle2,ShieldCheck,Eye,EyeOff,KeyRound} from 'lucide-react';
import {browserAuth,setIdentityPreference} from '../lib/supabase-browser';
import {PAGES_BUILD,appPath,apiUrl,confirmationUrl} from '../lib/hosting';
import {Scene} from './art';
type Mode='signin'|'signup'|'reset'|'password';
function friendly(error:any){
 const code=error?.code||'',message=error?.message||'';
 if(code==='email_not_confirmed')return 'Please confirm your email before signing in. You can resend the confirmation below.';
 if(code==='invalid_credentials')return 'The email or password is incorrect. Please try again.';
 if(code==='over_email_send_rate_limit'||code==='over_request_rate_limit'||/rate limit|too many/i.test(message))return 'Too many attempts. Please wait a little before trying again.';
 if(/email address not authorized|email_address_not_authorized/i.test(message+code))return 'Confirmation emails are not enabled for this address yet. The app owner needs to configure email delivery.';
 if(/smtp|email.*send|send.*email/i.test(message))return 'Your email could not be sent. Please try later; email delivery may need to be configured by the app owner.';
 if(/fetch|network/i.test(message))return 'Could not connect. Check your internet connection and try again.';
 if(code==='weak_password')return 'Choose a stronger password with at least 6 characters.';
 return message||'Something went wrong. Please try again.';
}
export default function AuthScreen({success,demo,chatgpt,back,initialMode='signin'}:{success:()=>void;demo?:()=>void;chatgpt?:()=>void;back?:()=>void;initialMode?:Mode}){
 const [mode,setMode]=useState<Mode>(initialMode),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[repeat,setRepeat]=useState(''),[name,setName]=useState(''),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[confirmation,setConfirmation]=useState(false),[cooldown,setCooldown]=useState(0),[config,setConfig]=useState<{available:boolean;signupEnabled:boolean;emailConfirmationRequired:boolean}|null>(null);
 useEffect(()=>{let live=true;fetch(apiUrl('/api/account-config'),{cache:'no-store'}).then(r=>r.json()).then(d=>{if(live)setConfig(d as any)}).catch(()=>{if(live)setConfig({available:false,signupEnabled:false,emailConfirmationRequired:false})});return()=>{live=false}},[]);
 useEffect(()=>{if(!cooldown)return;const t=setTimeout(()=>setCooldown(c=>Math.max(0,c-1)),1000);return()=>clearTimeout(t)},[cooldown]);
 useEffect(()=>{const {data}=browserAuth().auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY'){setMode('password');setMessage('Choose a new password for your account.')}});return()=>data.subscription.unsubscribe()},[]);
 const change=(m:Mode)=>{setMode(m);setError('');setMessage('');setConfirmation(false);setPassword('');setRepeat('')};
 const redirect=confirmationUrl;
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(busy)return;setError('');setMessage('');setBusy(true);try{
  const auth=browserAuth().auth;
  if(mode==='signup'){
   if(!config?.available||!config.signupEnabled||!config.emailConfirmationRequired)throw Error('Registration with email confirmation is not ready yet. Please try again later.');
   if(password!==repeat)throw Error('Your passwords do not match.');
   const {data,error}=await auth.signUp({email:email.trim(),password,options:{data:{display_name:name.trim()},emailRedirectTo:redirect()}});if(error)throw error;
   if(data.session){await auth.signOut({scope:'local'});throw Error('Email verification is not configured correctly. Please contact the app owner.')}
   setConfirmation(true);setMessage('If this address can be registered, a confirmation email is on its way. Open its link, then return here to sign in. Already registered? Use Sign in.');setCooldown(60);setPassword('');setRepeat('');
  }else if(mode==='signin'){
   const {data,error}=await auth.signInWithPassword({email:email.trim(),password});if(error)throw error;
   if(!data.user?.email_confirmed_at){await auth.signOut({scope:'local'});throw Error('Please confirm your email before signing in.')}
   setIdentityPreference('email');success();
  }else if(mode==='reset'){
   const {error}=await auth.resetPasswordForEmail(email.trim(),{redirectTo:redirect()});if(error)throw error;setMessage('If an account exists for this email, a password reset link is on its way.');setCooldown(60);
  }else{
   if(password!==repeat)throw Error('Your passwords do not match.');const {error}=await auth.updateUser({password});if(error)throw error;setIdentityPreference('email');success();
  }
 }catch(e){setError(friendly(e))}finally{setBusy(false)}};
 const resend=async()=>{if(busy||cooldown||!email.trim())return;setBusy(true);setError('');try{const {error}=await browserAuth().auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:redirect()}});if(error)throw error;setMessage('If this account is awaiting confirmation, a fresh email is on its way.');setCooldown(60)}catch(e){setError(friendly(e))}finally{setBusy(false)}};
 const recovery=mode==='reset'||mode==='password';
 return <main className="auth-page"><section className="auth-story"><a className="brand" href={appPath()}><span><ShoppingBasket size={26}/></span>basket<b>.</b></a><div><p className="eyebrow">A LITTLE MORE TOGETHER</p><h1>One home.<br/>One shared basket<span>.</span></h1><p>Make your list. Share the shopping.<br/>See where your everyday spending goes.</p><div className="auth-scene"><Scene/></div><div className="auth-promise"><ShieldCheck size={18}/><p>Your shopping stays in your household.<br/>You choose who joins.</p></div></div><small>Made for the everyday.</small></section><section className="auth-panel">{back&&<button className="text-link auth-back" onClick={back}><ArrowLeft size={14}/>Back to Basket</button>}<div className="auth-mobile-brand"><ShoppingBasket size={26}/><b>basket<span>.</span></b></div><div className="auth-form-wrap"><p className="eyebrow">YOUR HOUSEHOLD STARTS HERE</p><h2>{confirmation?'Check your inbox.':mode==='signup'?'A good shop starts together.':mode==='reset'?'Let’s get you back in.':mode==='password'?'A fresh password.':'Welcome back.'}</h2><p className="auth-subtitle">{confirmation?'Confirm your email to finish creating your account.':mode==='signup'?'Create an account, then invite your partner.':mode==='reset'?'We’ll send you a link to reset your password.':mode==='password'?'Use at least 6 characters.':'Your lists, receipts and budgets are right here.'}</p>{!recovery&&!confirmation&&<div className="auth-tabs"><button className={mode==='signin'?'active':''} onClick={()=>change('signin')}>Sign in</button><button className={mode==='signup'?'active':''} onClick={()=>change('signup')}>Create account</button></div>}
 {confirmation?<div className="confirmation-card"><span><Mail size={31} strokeWidth={1.4}/></span><b>{email}</b><p>Follow the confirmation link in your email, then return to Basket and sign in.</p>{message&&<p role="status">{message}</p>}<button className="primary" onClick={()=>change('signin')}>I’ve confirmed — sign in <ArrowRight size={16}/></button><button className="text-link" disabled={busy||cooldown>0} onClick={resend}>{cooldown?`Resend available in ${cooldown}s`:'Resend confirmation email'}</button></div>:<form className="auth-form" onSubmit={submit}>
 {mode==='signup'&&<label>Your name<input value={name} maxLength={60} onChange={e=>setName(e.target.value)} placeholder="e.g. Alex" autoComplete="given-name" required/></label>}
 {mode!=='password'&&<label>Email address<input type="email" value={email} maxLength={254} onChange={e=>setEmail(e.target.value)} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required placeholder="you@example.com"/></label>}
 {mode!=='reset'&&<label>Password<span className="password-input"><input value={password} type={visible?'text':'password'} minLength={mode==='signin'?1:6} maxLength={128} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='signin'?'current-password':'new-password'} required placeholder={mode==='signin'?'Your password':'At least 6 characters'}/><button type="button" aria-label={visible?'Hide password':'Show password'} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>}
 {(mode==='signup'||mode==='password')&&<label>Confirm password<input value={repeat} type={visible?'text':'password'} minLength={6} maxLength={128} onChange={e=>setRepeat(e.target.value)} autoComplete="new-password" required placeholder="Enter your password again"/></label>}
 {mode==='signin'&&<div className="auth-help-links"><button type="button" className="text-link" onClick={()=>change('reset')}>Forgot password?</button><button type="button" className="text-link" disabled={!email.trim()||busy||cooldown>0} onClick={resend}>Resend confirmation</button></div>}
 {mode==='signup'&&<p className="auth-confirm-note"><Mail size={14}/>Confirm your email before your first sign-in.</p>}
 {mode==='signup'&&config&&(!config.available||!config.signupEnabled||!config.emailConfirmationRequired)&&<p className="form-error" role="alert">Registration with email confirmation is temporarily unavailable.</p>}
 {message&&<p className="auth-success" role="status"><CheckCircle2 size={17}/>{message}</p>}
 {error&&<p className="form-error" role="alert">{error}</p>}
 <button className="primary auth-submit" disabled={busy||mode==='signup'&&(!config?.available||!config.signupEnabled||!config.emailConfirmationRequired)||mode==='reset'&&cooldown>0}>{busy?<LoaderCircle className="spin" size={17}/>:mode==='reset'?<Mail size={17}/>:mode==='password'?<KeyRound size={17}/>:<ArrowRight size={17}/>} {busy?'One moment…':mode==='signup'?'Create account':mode==='reset'?'Send reset link':mode==='password'?'Save new password':'Sign in'}</button>
 {recovery&&<button type="button" className="text-link" onClick={()=>change('signin')}><ArrowLeft size={14}/>Back to sign in</button>}
 </form>}
 {confirmation&&error&&<p className="form-error" role="alert">{error}</p>}
 {!recovery&&<div className="auth-alternatives">{demo&&<button className="text-link" onClick={demo}>Explore a sample household <ArrowRight size={14}/></button>}{chatgpt&&!PAGES_BUILD&&<button className="text-link legacy-signin" onClick={chatgpt}>Use my previous ChatGPT sign-in</button>}</div>}
 <p className="auth-footnote">You and your partner each use your own account.<br/>An invitation brings your lists and budgets together.</p>
 </div></section></main>
}
