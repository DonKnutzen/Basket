import type {Session} from '@supabase/supabase-js';
import {browserAuth, readBrowserSession} from './supabase-browser';
import type {Recipe} from './recipe-parser';
// Friends, in-app inbox, recipe books and account recipes, stored in Supabase with row level security.
// Needs supabase/migrations/20261101120000_friends_inbox_recipes.sql; without it every call reports "missing".

export type Friend={id:string;status:'pending'|'accepted';incoming:boolean;email:string;name:string;userId:string|null};
export type InboxKind='recipe'|'household_invite'|'book_invite';
export type InboxItem={id:string;kind:InboxKind;senderName:string;sender:string;recipient:string;payload:any;readAt:string|null;createdAt:string};
export type RecipeBook={id:string;name:string;owner:string;members:{userId:string;name:string}[]};
export type AccountRecipe=Recipe & {bookId:string|null;owner:string};
export type SocialState={mode:'account';userId:string;email:string}|{mode:'local';reason:'signin'|'missing'|'error';message?:string};

export class SocialError extends Error{constructor(message:string,public missing=false){super(message)}}
/** True when Supabase answers that the friends/recipes tables or functions do not exist yet. */
export function isMissingSchema(error:any){
 const code=String(error?.code||''),message=String(error?.message||'');
 return ['PGRST205','PGRST202','42P01','42883'].includes(code)||/schema cache|does not exist|Could not find the (table|function)/i.test(message);
}
function check<T>(result:{data:T|null;error:any}):T{
 if(result.error)throw new SocialError(result.error.message||'Request failed.',isMissingSchema(result.error));
 return (result.data??[]) as T;
}
const db=()=>browserAuth();
let session:Session|null=null;

/** Decides whether this device can use account features: signed in with e-mail and the SQL installed. */
export async function socialState():Promise<SocialState>{
 try{
  session=await readBrowserSession();
  if(!session?.user?.email)return {mode:'local',reason:'signin'};
  const probe=await db().from('recipes').select('id',{head:true,count:'exact'}).limit(1);
  if(probe.error)return isMissingSchema(probe.error)?{mode:'local',reason:'missing'}:{mode:'local',reason:'error',message:probe.error.message};
  return {mode:'account',userId:session.user.id,email:session.user.email.toLowerCase()};
 }catch(e:any){return {mode:'local',reason:'error',message:e?.message}}
}
const me=()=>{if(!session?.user)throw new SocialError('Sign in with your e-mail to use friends.');return session.user};

export function friendFromRow(row:any,userId:string):Friend{
 const incoming=row.requester!==userId;
 return {id:row.id,status:row.status,incoming,email:incoming?row.requester_email:row.addressee_email,name:(incoming?row.requester_name:row.addressee_name)||'',userId:incoming?row.requester:row.addressee};
}
export async function listFriends(){
 const user=me();
 return check(await db().from('friendships').select('*').order('created_at',{ascending:false})).map((r:any)=>friendFromRow(r,user.id));
}
export function validEmail(value:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())}
export async function requestFriend(email:string,displayName:string){
 const user=me(),addressee=email.trim().toLowerCase();
 if(!validEmail(addressee))throw new SocialError('Enter a valid e-mail address.');
 if(addressee===user.email?.toLowerCase())throw new SocialError('That is your own e-mail address.');
 const r=await db().from('friendships').insert({requester:user.id,requester_email:user.email!.toLowerCase(),requester_name:displayName.slice(0,80),addressee_email:addressee});
 if(r.error?.code==='23505')throw new SocialError('You already sent a request to this address.');
 check(r);
}
export async function respondFriend(id:string,accept:boolean,displayName:string){check(await db().rpc('basket_respond_friend',{request_id:id,accept,display_name:displayName.slice(0,80)}))}
export async function removeFriend(id:string){check(await db().from('friendships').delete().eq('id',id))}

