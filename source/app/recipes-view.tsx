import React, {useRef, useState} from 'react';
import {ChefHat, Camera, FileText, Pencil, Plus, ShoppingBasket, Trash2, LoaderCircle, CircleAlert, Users} from 'lucide-react';
import {Intro, Modal} from './basket-app';
import {tr, phrase} from '../lib/i18n';
import {inferCategory, newId, type BasketData} from '../lib/types';
import {shoppingCategory} from '../lib/food-presentation';
import {parseRecipe, parseIngredient, formatIngredient, ingredientName, type Recipe, type IngredientLanguage} from '../lib/recipe-parser';
import {loadRecipes, storeRecipes, readRecipePhoto} from '../lib/recipes';

type Act = (a: string, b?: any, m?: string) => Promise<any>;
const LANGUAGES: [IngredientLanguage, string][] = [['original', 'As written'], ['de', 'German'], ['en', 'English'], ['fr', 'French']];

export function RecipesView({ data, act }: { data: BasketData; act: Act }) {
    const [recipes, setRecipes] = useState<Recipe[]>(() => loadRecipes(data.user.id)), [editing, setEditing] = useState<Recipe | 'new' | null>(null), [open, setOpen] = useState<Recipe | null>(null), [shopping, setShopping] = useState<Recipe | null>(null), [saveError, setSaveError] = useState('');
    const persist = (next: Recipe[]) => { setRecipes(next); setSaveError(storeRecipes(data.user.id, next) ? '' : 'Recipes could not be saved on this device.'); };
    const save = (recipe: Recipe) => { persist(recipes.some(r => r.id === recipe.id) ? recipes.map(r => r.id === recipe.id ? recipe : r) : [recipe, ...recipes]); setEditing(null); setOpen(recipe); };
    const remove = (id: string) => { persist(recipes.filter(r => r.id !== id)); setEditing(null); setOpen(null); };
    return <><Intro eyebrow={tr("COOKING STARTS WITH THE LIST")} title={tr("Recipes")} action={<button className="primary" onClick={() => setEditing('new')}><Plus size={18}/>{tr("Add a recipe")}</button>}>{tr("Snap, paste or type a recipe. Add only what you still need to your list.")}</Intro>
        <div className="notice"><Users size={18}/><p>{tr("Recipes are saved on this device for now. Sharing with friends comes later.")}</p></div>
        {saveError && <div className="notice"><CircleAlert size={18}/><p>{tr(saveError)}</p></div>}
        {recipes.length ? <div className="receipt-grid">{recipes.map(r => <button className="receipt-card recipe-card" key={r.id} onClick={() => setOpen(r)}><ChefHat size={23}/><h3>{r.title || tr("Untitled recipe")}</h3><p>{phrase('{0} ingredients', r.ingredients.length)}{r.servings ? ' · ' + phrase('{0} servings', r.servings) : ''}</p></button>)}</div>
            : <div className="empty"><ChefHat size={34}/><h3>{tr("No recipes yet")}</h3><p>{tr("Take a photo of a recipe or paste its text to get started.")}</p></div>}
        {open && !editing && !shopping && <RecipeDetail recipe={open} close={() => setOpen(null)} edit={() => setEditing(open)} shop={() => setShopping(open)} remove={() => remove(open.id)}/>}
        {editing && <RecipeEditor recipe={editing === 'new' ? null : editing} close={() => setEditing(null)} save={save} remove={editing === 'new' ? undefined : () => remove(editing.id)}/>}
        {shopping && <RecipeShopping data={data} recipe={shopping} act={act} close={() => setShopping(null)}/>}
    </>;
}

function RecipeDetail({ recipe, close, edit, shop, remove }: { recipe: Recipe; close: () => void; edit: () => void; shop: () => void; remove: () => void }) {
    const [confirm, setConfirm] = useState(false);
    return <Modal title={recipe.title || tr("Untitled recipe")} subtitle={recipe.servings ? phrase('{0} servings', recipe.servings) : undefined} close={close} wide>
        <div className="recipe-detail"><h3>{tr("Ingredients")}</h3>{recipe.ingredients.length ? <ul>{recipe.ingredients.map((i, n) => <li key={n}>{formatIngredient(i)}</li>)}</ul> : <p className="hint">{tr("No ingredients yet.")}</p>}
            <h3>{tr("Preparation")}</h3>{recipe.steps.length ? <ol>{recipe.steps.map((s, n) => <li key={n}>{s}</li>)}</ol> : <p className="hint">{tr("No steps yet.")}</p>}</div>
        <div className="modal-actions"><button type="button" className="danger" onClick={() => confirm ? remove() : setConfirm(true)}><Trash2 size={15}/>{confirm ? tr("Yes, delete recipe") : tr("Delete recipe")}</button><button className="secondary" onClick={edit}><Pencil size={15}/>{tr("Edit")}</button><button className="primary" disabled={!recipe.ingredients.length} onClick={shop}><ShoppingBasket size={16}/>{tr("To shopping list")}</button></div>
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
