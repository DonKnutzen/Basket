import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
import {GET,POST,OPTIONS} from '../app/api/basket/route';
import {GET as CONFIG_GET} from '../app/api/account-config/route';
import {isAllowedOrigin,preflight} from '../lib/cors';
import {GET as IMAGE_GET} from '../app/api/receipt-image/route';
import {getBasketUser} from '../lib/basket-user';
import {budgetSpent,monthOptions} from '../lib/budgets';
import {parseReceipt,difference} from '../lib/receipt-parser';
import {toCents,inferCategory} from '../lib/types';
import {householdSharing} from '../lib/household-display';
const globals=globalThis as any;let sql:DatabaseSync;
class Statement{values:any[]=[];constructor(public query:string){}bind(...v:any[]){this.values=v;return this}async first(){return sql.prepare(this.query).get(...this.values)||null}async all(){return {results:sql.prepare(this.query).all(...this.values),success:true}}async run(){return {success:true,meta:{changes:Number(sql.prepare(this.query).run(...this.values).changes)}}}}
function user(id:string|null){globals.__user=id?{userId:id,email:id+'@example.test',fullName:id}:null}
beforeEach(()=>{sql=new DatabaseSync(':memory:');for(const migration of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+migration,'utf8'));globals.__env={DB:{prepare:(q:string)=>new Statement(q),batch:async(stmts:Statement[])=>{sql.exec('BEGIN');try{const results=[];for(const s of stmts)results.push(/^SELECT/i.test(s.query)?await s.all():await s.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}},BUCKET:null};globals.__tokens=new Map();user('alex')});
async function get(headers:Record<string,string>={}){const r=await GET(new Request('https://basket.test/api/basket',{headers:{'x-basket-identity':'chatgpt',...headers}}));return {status:r.status,body:await r.json() as any}}
async function post(action:string,body:any={},origin='https://basket.test',authHeaders:Record<string,string>={}){const r=await POST(new Request('https://basket.test/api/basket',{method:'POST',headers:{'Content-Type':'application/json',origin,'x-basket-identity':'chatgpt',...authHeaders},body:JSON.stringify({action,...body})}));return {status:r.status,body:await r.json() as any}}
function draft(){return {id:'receipt-1',store:'No Frills',date:'2026-10-27',total:'10.98',tax:'0',currency:'CAD',lines:[{name:'Milk',label:'MILK 2L',packSize:'2 L',category:'Dairy & eggs',quantity:'2',amount:'10.98'}]}}
test('anonymous requests and cross-origin mutations are rejected',async()=>{user(null);assert.equal((await get()).status,401);user('alex');await get();assert.equal((await post('renameHome',{name:'Other'},'https://other.test')).status,403)});
test('households are isolated and cannot modify each other’s lists',async()=>{const a=(await get()).body;user('sam');const b=(await get()).body;assert.notEqual(a.household.id,b.household.id);assert.equal((await post('addItem',{id:'x',listId:a.lists[0].id,name:'Milk'})).status,404)});
test('item additions are idempotent and checks persist',async()=>{const d=(await get()).body;const item={id:'item-1',listId:d.lists[0].id,name:'Milk',quantity:'2 L',category:'Dairy & eggs'};await post('addItem',item);await post('addItem',item);assert.equal((await get()).body.items.length,1);await post('updateItem',{id:item.id,checked:true});assert.equal((await get()).body.items[0].checked,1);await post('clearChecked',{listId:item.listId});assert.equal((await get()).body.items.length,0)});
test('at least one shopping list is preserved',async()=>{const a=(await get()).body;assert.equal((await post('deleteList',{id:a.lists[0].id})).status,400);const b=await post('addList',{name:'Dinner'});assert.ok(b.body.id);await post('deleteList',{id:b.body.id});assert.equal((await get()).body.lists.length,1)});
test('invitation joins and shares data, retaining the previous household',async()=>{const a=(await get()).body,invite=(await post('invite')).body;assert.equal(invite.code.length,24);user('sam');await get();assert.equal((await post('join',{code:invite.code})).status,200);const b=(await get()).body;assert.equal(b.household.id,a.household.id);assert.equal(b.homes.length,2);assert.equal((await post('invite')).status,403);await post('addItem',{id:'sam-egg',listId:a.lists[0].id,name:'Eggs'});user('alex');assert.equal((await get()).body.items[0].name,'Eggs')});
test('two email accounts see their household membership and can both create and edit shared lists',async()=>{
 const owner=emailToken('owner');globals.__tokens.get('test-token-owner').user_metadata.display_name='Alex';
 const ownerHome=(await get(owner)).body;
 const ownerList=await post('addList',{name:'Shared dinner'},'https://donknutzen.github.io',owner);
 const invite=(await post('invite',{},'https://donknutzen.github.io',owner)).body;
 const partner=emailToken('partner');globals.__tokens.get('test-token-partner').user_metadata.display_name='Sam';
 const personal=(await get(partner)).body;
 const personalList=(await post('addList',{name:'Previous personal household'},'https://donknutzen.github.io',partner)).body.id;
 assert.equal((await post('join',{code:invite.code},'https://donknutzen.github.io',partner)).status,200);
 const joined=(await get(partner)).body;
 assert.equal(joined.household.id,ownerHome.household.id);
 assert.equal(joined.members.length,2);
 assert.equal(householdSharing(joined).label,'Shared with Alex');
 assert.equal(householdSharing((await get(owner)).body).label,'Shared with Sam');
 assert.ok(joined.lists.some((l:any)=>l.id===ownerList.body.id));
 assert.ok(!joined.lists.some((l:any)=>l.id===personalList));
 const shared=(await post('addList',{name:'Created by Sam'},'https://donknutzen.github.io',partner)).body;
 assert.equal((await post('addItem',{id:'shared-milk',listId:shared.id,name:'Milk'},'https://donknutzen.github.io',partner)).status,200);
 const ownerView=(await get(owner)).body;
 assert.ok(ownerView.lists.some((l:any)=>l.id===shared.id));
 assert.equal(ownerView.items.find((i:any)=>i.id==='shared-milk').listId,shared.id);
 await post('updateItem',{id:'shared-milk',checked:true},'https://donknutzen.github.io',owner);
 assert.equal((await get(partner)).body.items.find((i:any)=>i.id==='shared-milk').checked,1);
 await post('switchHome',{id:personal.household.id},'https://donknutzen.github.io',partner);
 const switched=(await get(partner)).body;
 assert.equal(switched.household.id,personal.household.id);
 assert.equal(householdSharing(switched).shared,false);
 assert.ok(switched.lists.some((l:any)=>l.id===personalList));
 assert.ok(!switched.lists.some((l:any)=>l.id===shared.id));
 const outsider=emailToken('outsider');await get(outsider);
 assert.equal((await post('addItem',{id:'forbidden',listId:shared.id,name:'No access'},'https://donknutzen.github.io',outsider)).status,404);
});
test('household sharing labels use the active household members without repeating the signed-in user',()=>{
 const user={id:'me',name:'Alex'};
 assert.deepEqual(householdSharing({user,members:[{userId:'me',displayName:'Alex'}]}),{shared:false,label:'Only you · Invite your partner'});
 assert.equal(householdSharing({user,members:[{userId:'me',displayName:'Alex'},{userId:'sam',displayName:'Sam'},{userId:'jo',displayName:'Jo'}]}).label,'Shared with Sam and Jo');
});
test('receipt save stores line quantities, learns aliases and avoids duplicates',async()=>{await get();const d=draft();assert.equal((await post('saveReceipt',{draft:d})).status,200);await post('saveReceipt',{draft:d});const a=(await get()).body;assert.equal(a.receipts.length,1);assert.equal(a.lines[0].quantity,2);assert.equal(a.lines[0].amountCents,1098);assert.equal(a.products[0].packSize,'2 L');assert.equal(a.aliases[0].label,'milk 2l');assert.equal(a.aliases[0].store,'no frills')});
test('invalid arithmetic, dates and foreign photos cannot be saved',async()=>{await get();const d=draft();assert.equal((await post('saveReceipt',{draft:{...d,total:'20.00'}})).status,400);assert.equal((await post('saveReceipt',{draft:{...d,date:'2026-02-30'}})).status,400);assert.equal((await post('saveReceipt',{draft:{...d,imageKey:'foreign-home/image'}})).status,403);assert.equal((await get()).body.receipts.length,0)});
test('different pack sizes stay separate and receipt deletion removes prices',async()=>{await get();const d=draft();await post('saveReceipt',{draft:d});await post('saveReceipt',{draft:{...d,id:'r2',lines:[{...d.lines[0],packSize:'1 L'}]}});assert.equal((await get()).body.products.length,2);await post('deleteReceipt',{id:d.id});assert.equal((await get()).body.lines.length,1)});
test('parser separates taxes, totals and payment',()=>{const d=parseReceipt('NO FRILLS\n2026-10-27\n2 x BANANAS 3.38\nMILK 2L 5.49\nSUBTOTAL 8.87\nHST 0.72\nTOTAL 9.59\nDEBIT 9.59');assert.equal(d.lines.length,2);assert.equal(d.lines[0].quantity,'2');assert.equal(d.tax,'0.72');assert.equal(difference(d),0)});
test('learned labels match only their store',()=>{const p=[{id:'milk',name:'Whole milk',normalized:'whole milk|2 l',category:'Dairy & eggs',packSize:'2 L'}],a=[{store:'no frills',label:'pc mlk',productId:'milk'}];assert.equal(parseReceipt('NO FRILLS\nPC MLK 5.49\nTOTAL 5.49',p,a).lines[0].name,'Whole milk');assert.notEqual(parseReceipt('SOBEYS\nPC MLK 5.49\nTOTAL 5.49',p,a).lines[0].name,'Whole milk')});
test('discounts require review and absent totals are not invented',()=>{const d=parseReceipt('SOBEYS\nAPPLES 4.00\nCOUPON -1.00\nTOTAL 3.00');assert.equal(difference(d),-100);assert.equal(parseReceipt('SOBEYS\nAPPLES 4.00').total,'')});
test('decimal commas, invalid money and food categories are handled',()=>{const d=parseReceipt('IGA\nPAIN 3,99\nTPS 0,20\nTVQ 0,40\nTOTAL 4,59');assert.equal(difference(d),0);assert.equal(toCents('19.99'),1999);assert.ok(Number.isNaN(toCents('1e2')));assert.ok(Number.isNaN(toCents('1.005')));assert.equal(inferCategory('Ice cream'),'Frozen')});

function emailToken(id='email-alex',confirmed=true){const token='test-token-'+id;globals.__tokens.set(token,{id,email:id+'@example.test',email_confirmed_at:confirmed?'2026-10-27T12:00:00Z':null,user_metadata:{display_name:'Email Alex'},is_anonymous:false});return {authorization:'Bearer '+token}}
test('email login requires a remotely verified token and never falls back to ChatGPT for a forged bearer',async()=>{assert.equal((await get({authorization:'Bearer forged-token'})).status,401);assert.equal((await get({authorization:'Bearer invalid token'})).status,401);const r=await GET(new Request('https://basket.test/api/basket'));assert.equal(r.status,401)});
test('unconfirmed and anonymous email identities cannot read household data',async()=>{assert.equal((await get(emailToken('unconfirmed',false))).status,401);const headers=emailToken('anonymous');globals.__tokens.get('test-token-anonymous').is_anonymous=true;assert.equal((await get(headers)).status,401)});
test('verified email identity uses its server-returned ID, with profile metadata used only for display',async()=>{const headers=emailToken();globals.__tokens.get('test-token-email-alex').user_metadata.role='admin';const d=(await get(headers)).body;assert.equal(d.user.id,'supabase:email-alex');assert.equal(d.user.provider,'email');assert.equal(d.user.name,'Email');assert.equal(d.household.ownerId,'supabase:email-alex');assert.equal(d.receipts.length,0)});
test('budgets upsert within their household, month, category and currency',async()=>{await get();const budget={month:'2026-10',currency:'CAD',category:'Overall',amount:'600.00'};assert.equal((await post('saveBudget',budget)).status,200);await post('saveBudget',{...budget,amount:'650.00'});await post('saveBudget',{...budget,currency:'EUR',amount:'300'});await post('saveBudget',{...budget,month:'2026-11'});await post('saveBudget',{...budget,category:'Produce',amount:'120'});const d=(await get()).body;assert.equal(d.budgets.length,4);assert.equal(d.budgets.find((b:any)=>b.currency==='CAD'&&b.month==='2026-10'&&b.category==='Overall').amountCents,65000)});
test('invalid budgets are rejected and another household cannot read or remove them',async()=>{await get();const b={month:'2026-10',currency:'CAD',category:'Overall',amount:'600'};for(const patch of [{month:'2026-13'},{amount:'-10'},{amount:'0'},{category:'Made up'},{currency:'JPY'},{amount:'1.005'}])assert.equal((await post('saveBudget',{...b,...patch})).status,400);const created=await post('saveBudget',b);user('sam');assert.equal((await get()).body.budgets.length,0);assert.equal((await post('deleteBudget',{id:created.body.id})).status,404)});
test('partners joining a household can see and update the same monthly budget',async()=>{const owner=(await get()).body;await post('saveBudget',{month:'2026-10',currency:'CAD',category:'Overall',amount:'600'});const invite=(await post('invite')).body;user('sam');await get();await post('join',{code:invite.code});assert.equal((await get()).body.budgets[0].amountCents,60000);await post('saveBudget',{month:'2026-10',currency:'CAD',category:'Overall',amount:'700'});user('alex');const d=(await get()).body;assert.equal(d.household.id,owner.household.id);assert.equal(d.budgets[0].amountCents,70000);assert.equal(d.budgets[0].updatedBy,'sam')});
test('budget spending includes tax overall but isolates categories, months and currencies',async()=>{await get();await post('saveReceipt',{draft:{...draft(),total:'12.00',tax:'1.02'}});const d=(await get()).body;const b={id:'b',month:'2026-10',currency:'CAD',category:'Overall',amountCents:60000,updatedBy:'alex',updatedAt:0};assert.equal(budgetSpent(b,d),1200);assert.equal(budgetSpent({...b,category:'Dairy & eggs'},d),1098);assert.equal(budgetSpent({...b,currency:'EUR'},d),0);assert.equal(budgetSpent({...b,month:'2026-11'},d),0);const options=monthOptions(d,new Date('2026-10-27T12:00:00Z'));assert.ok(options.includes('2026-10'));assert.ok(options.includes('2027-01'))});
test('connecting previous ChatGPT shopping data requires proof of both accounts',async()=>{const legacy=(await get()).body;await post('saveBudget',{month:'2026-10',currency:'CAD',category:'Overall',amount:'500'});assert.equal((await post('importChatGPT')).status,403);const token=emailToken();await get(token);assert.equal((await post('importChatGPT',{},'https://basket.test',token)).status,200);const email=(await get(token)).body;assert.equal(email.household.id,legacy.household.id);assert.equal(email.household.ownerId,'supabase:email-alex');assert.equal(email.budgets[0].amountCents,50000);assert.equal(email.canImportChatGPT,false);user(null);assert.equal((await post('importChatGPT',{},'https://basket.test',token)).status,403)});
test('receipt photos reject requests without a valid email or explicit ChatGPT identity',async()=>{await get();const r=await IMAGE_GET(new Request('https://basket.test/api/receipt-image?id=anything'));assert.equal(r.status,401);const forged=await IMAGE_GET(new Request('https://basket.test/api/receipt-image?id=anything',{headers:{authorization:'Bearer forged'}}));assert.equal(forged.status,401)});

test('GitHub Pages can preflight authenticated calls; unrelated origins are rejected',async()=>{const req=new Request('https://basket.test/api/basket',{method:'OPTIONS',headers:{Origin:'https://donknutzen.github.io','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization, content-type, x-basket-identity'}});const r=await OPTIONS(req);assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://donknutzen.github.io');assert.match(r.headers.get('Access-Control-Allow-Headers')||'',/Authorization/);assert.equal(r.headers.get('Access-Control-Allow-Credentials'),null);assert.equal(preflight(new Request('https://basket.test/api/basket',{method:'OPTIONS',headers:{Origin:'https://evil.test'}})).status,403)});
test('Pages-origin mutations still require authenticated household membership',async()=>{user(null);const req=new Request('https://basket.test/api/basket',{method:'POST',headers:{Origin:'https://donknutzen.github.io','Content-Type':'application/json'},body:JSON.stringify({action:'renameHome',name:'Untrusted'})});const r=await POST(req);assert.equal(r.status,401);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://donknutzen.github.io');user('alex');await get();const saved=await post('saveBudget',{month:'2026-10',currency:'CAD',category:'Overall',amount:'600'},'https://donknutzen.github.io');assert.equal(saved.status,200)});
test('account configuration endpoint exposes only safe sign-up flags with Pages CORS',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({disable_signup:false,external:{email:true},mailer_autoconfirm:false,private_field:'must not be exposed'});try{const r=await CONFIG_GET(new Request('https://basket.test/api/account-config',{headers:{Origin:'https://donknutzen.github.io'}}));assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://donknutzen.github.io');assert.deepEqual(await r.json(),{available:true,signupEnabled:true,emailConfirmationRequired:true})}finally{globalThis.fetch=original}});

test('receipt notes retain additional and first purchases without scoring or clearing long-lived list items',async()=>{
 const home=(await get()).body,listId=home.lists[0].id;
 await post('addItem',{id:'long-lived',listId,name:'Rare tea',quantity:'1'});
 await post('addItem',{id:'milk',listId,name:'Milk',quantity:'2'});
 const first={...draft(),listId,lines:[{...draft().lines[0],purchaseType:'extra'}]};
 assert.equal((await post('saveReceipt',{draft:first})).status,200);
 let saved=(await get()).body;
 assert.deepEqual(saved.receipts[0].shopping,{listName:'Weekly groceries',extraItems:['Milk'],firstPurchases:['Milk']});
 assert.ok(!('rawText' in saved.receipts[0]));
 assert.ok(saved.items.every((item:any)=>item.checked===0));
 await post('clearChecked',{listId});
 await post('saveReceipt',{draft:{...draft(),id:'receipt-2',listId,lines:[{...draft().lines[0],purchaseType:'planned'}]}});
 saved=(await get()).body;
 const second=saved.receipts.find((r:any)=>r.id==='receipt-2');
 assert.deepEqual(second.shopping,{listName:'Weekly groceries',extraItems:[],firstPurchases:[]});
 assert.ok(saved.items.some((item:any)=>item.name==='Rare tea'));
 const invite=(await post('invite')).body;user('sam');await get();await post('join',{code:invite.code});
 assert.deepEqual((await get()).body.receipts.find((r:any)=>r.id==='receipt-1').shopping.extraItems,['Milk']);
});
test('receipt comparison cannot reference another household and legacy receipts stay readable',async()=>{
 const owner=(await get()).body;user('sam');await get();
 assert.equal((await post('saveReceipt',{draft:{...draft(),listId:owner.lists[0].id}})).status,404);
 user('alex');await post('saveReceipt',{draft:draft()});
 sql.prepare('UPDATE receipts SET raw_text=? WHERE id=?').run('Original OCR text','receipt-1');
 assert.equal((await get()).body.receipts[0].shopping,undefined);
});

test('food icons recognize meaningful words in descriptions, plural forms and food phrases',async()=>{
 const {foodIcon}=await import('../lib/food-icons');
 const cases={
 'Good Oranges':'orange','Please buy a bag of good oranges for breakfast':'orange',
 'Ginger':'ginger','organic fresh ginger root 100g':'ginger','marinated Ginger':'ginger','A jar of pickled ginger please':'ginger',
 'Back cottage cheese':'cheese','mature cheddar cheese':'cheese','Parmigiano Reggiano':'cheese','Pancetta':'meat','smoked bacon cubes':'meat',
 'Almonds':'almond','roasted unsalted almonds 250g':'almond','Tamari':'sauce','Tamari Sauce':'sauce','We need gluten free tamari sauce for dinner':'sauce',
 'almond milk':'milk','almond flour':'grain','cream cheese':'cheese','ginger beer':'drink','eggplant':'vegetable','tea towels':'soap','organic chickpeas':'bean',
 'Nudeln':'pasta','Vollkornnudeln 500g':'pasta','rice noodles':'pasta','Spaghetti':'pasta','Reis':'rice','basmati rice':'rice',
 'Äpfel':'apple','frische Möhren':'carrot','Käse':'cheese','Hafermilch':'milk','Hähnchen':'meat','Lachs':'fish','Tonkabohnen':'bean'
 } as const;
 for(const [name,expected]of Object.entries(cases))assert.equal(foodIcon(name),expected,name);
 assert.equal(foodIcon('Cheesecake brandless mystery'),'basket','substrings inside unrelated words do not count');
 assert.equal(foodIcon('Something unfamiliar',[],'Pantry'),'package');
});

test('shopping groups keep fruit and vegetables first and use remembered icons for order and colour',async()=>{
 const {shoppingGroup,foodGroupClass,sortShoppingItems}=await import('../lib/food-presentation');
 const names=['Nudeln','Pancetta','Äpfel','Reis','Tomaten','Milk','Lachs','Bananen','Gurke'];
 const items=names.map((name,i)=>({id:String(i),listId:'l',name,quantity:'1',category:'Other',checked:0,addedBy:'Don'}));
 const sorted=sortShoppingItems(items);
 assert.deepEqual(sorted.map(i=>shoppingGroup(i.name)),['Fruit','Fruit','Vegetables','Vegetables','Meat','Fish & seafood','Dairy & eggs','Pantry','Pantry']);
 assert.deepEqual(items.map(i=>i.name),names,'sorting must not mutate household data');
 assert.equal(foodGroupClass('Pancetta'),foodGroupClass('Hähnchen'));
 assert.notEqual(foodGroupClass('Pancetta'),foodGroupClass('Reis'));
 assert.equal(shoppingGroup('Frozen broccoli',[],'Frozen'),'Frozen');
 const prefs=[{name:'mystery',icon:'meat' as const}];
 assert.equal(shoppingGroup('Mystery',prefs),'Meat');
 assert.equal(foodGroupClass('Mystery',prefs),foodGroupClass('Pancetta'));
});
test('icon corrections are shared, survive removing and readding an item, and remain household scoped',async()=>{
 const {foodIcon}=await import('../lib/food-icons');
 const owner=(await get()).body,listId=owner.lists[0].id;
 await post('addItem',{id:'mystery',listId,name:'Mystery snack',quantity:'1'});
 assert.equal((await post('updateItem',{id:'mystery',icon:'almond'})).status,200);
 await post('updateItem',{id:'mystery',checked:true});await post('clearChecked',{listId});
 await post('addItem',{id:'again',listId,name:'MYSTERY SNACK',quantity:'2'});
 const prefs=(await get()).body.iconPreferences;
 assert.deepEqual(prefs,[{name:'mystery snack',icon:'almond' as const}]);
 assert.equal(foodIcon('Mystery snack',prefs),'almond');
 const invite=(await post('invite')).body;user('sam');await get();
 assert.deepEqual((await get()).body.iconPreferences,[]);
 assert.equal((await post('updateItem',{id:'again',icon:'meat'})).status,404);
 await post('join',{code:invite.code});
 assert.deepEqual((await get()).body.iconPreferences,prefs);
 assert.equal((await post('updateItem',{id:'again',icon:'unsupported',name:'Do not change'})).status,400);
 assert.equal((await get()).body.items.find((i:any)=>i.id==='again').name,'MYSTERY SNACK');
 await post('updateItem',{id:'again',icon:'auto'});
 assert.deepEqual((await get()).body.iconPreferences,[]);
});

test('new pasta and rice icon choices are remembered after removing and readding products',async()=>{
 const listId=(await get()).body.lists[0].id;
 for(const icon of ['pasta','rice']){
  const name='Special '+icon;
  await post('addItem',{id:icon,listId,name,quantity:'1'});
  assert.equal((await post('updateItem',{id:icon,icon})).status,200);
  await post('deleteItem',{id:icon});
  await post('addItem',{id:icon+'-again',listId,name,quantity:'1'});
  assert.ok((await get()).body.iconPreferences.some((p:any)=>p.name===name.toLowerCase()&&p.icon===icon));
 }
});

test('every selectable food icon renders a compact coloured illustration',async()=>{
 const React=await import('react');
 const {createRequire}=await import('node:module');
 const {renderToStaticMarkup}=createRequire(import.meta.url)('react-dom/server');
 const {Food}=await import('../app/art');
 const {FOOD_ICONS}=await import('../lib/food-icons');
 for(const [icon]of FOOD_ICONS){
  const markup=renderToStaticMarkup(React.createElement(Food,{name:'',icon}));
  assert.match(markup,/width="48"/,icon);
  assert.match(markup,/fill="#[0-9a-fA-F]{6}"/,icon);
  assert.doesNotMatch(markup,/lucide/,icon);
 }
});

test('common beverage brands and German descriptions use the shared drink illustration',async()=>{
 const {foodIcon}=await import('../lib/food-icons');const {shoppingGroup,shoppingCategory}=await import('../lib/food-presentation');
 for(const name of ['Cola','Coca-Cola','Coke Zero','Cola Zero 1,5 L','Red Bull','RedBull Sugarfree 250ml','Pepsi Max','Fanta Orange Zero','Sprite','Schweppes','Apfelsaft']){
  assert.equal(foodIcon(name),'drink',name);assert.equal(shoppingGroup(name),'Drinks',name);assert.equal(shoppingCategory(name),'Drinks',name);
 }
 const cases={ 'frische Äpfel':'apple','eingelegter Ingwer':'ginger','marinierter Ingwer':'ginger','Hüttenkäse':'cheese','geröstete Mandeln':'almond','Curry Leaf':'leaf','Curry Leaves':'leaf','Bay Leaf':'leaf','getrocknete Lorbeerblätter':'leaf','Curryblätter':'leaf','Soße':'sauce','Sojasoße':'sauce'};
 for(const [name,key] of Object.entries(cases))assert.equal(foodIcon(name),key,name);
 assert.equal(foodIcon('Red Bullish unknown'),'basket');
});
test('German localization preserves product names and internal category values and can return to English',async()=>{
 const {setLanguage,tr,phrase,getLanguage}=await import('../lib/i18n');
 const {money}=await import('../lib/types');
 try{
  setLanguage('de');assert.equal(getLanguage(),'de');assert.equal(tr('Shopping lists'),'Einkaufslisten');assert.equal(tr('Dairy & eggs'),'Milchprodukte und Eier');
  assert.equal(phrase('Edit {0}','My Coke Zero'),'My Coke Zero bearbeiten');
  assert.equal(tr('My custom product'),'My custom product');assert.match(money(1234,'CAD'),/12,34/);
  const home=(await get()).body;await post('addItem',{id:'de-cola',listId:home.lists[0].id,name:'Cola Zero',category:'Drinks',quantity:'1,5 L'});
  const saved=(await get()).body.items[0];assert.equal(saved.name,'Cola Zero');assert.equal(saved.category,'Drinks');assert.equal(saved.quantity,'1,5 L');
  assert.equal(tr('The numbers add up.'),'Die Beträge stimmen überein.');
  setLanguage('en');assert.equal(tr('Shopping lists'),'Shopping lists');assert.equal(phrase('Edit {0}','Cola Zero'),'Edit Cola Zero');
 }finally{setLanguage('en')}
});