const inboxFromRow=(r:any):InboxItem=>({id:r.id,kind:r.kind,senderName:r.sender_name,sender:r.sender,recipient:r.recipient,payload:r.payload,readAt:r.read_at,createdAt:r.created_at});
export async function listInbox(){
 const user=me();
 return check(await db().from('inbox').select('*').eq('recipient',user.id).order('created_at',{ascending:false}).limit(100)).map(inboxFromRow);
}
export async function sendInbox(recipient:string,kind:InboxKind,payload:any,senderName:string){
 me();check(await db().from('inbox').insert({recipient,kind,payload,sender_name:senderName.slice(0,80)}));
}
export async function markInboxRead(id:string){check(await db().from('inbox').update({read_at:new Date().toISOString()}).eq('id',id))}
export async function deleteInbox(id:string){check(await db().from('inbox').delete().eq('id',id))}

export async function listBooks():Promise<RecipeBook[]>{
 me();
 const books=check(await db().from('recipe_books').select('id,name,owner').order('created_at'));
 if(!books.length)return [];
 const members=check(await db().from('recipe_book_members').select('book_id,user_id,display_name').in('book_id',books.map((b:any)=>b.id)));
 return books.map((b:any)=>({id:b.id,name:b.name,owner:b.owner,members:members.filter((m:any)=>m.book_id===b.id).map((m:any)=>({userId:m.user_id,name:m.display_name}))}));
}
export async function createBook(name:string,displayName:string){
 const user=me();
 const book=check(await db().from('recipe_books').insert({name:name.trim().slice(0,80),owner:user.id}).select('id').single()) as any;
 await db().from('recipe_book_members').update({display_name:displayName.slice(0,80)}).eq('book_id',book.id).eq('user_id',user.id);
 return book.id as string;
}
export async function addBookMember(bookId:string,friend:Friend){
 if(!friend.userId)throw new SocialError('This friend has not accepted yet.');
 const r=await db().from('recipe_book_members').insert({book_id:bookId,user_id:friend.userId,display_name:(friend.name||friend.email).slice(0,80)});
 if(r.error?.code!=='23505')check(r);
}
export async function leaveBook(bookId:string){const user=me();check(await db().from('recipe_book_members').delete().eq('book_id',bookId).eq('user_id',user.id))}
export async function deleteBook(bookId:string){check(await db().from('recipe_books').delete().eq('id',bookId))}

export function recipeFromRow(r:any):AccountRecipe{
 return {id:r.id,title:r.title||'',servings:r.servings||'',ingredients:Array.isArray(r.ingredients)?r.ingredients:[],steps:Array.isArray(r.steps)?r.steps:[],createdAt:Date.parse(r.created_at)||0,updatedAt:Date.parse(r.updated_at)||0,bookId:r.book_id||null,owner:r.owner};
}
export function recipeRow(recipe:Recipe,bookId:string|null){
 return {id:recipe.id,book_id:bookId,title:recipe.title.slice(0,120),servings:recipe.servings.slice(0,20),ingredients:recipe.ingredients,steps:recipe.steps,updated_at:new Date(recipe.updatedAt||Date.now()).toISOString()};
}
export async function listAccountRecipes(){
 me();return check(await db().from('recipes').select('*').order('updated_at',{ascending:false})).map(recipeFromRow);
}
export async function saveAccountRecipe(recipe:Recipe,bookId:string|null,isNew:boolean){
 const user=me(),row=recipeRow(recipe,bookId);
 if(isNew)check(await db().from('recipes').insert({...row,owner:user.id,created_at:new Date(recipe.createdAt||Date.now()).toISOString()}));
 else check(await db().from('recipes').update(row).eq('id',recipe.id));
}
export async function deleteAccountRecipe(id:string){check(await db().from('recipes').delete().eq('id',id))}
/** A copy of a recipe for sending: no ids or owners, only the content. */
export function recipePayload(recipe:Recipe){return {title:recipe.title,servings:recipe.servings,ingredients:recipe.ingredients,steps:recipe.steps}}
