import React, {useCallback, useEffect, useState} from 'react';
import {Users, UserPlus, Check, X, House, Trash2, LoaderCircle, CircleAlert, ChefHat, Mail} from 'lucide-react';
import {Modal} from './basket-app';
import {tr, phrase} from '../lib/i18n';
import type {BasketData} from '../lib/types';
import {socialState, listFriends, listInbox, requestFriend, respondFriend, removeFriend, sendInbox, deleteInbox, type Friend, type InboxItem, type SocialState} from '../lib/social';

type Act = (a: string, b?: any, m?: string) => Promise<any>;

/** Shown instead of an error while the account features are unavailable on this device. */
export function SocialNotice({ state, demo }: { state: SocialState | null; demo?: boolean }) {
    if (demo) return <p className="hint">{tr("Sign in to add friends and share recipes.")}</p>;
    if (!state || state.mode === 'account') return null;
    const text = state.reason === 'signin' ? 'Sign in with your e-mail to add friends and share recipes.' : state.reason === 'missing' ? 'Friends and shared recipes are not set up on the server yet. The database update still needs to be installed.' : (state.message || 'Friends cannot be loaded right now.');
    return <div className="notice"><CircleAlert size={18}/><p>{tr(text)}</p></div>;
}

export function FriendsButton({ data, demo, act, openHousehold }: { data: BasketData; demo: boolean; act: Act; openHousehold: () => void }) {
    const [open, setOpen] = useState(false), [state, setState] = useState<SocialState | null>(null), [friends, setFriends] = useState<Friend[]>([]), [inbox, setInbox] = useState<InboxItem[]>([]);
    const load = useCallback(async () => { if (demo) return; const s = await socialState(); setState(s); if (s.mode !== 'account') return; try { const [f, i] = await Promise.all([listFriends(), listInbox()]); setFriends(f); setInbox(i); } catch (e: any) { setState({ mode: 'local', reason: e?.missing ? 'missing' : 'error', message: e?.message }); } }, [demo]);
    useEffect(() => { load(); }, [load]);
    const waiting = friends.filter(f => f.incoming && f.status === 'pending').length + inbox.filter(i => !i.readAt && i.kind !== 'recipe').length;
    return <><button className="secondary invite-button" onClick={() => { setOpen(true); load(); }}><Users size={17}/>{tr("Friends")}{waiting > 0 && <small className="friends-badge">{waiting}</small>}</button>
        {open && <FriendsDialog data={data} demo={demo} act={act} state={state} friends={friends} inbox={inbox} reload={load} openHousehold={() => { setOpen(false); openHousehold(); }} close={() => setOpen(false)}/>}</>;
}

