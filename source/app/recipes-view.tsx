import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ChefHat, Camera, FileText, Pencil, Plus, ShoppingBasket, Trash2, LoaderCircle, CircleAlert, Users, Send, BookOpen, Inbox, UserPlus, LogOut, Download, X} from 'lucide-react';
import {Intro, Modal} from './basket-app';
import {SocialNotice} from './friends';
import {tr, phrase} from '../lib/i18n';
import {inferCategory, newId, type BasketData} from '../lib/types';
import {shoppingCategory} from '../lib/food-presentation';
import {parseRecipe, parseIngredient, formatIngredient, ingredientName, type Recipe, type IngredientLanguage} from '../lib/recipe-parser';
import {loadRecipes, storeRecipes, readRecipePhoto} from '../lib/recipes';
import {socialState, listAccountRecipes, saveAccountRecipe, deleteAccountRecipe, listBooks, createBook, addBookMember, leaveBook, deleteBook, listFriends, listInbox, sendInbox, deleteInbox, recipePayload, type AccountRecipe, type Friend, type InboxItem, type RecipeBook, type SocialState} from '../lib/social';

type Act = (a: string, b?: any, m?: string) => Promise<any>;
const LANGUAGES: [IngredientLanguage, string][] = [['original', 'As written'], ['de', 'German'], ['en', 'English'], ['fr', 'French']];
const MINE = 'mine', SHARED = 'shared';
const sharedRecipe = (i: InboxItem): Recipe => ({ id: i.id, title: String(i.payload?.title || ''), servings: String(i.payload?.servings || ''), ingredients: Array.isArray(i.payload?.ingredients) ? i.payload.ingredients : [], steps: Array.isArray(i.payload?.steps) ? i.payload.steps : [], createdAt: Date.parse(i.createdAt) || 0, updatedAt: Date.parse(i.createdAt) || 0 });

