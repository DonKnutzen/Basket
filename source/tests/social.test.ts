import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isMissingSchema,friendFromRow,recipeFromRow,recipeRow,recipePayload,validEmail} from '../lib/social';

test('a missing friends/recipes schema is recognised instead of shown as an error',()=>{
 assert.ok(isMissingSchema({code:'PGRST205',message:"Could not find the table 'public.recipes' in the schema cache"}));
 assert.ok(isMissingSchema({code:'42P01',message:'relation "public.inbox" does not exist'}));
 assert.ok(isMissingSchema({code:'PGRST202',message:'Could not find the function public.basket_respond_friend'}));
 assert.ok(!isMissingSchema({code:'42501',message:'new row violates row-level security policy'}));
 assert.ok(!isMissingSchema(null));
});

test('friendship rows read from both sides',()=>{
 const row={id:'f1',requester:'a',requester_email:'a@example.com',requester_name:'Alex',addressee_email:'b@example.com',addressee:'b',addressee_name:'Sam',status:'accepted'};
 assert.deepEqual(friendFromRow(row,'a'),{id:'f1',status:'accepted',incoming:false,email:'b@example.com',name:'Sam',userId:'b'});
 assert.deepEqual(friendFromRow(row,'b'),{id:'f1',status:'accepted',incoming:true,email:'a@example.com',name:'Alex',userId:'a'});
 assert.equal(friendFromRow({...row,addressee:null,status:'pending'},'a').userId,null);
 assert.ok(validEmail(' sam@example.com '));assert.ok(!validEmail('sam@'));
});

test('recipes round-trip through account rows and payloads',()=>{
 const recipe={id:'r1',title:'Pfannkuchen',servings:'4',ingredients:[{quantity:'200',unit:'g',name:'Mehl'}],steps:['Verrühren.'],createdAt:1,updatedAt:Date.parse('2026-11-01T10:00:00Z')};
 const row=recipeRow(recipe,'b1');
 assert.equal(row.book_id,'b1');assert.equal(row.updated_at,'2026-11-01T10:00:00.000Z');
 const back=recipeFromRow({...row,owner:'a',created_at:'2026-11-01T09:00:00Z'});
 assert.deepEqual([back.title,back.servings,back.ingredients,back.steps,back.bookId,back.owner],['Pfannkuchen','4',recipe.ingredients,recipe.steps,'b1','a']);
 assert.deepEqual(Object.keys(recipePayload(recipe)).sort(),['ingredients','servings','steps','title']);
});

test('the friends migration protects every new table with row level security',()=>{
 const sql=readFileSync('supabase/migrations/20261101120000_friends_inbox_recipes.sql','utf8');
 for(const table of ['friendships','inbox','recipe_books','recipe_book_members','recipes']){
  assert.match(sql,new RegExp('create table public\\.'+table+' \\('),table);
  assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security'),table);
 }
 assert.match(sql,/auth\.jwt\(\)->>'email'/);
 assert.doesNotMatch(sql,/to anon/);
 assert.match(sql,/basket_private\.are_friends\(\(select auth\.uid\(\)\),recipient\)/);
});