function FriendsDialog({ data, demo, act, state, friends, inbox, reload, openHousehold, close }: { data: BasketData; demo: boolean; act: Act; state: SocialState | null; friends: Friend[]; inbox: InboxItem[]; reload: () => Promise<void>; openHousehold: () => void; close: () => void }) {
    const [email, setEmail] = useState(''), [busy, setBusy] = useState(''), [message, setMessage] = useState('');
    const ready = !demo && state?.mode === 'account', owner = data.household.ownerId === data.user.id;
    const run = async (key: string, task: () => Promise<unknown>, done = '') => { setBusy(key); setMessage(''); try { await task(); if (done) setMessage(done); await reload(); } catch (e: any) { setMessage(e?.message || 'Something went wrong.'); } finally { setBusy(''); } };
    const incoming = friends.filter(f => f.incoming && f.status === 'pending'), accepted = friends.filter(f => f.status === 'accepted'), outgoing = friends.filter(f => !f.incoming && f.status === 'pending');
    const inviteHome = (f: Friend) => run('home' + f.id, async () => { const r = await act('invite'); if (!r?.code) throw new Error('The invitation could not be created.'); await sendInbox(f.userId!, 'household_invite', { code: r.code, household: data.household.name }, data.user.name); }, phrase('Invitation sent to {0}', f.name || f.email));
    const join = (item: InboxItem) => run('join' + item.id, async () => { const r = await act('join', { code: item.payload?.code }, 'You joined the household'); if (!r) throw new Error('Invitation expired or replaced. Ask for a new one.'); await deleteInbox(item.id); });
    const notes = inbox.filter(i => i.kind !== 'recipe'), recipes = inbox.filter(i => i.kind === 'recipe').length;
    return <Modal title={tr("Friends")} subtitle="Share recipes and invite friends to your household." close={close} wide>
        <div className="dialog-form friends">
            <SocialNotice state={state} demo={demo}/>
            {message && <p className="hint">{tr(message)}</p>}
            {ready && <>
                <form className="input-button" onSubmit={e => { e.preventDefault(); run('add', async () => { await requestFriend(email, data.user.name); setEmail(''); }, 'Friend request sent'); }}><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={tr("Friend's e-mail address")} aria-label={tr("Friend's e-mail address")} required maxLength={320}/><button className="primary" disabled={!!busy || !email.trim()}>{busy === 'add' ? <LoaderCircle size={16} className="spin"/> : <UserPlus size={16}/>}{tr("Add friend")}</button></form>
                {incoming.length > 0 && <section><h3>{tr("Friend requests")}</h3>{incoming.map(f => <div className="friend-row" key={f.id}><span><b>{f.name || f.email}</b><small>{f.email}</small></span><button className="secondary" disabled={!!busy} onClick={() => run('no' + f.id, () => respondFriend(f.id, false, data.user.name))}><X size={15}/>{tr("Decline")}</button><button className="primary" disabled={!!busy} onClick={() => run('yes' + f.id, () => respondFriend(f.id, true, data.user.name), 'You are now friends')}><Check size={15}/>{tr("Accept")}</button></div>)}</section>}
                {(notes.length > 0 || recipes > 0) && <section><h3><Mail size={16}/> {tr("Inbox")}</h3>{recipes > 0 && <p className="hint"><ChefHat size={14}/> {phrase('{0} shared recipes are waiting in Recipes → Shared with me.', recipes)}</p>}{notes.map(i => <div className="friend-row" key={i.id}><span><b>{i.senderName || tr("A friend")}</b><small>{i.kind === 'household_invite' ? phrase('invites you to the household {0}', i.payload?.household || '') : phrase('added you to the recipe book {0}', i.payload?.book || '')}</small></span><button className="secondary" disabled={!!busy} onClick={() => run('del' + i.id, () => deleteInbox(i.id))} aria-label={tr("Dismiss")}><X size={15}/></button>{i.kind === 'household_invite' && <button className="primary" disabled={!!busy} onClick={() => join(i)}><House size={15}/>{tr("Join household")}</button>}</div>)}</section>}
                <section><h3>{tr("Your friends")} <em>{accepted.length}</em></h3>{accepted.length ? accepted.map(f => <div className="friend-row" key={f.id}><span><b>{f.name || f.email}</b><small>{f.email}</small></span><button className="danger" disabled={!!busy} onClick={() => run('rm' + f.id, () => removeFriend(f.id))} aria-label={tr("Remove friend")}><Trash2 size={15}/></button>{owner && <button className="secondary" disabled={!!busy} onClick={() => inviteHome(f)}>{busy === 'home' + f.id ? <LoaderCircle size={15} className="spin"/> : <House size={15}/>}{tr("Invite to household")}</button>}</div>) : <p className="hint">{tr("No friends yet. Add someone by e-mail; they see your request after signing in.")}</p>}
                    {outgoing.map(f => <div className="friend-row" key={f.id}><span><b>{f.email}</b><small>{tr("Waiting for an answer")}</small></span><button className="danger" disabled={!!busy} onClick={() => run('rm' + f.id, () => removeFriend(f.id))}><X size={15}/>{tr("Withdraw")}</button></div>)}
                    {!owner && accepted.length > 0 && <p className="hint">{tr("Only the household owner can invite friends to this household.")}</p>}</section>
            </>}
            <div className="modal-actions"><button type="button" className="secondary" onClick={openHousehold}><House size={15}/>{tr("Household settings")}</button><button type="button" className="primary" onClick={close}>{tr("Done")}</button></div>
        </div>
    </Modal>;
}