export function RecipesView({ data, demo, act }: { data: BasketData; demo: boolean; act: Act }) {
    const [state, setState] = useState<SocialState | null>(null), [recipes, setRecipes] = useState<AccountRecipe[]>(() => loadRecipes(data.user.id).map(r => ({ ...r, bookId: null, owner: '' }))), [books, setBooks] = useState<RecipeBook[]>([]), [friends, setFriends] = useState<Friend[]>([]), [shared, setShared] = useState<InboxItem[]>([]), [shelf, setShelf] = useState(MINE);
    const [editing, setEditing] = useState<AccountRecipe | 'new' | null>(null), [open, setOpen] = useState<{ recipe: Recipe; inbox?: InboxItem } | null>(null), [shopping, setShopping] = useState<Recipe | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(!demo), [bookDialog, setBookDialog] = useState(false);
    const account = state?.mode === 'account';
    const load = useCallback(async () => {
        if (demo) { setState(null); setLoading(false); return; }
        const s = await socialState(); setState(s);
        if (s.mode !== 'account') { setLoading(false); return; }
        try {
            // Recipes kept on this device before account storage move into the account once.
            const local = loadRecipes(data.user.id);
            if (local.length) { for (const r of local) await saveAccountRecipe(r, null, true).catch(() => saveAccountRecipe(r, null, false)); storeRecipes(data.user.id, []); }
            const [r, b, f, i] = await Promise.all([listAccountRecipes(), listBooks(), listFriends(), listInbox()]);
            setRecipes(r); setBooks(b); setFriends(f.filter(x => x.status === 'accepted')); setShared(i.filter(x => x.kind === 'recipe')); setError('');
        } catch (e: any) { if (e?.missing) setState({ mode: 'local', reason: 'missing' }); else setError(e?.message || 'Recipes could not be loaded.'); }
        finally { setLoading(false); }
    }, [demo, data.user.id]);
    useEffect(() => { load(); }, [load]);
    const guard = async (task: () => Promise<unknown>) => { try { await task(); setError(''); } catch (e: any) { setError(e?.message || 'Something went wrong.'); } await load(); };
    const persistLocal = (next: AccountRecipe[]) => { setRecipes(next); setError(storeRecipes(data.user.id, next) ? '' : 'Recipes could not be saved on this device.'); };
    const book = books.find(b => b.id === shelf) || null;
    const save = async (recipe: Recipe) => {
        const existing = recipes.find(r => r.id === recipe.id), bookId = existing ? existing.bookId : book?.id || null;
        setEditing(null); setOpen({ recipe });
        if (account) await guard(() => saveAccountRecipe(recipe, bookId, !existing));
        else persistLocal(existing ? recipes.map(r => r.id === recipe.id ? { ...recipe, bookId: null, owner: '' } : r) : [{ ...recipe, bookId: null, owner: '' }, ...recipes]);
    };
    const remove = async (id: string) => { setEditing(null); setOpen(null); if (account) await guard(() => deleteAccountRecipe(id)); else persistLocal(recipes.filter(r => r.id !== id)); };
    const keepShared = async (item: InboxItem) => { const r = sharedRecipe(item), now = Date.now(); setOpen(null); await guard(async () => { await saveAccountRecipe({ ...r, id: newId(), createdAt: now, updatedAt: now }, null, true); await deleteInbox(item.id); }); setShelf(MINE); };
    const rows = shelf === SHARED ? [] : recipes.filter(r => shelf === MINE ? !r.bookId : r.bookId === shelf);
    const card = (r: Recipe, onClick: () => void, from?: string) => <button className="receipt-card recipe-card" key={r.id} onClick={onClick}><ChefHat size={23}/><h3>{r.title || tr("Untitled recipe")}</h3><p>{phrase('{0} ingredients', r.ingredients.length)}{r.servings ? ' · ' + phrase('{0} servings', r.servings) : ''}</p>{from && <small>{phrase('From {0}', from)}</small>}</button>;
    return <><Intro eyebrow={tr("COOKING STARTS WITH THE LIST")} title={tr("Recipes")} action={shelf !== SHARED && <button className="primary" onClick={() => setEditing('new')}><Plus size={18}/>{tr("Add a recipe")}</button>}>{tr("Snap, paste or type a recipe. Add only what you still need to your list.")}</Intro>
        {account ? null : state?.reason === 'signin' || demo ? <div className="notice"><Users size={18}/><p>{tr("Recipes are saved on this device. Sign in with your e-mail to keep them in your account and share them with friends.")}</p></div> : <SocialNotice state={state}/>}
        {state?.mode === 'local' && state.reason === 'missing' && <p className="hint">{tr("Until then, recipes stay on this device.")}</p>}
        {error && <div className="notice"><CircleAlert size={18}/><p>{tr(error)}</p></div>}
        {account && <div className="list-controls"><div className="list-tabs"><button className={shelf === MINE ? 'selected' : ''} onClick={() => setShelf(MINE)}><ChefHat size={15}/>{tr("My recipes")}<small>{recipes.filter(r => !r.bookId).length}</small></button>{books.map(b => <button key={b.id} className={shelf === b.id ? 'selected' : ''} onClick={() => setShelf(b.id)}><BookOpen size={15}/>{b.name}<small>{recipes.filter(r => r.bookId === b.id).length}</small></button>)}<button className={shelf === SHARED ? 'selected' : ''} onClick={() => setShelf(SHARED)}><Inbox size={15}/>{tr("Shared with me")}<small>{shared.length}</small></button></div><button className="secondary new-list-button" onClick={() => setBookDialog(true)}><Plus size={15}/>{tr("Recipe book")}</button></div>}
        {book && <BookBar book={book} me={state?.mode === 'account' ? state.userId : ''} friends={friends} guard={guard} sender={data.user.name} leave={() => setShelf(MINE)}/>}
        {loading ? <p className="hint"><LoaderCircle size={14} className="spin"/> {tr("Loading recipes…")}</p>
            : shelf === SHARED ? (shared.length ? <div className="receipt-grid">{shared.map(i => card(sharedRecipe(i), () => setOpen({ recipe: sharedRecipe(i), inbox: i }), i.senderName || tr("A friend")))}</div> : <div className="empty"><Inbox size={34}/><h3>{tr("Nothing shared yet")}</h3><p>{tr("Recipes your friends send you appear here.")}</p></div>)
            : rows.length ? <div className="receipt-grid">{rows.map(r => card(r, () => setOpen({ recipe: r })))}</div>
            : <div className="empty"><ChefHat size={34}/><h3>{tr("No recipes yet")}</h3><p>{tr("Take a photo of a recipe or paste its text to get started.")}</p></div>}
        {open && !editing && !shopping && <RecipeDetail recipe={open.recipe} inbox={open.inbox} friends={account ? friends : []} close={() => setOpen(null)} edit={() => setEditing(recipes.find(r => r.id === open.recipe.id) || null)} shop={() => setShopping(open.recipe)} remove={() => open.inbox ? guard(async () => { await deleteInbox(open.inbox!.id); setOpen(null); }) : remove(open.recipe.id)} keep={open.inbox ? () => keepShared(open.inbox!) : undefined} send={async f => { await sendInbox(f.userId!, 'recipe', recipePayload(open.recipe), data.user.name); }}/>}
        {editing && <RecipeEditor recipe={editing === 'new' ? null : editing} close={() => setEditing(null)} save={save} remove={editing === 'new' ? undefined : () => remove(editing.id)}/>}
        {shopping && <RecipeShopping data={data} recipe={shopping} act={act} close={() => setShopping(null)}/>}
        {bookDialog && <BookDialog close={() => setBookDialog(false)} create={async name => { setBookDialog(false); let id = ''; await guard(async () => { id = await createBook(name, data.user.name); }); if (id) setShelf(id); }}/>}
    </>;
}

