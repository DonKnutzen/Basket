import {test} from 'node:test';
import assert from 'node:assert/strict';
import {itemEmoji,isGrapefruit} from '../lib/item-emoji';
import {inferCategory} from '../lib/types';
import {catalogProduct} from '../lib/product-catalog';

const render=async(name:string)=>{
 const React=await import('react');
 const {createRequire}=await import('node:module');
 const {renderToStaticMarkup}=createRequire(import.meta.url)('react-dom/server');
 const {Food}=await import('../app/art');
 return renderToStaticMarkup(React.createElement(Food,{name})) as string;
};

test('grapefruit gets its own drawing in every language',async()=>{
 for(const name of ['Grapefruit','Pampelmuse','pamplemousses'])assert.ok(isGrapefruit(name),name);
 assert.ok(!isGrapefruit('grapes'));
 assert.match(await render('Grapefruit'),/#ec7a6c/);
});

test('specific fruit, vegetables and non-food items show a fitting emoji',async()=>{
 const cases:Record<string,string>={'aux cable':'🔌','Ladekabel':'🔌','chargeur':'🔌','mango':'🥭','fraises':'🍓','Erdbeeren':'🍓','tomates':'🍅','batteries AA':''};
 for(const [name,emoji] of Object.entries(cases))if(emoji)assert.equal(itemEmoji(name),emoji,name);
 assert.match(await render('aux cable'),/🔌/);
});

test('emoji icons are painted, not inherited fill="none" from the svg',async()=>{
 const markup=await render('aux cable');
 const tag=markup.match(/<text[^>]*>/)?.[0]||'';
 assert.match(tag,/ fill="(?!none)[^"]+"/,tag);
 assert.match(tag,/ stroke="none"/,tag);
 assert.match(tag,/font-family="[^"]*Emoji/,tag);
});

test('French item names find the catalogue and the right category',()=>{
 const cases:Record<string,string>={pomme:'Produce',lait:'Dairy & eggs',poulet:'Meat & fish','poitrine de poulet':'Meat & fish',fromage:'Dairy & eggs','fromage râpé':'Dairy & eggs',pain:'Bakery',baguette:'Bakery','papier toilette':'Household','huile d\'olive':'Pantry'};
 for(const [name,category] of Object.entries(cases))assert.equal(inferCategory(name),category,name);
 assert.equal(catalogProduct('pomme')?.en,'Apples');
 // German "Pommes" (fries) keeps priority over the French plural.
 assert.equal(catalogProduct('Pommes')?.en,'French fries');
 assert.equal(catalogProduct('lait')?.en,'Milk');
 assert.equal(catalogProduct('Äpfel')?.en,'Apples');
 assert.equal(catalogProduct('pain relief')?.en,undefined);
});