function BookBar({ book, me, friends, guard, sender, leave }: { book: RecipeBook; me: string; friends: Friend[]; guard: (t: () => Promise<unknown>) => Promise<void>; sender: string; leave: () => void }) {
    const [friend, setFriend] = useState(''), [confirm, setConfirm] = useState(false), owner = book.owner === me;
    const candidates = friends.filter(f => f.userId && !book.members.some(m => m.userId === f.userId));
    const add = () => { const f = candidates.find(x => x.id === friend); if (!f) return; setFriend(''); guard(async () => { await addBookMember(book.id, f); await sendInbox(f.userId!, 'book_invite', { book: book.name, bookId: book.id }, sender); }); };
    return <div className="notice recipe-book-bar"><BookOpen size={18}/><div><p>{tr("Shared recipe book")} · {book.members.map(m => m.userId === me ? tr("You") : m.name || tr("Friend")).join(', ')}</p>
        <div className="input-button">{owner && candidates.length > 0 && <><select value={friend} onChange={e => setFriend(e.target.value)} aria-label={tr("Add a friend to this book")}><option value="">{tr("Add a friend…")}</option>{candidates.map(f => <option key={f.id} value={f.id}>{f.name || f.email}</option>)}</select><button className="secondary" disabled={!friend} onClick={add}><UserPlus size={15}/>{tr("Add")}</button></>}
            <button className="danger" onClick={() => { if (!confirm) return setConfirm(true); leave(); guard(() => owner ? deleteBook(book.id) : leaveBook(book.id)); }}>{owner ? <Trash2 size={15}/> : <LogOut size={15}/>}{confirm ? (owner ? tr("Yes, delete book and its recipes") : tr("Yes, leave book")) : owner ? tr("Delete book") : tr("Leave book")}</button></div>
        {owner && !friends.length && <p className="hint">{tr("Add friends first to share this book.")}</p>}</div></div>;
}

function BookDialog({ close, create }: { close: () => void; create: (name: string) => void }) {
    const [name, setName] = useState('');
    return <Modal title={tr("New recipe book")} subtitle="A recipe book you can share with friends." close={close}><form className="dialog-form" onSubmit={e => { e.preventDefault(); if (name.trim()) create(name.trim()); }}><label>{tr("Name")}<input value={name} onChange={e => setName(e.target.value)} maxLength={80} required placeholder={tr("e.g. Family favourites")}/></label><div className="modal-actions"><button type="button" className="secondary" onClick={close}>{tr("Cancel")}</button><button className="primary" disabled={!name.trim()}>{tr("Create book")}</button></div></form></Modal>;
}

function RecipeDetail({ recipe, inbox, friends, close, edit, shop, remove, keep, send }: { recipe: Recipe; inbox?: InboxItem; friends: Friend[]; close: () => void; edit: () => void; shop: () => void; remove: () => void; keep?: () => void; send: (f: Friend) => Promise<void> }) {
    const [confirm, setConfirm] = useState(false), [friend, setFriend] = useState(''), [sending, setSending] = useState(false), [sent, setSent] = useState('');
    const share = async () => { const f = friends.find(x => x.id === friend); if (!f) return; setSending(true); setSent(''); try { await send(f); setSent(phrase('Sent to {0}', f.name || f.email)); setFriend(''); } catch (e: any) { setSent(e?.message || 'The recipe could not be sent.'); } finally { setSending(false); } };
    return <Modal title={recipe.title || tr("Untitled recipe")} subtitle={recipe.servings ? phrase('{0} servings', recipe.servings) : inbox ? phrase('From {0}', inbox.senderName || tr("A friend")) : undefined} close={close} wide>
        <div className="recipe-detail"><h3>{tr("Ingredients")}</h3>{recipe.ingredients.length ? <ul>{recipe.ingredients.map((i, n) => <li key={n}>{formatIngredient(i)}</li>)}</ul> : <p className="hint">{tr("No ingredients yet.")}</p>}
            <h3>{tr("Preparation")}</h3>{recipe.steps.length ? <ol>{recipe.steps.map((s, n) => <li key={n}>{s}</li>)}</ol> : <p className="hint">{tr("No steps yet.")}</p>}</div>
        {!inbox && friends.length > 0 && <div className="input-button recipe-send"><select value={friend} onChange={e => setFriend(e.target.value)} aria-label={tr("Send to a friend")}><option value="">{tr("Send to a friend…")}</option>{friends.map(f => <option key={f.id} value={f.id}>{f.name || f.email}</option>)}</select><button className="secondary" disabled={!friend || sending} onClick={share}>{sending ? <LoaderCircle size={15} className="spin"/> : <Send size={15}/>}{tr("Send")}</button></div>}
        {sent && <p className="hint">{tr(sent)}</p>}
        <div className="modal-actions">{inbox ? <button type="button" className="danger" onClick={remove}><X size={15}/>{tr("Dismiss")}</button> : <button type="button" className="danger" onClick={() => confirm ? remove() : setConfirm(true)}><Trash2 size={15}/>{confirm ? tr("Yes, delete recipe") : tr("Delete recipe")}</button>}{keep ? <button className="secondary" onClick={keep}><Download size={15}/>{tr("Save to my recipes")}</button> : <button className="secondary" onClick={edit}><Pencil size={15}/>{tr("Edit")}</button>}<button className="primary" disabled={!recipe.ingredients.length} onClick={shop}><ShoppingBasket size={16}/>{tr("To shopping list")}</button></div>
    </Modal>;
}

function RecipeEditor({ recipe, close, save, remove }: { recipe: Recipe | null; close: () => void; save: (r: Recipe) => void; remove?: () => void }) {
    const [title, setTitle] = useState(recipe?.title || ''), [servings, setServings] = useState(recipe?.servings || ''), [ingredients, setIngredients] = useState(recipe?.ingredients.map(formatIngredient).join('\n') || ''), [steps, setSteps] = useState(recipe?.steps.join('\n') || ''), [source, setSource] = useState(''), [reading, setReading] = useState(false), [error, setError] = useState(''), [confirm, setConfirm] = useState(false), file = useRef<HTMLInputElement>(null);
    const apply = (text: string) => { const p = parseRecipe(text); if (p.title) setTitle(p.title); if (p.servings) setServings(p.servings); setIngredients(p.ingredients.map(formatIngredient).join('\n')); setSteps(p.steps.join('\n')); if (!p.ingredients.length && !p.steps.length) setError('No recipe found in this text. Check it or fill in the fields yourself.'); else setError(''); };
    const photo = async (f?: File) => { if (!f) return; setReading(true); setError(''); try { const text = await readRecipePhoto(f); setSource(text); apply(text); } catch (e: any) { setError(e?.message || 'The photo could not be read.'); } finally { setReading(false); if (file.current) file.current.value = ''; } };
    const submit = (e: React.FormEvent) => { e.preventDefault(); const now = Date.now(); save({ id: recipe?.id || newId(), createdAt: recipe?.createdAt || now, updatedAt: now, title: title.trim(), servings: servings.trim(), ingredients: ingredients.split('\n').map(parseIngredient).filter(i => i.name), steps: steps.split('\n').map(s => s.trim()).filter(Boolean) }); };
    return <Modal title={recipe ? tr("Edit recipe") : tr("New recipe")} subtitle="Photo, pasted text or typed by hand." close={close} wide>
        <form className="dialog-form" onSubmit={submit}>
            <details className="recipe-import" open={!recipe}><summary>{tr("Read a photo or text")}</summary>
                <div className="recipe-import-actions"><button type="button" className="secondary" disabled={reading} onClick={() => file.current?.click()}>{reading ? <LoaderCircle size={16} className="spin"/> : <Camera size={16}/>}{reading ? tr("Reading photo on this device…") : tr("Take or choose a photo")}</button><input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={e => photo(e.target.files?.[0])}/></div>
                <label>{tr("Recipe text")}<textarea rows={6} value={source} onChange={e => setSource(e.target.value)} placeholder={tr("Paste the recipe here")}/></label>
                <button type="button" className="secondary" disabled={!source.trim() || reading} onClick={() => apply(source)}><FileText size={16}/>{tr("Read text")}</button>
            </details>
            {error && <p className="hint"><CircleAlert size={14}/> {tr(error)}</p>}
            <label>{tr("Title")}<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required placeholder={tr("e.g. Pancakes")}/></label>
            <label>{tr("Servings")}<input value={servings} onChange={e => setServings(e.target.value)} maxLength={20} inputMode="numeric"/></label>
            <label>{tr("Ingredients (one per line)")}<textarea rows={7} value={ingredients} onChange={e => setIngredients(e.target.value)} placeholder={tr("200 g flour")}/></label>
            <label>{tr("Preparation (one step per line)")}<textarea rows={6} value={steps} onChange={e => setSteps(e.target.value)}/></label>
            <div className="modal-actions">{remove ? <button type="button" className="danger" onClick={() => confirm ? remove() : setConfirm(true)}><Trash2 size={15}/>{confirm ? tr("Yes, delete recipe") : tr("Delete recipe")}</button> : <button type="button" className="secondary" onClick={close}>{tr("Cancel")}</button>}<button className="primary" disabled={!title.trim() || reading}>{tr("Save recipe")}</button></div>
        </form>
    </Modal>;
}

function RecipeShopping({ data, recipe, act, close }: { data: BasketData; recipe: Recipe; act: Act; close: () => void }) {
    const [home, setHome] = useState<Set<number>>(new Set()), [listId, setListId] = useState(data.lists[0]?.id || ''), [language, setLanguage] = useState<IngredientLanguage>('original'), [busy, setBusy] = useState(false);
    const missing = recipe.ingredients.map((i, n) => ({ ...i, n, label: ingredientName(i.name, language) })).filter(i => !home.has(i.n));
    const toggle = (n: number) => setHome(s => { const next = new Set(s); next.has(n) ? next.delete(n) : next.add(n); return next; });
    const add = async () => { const list = data.lists.find(l => l.id === listId); if (!list) return; setBusy(true); try { for (const [k, i] of missing.entries()) { const r = await act('addItem', { id: newId(), listId, name: i.label, quantity: [i.quantity, i.unit].filter(Boolean).join(' ') || '1', category: shoppingCategory(i.label, data.iconPreferences, inferCategory(i.label)) }, k === missing.length - 1 ? phrase('Added {0} items to {1}', missing.length, list.name) : ''); if (!r) return; } close(); } finally { setBusy(false); } };
    return <Modal title={tr("To shopping list")} subtitle="Tick what you already have at home." close={close} wide>
        <div className="dialog-form">
            <div className="recipe-checklist">{recipe.ingredients.map((i, n) => <label key={n} className="recipe-check"><input type="checkbox" checked={home.has(n)} onChange={() => toggle(n)}/><span className={home.has(n) ? 'at-home' : ''}>{[i.quantity, i.unit, ingredientName(i.name, language)].filter(Boolean).join(' ')}</span>{home.has(n) && <small>{tr("at home")}</small>}</label>)}</div>
            {data.lists.length ? <label>{tr("Shopping list")}<select value={listId} onChange={e => setListId(e.target.value)}>{data.lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label> : <p className="hint">{tr("Create a shopping list first.")}</p>}
            <label>{tr("Item language")}<select value={language} onChange={e => setLanguage(e.target.value as IngredientLanguage)}>{LANGUAGES.map(([id, label]) => <option key={id} value={id}>{tr(label)}</option>)}</select></label>
            <div className="modal-actions"><button type="button" className="secondary" onClick={close}>{tr("Cancel")}</button><button className="primary" disabled={busy || !listId || !missing.length} onClick={add}>{busy ? <LoaderCircle size={16} className="spin"/> : <ShoppingBasket size={16}/>}{phrase('Add {0} items', missing.length)}</button></div>
        </div>
    </Modal>;
}
