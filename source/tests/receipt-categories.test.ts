import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RECEIPT_CATEGORIES,receiptCategory} from '../lib/types';
import {parseReceipt} from '../lib/receipt-parser';

test('receipts split produce into fruit, veggies and processed food',()=>{
 assert.ok(!RECEIPT_CATEGORIES.includes('Produce'));
 assert.deepEqual(RECEIPT_CATEGORIES.slice(0,3),['Fruit','Veggies','Processed Food']);
 assert.equal(receiptCategory('Bananas'),'Fruit');
 assert.equal(receiptCategory('Äpfel'),'Fruit');
 assert.equal(receiptCategory('Carrots'),'Veggies');
 assert.equal(receiptCategory('Oka Mushrooms'),'Veggies');
 assert.equal(receiptCategory('Rooster Sushi'),'Processed Food');
 assert.equal(receiptCategory('Three Cheese Dinner'),'Processed Food');
 assert.equal(receiptCategory('Milk'),'Dairy & eggs');
 assert.deepEqual(parseReceipt('BANANAS 1.29\nCARROTS 2.00\nROOSTER SUSHI 4.00\nTOTAL 7.29').lines.map(l=>l.category),['Fruit','Veggies','Processed Food']);
});

test('receipts sort groceries into the twelve shopping categories',()=>{
 for(const c of ['Fruit','Veggies','Meat & fish','Dairy & eggs','Bakery','Pasta, rice & grains','Pantry','Oils, spices & sauces','Frozen','Snacks & sweets','Drinks','Household'])assert.ok(RECEIPT_CATEGORIES.includes(c),c);
 const cases:[string,string][]=[['Erdbeeren','Fruit'],['Heidelbeeren 125g','Fruit'],['Petersilie','Veggies'],['Basilikum Topf','Veggies'],['Rucola','Veggies'],['Champignons','Veggies'],['Salami','Meat & fish'],['Thunfisch','Meat & fish'],['Gouda','Dairy & eggs'],['Butter','Dairy & eggs'],['Toastbrot','Bakery'],['Croissant','Bakery'],['Spaghetti','Pasta, rice & grains'],['Basmati Reis','Pasta, rice & grains'],['Haferflocken','Pasta, rice & grains'],['Müsli','Pasta, rice & grains'],['Kichererbsen','Pasta, rice & grains'],['Mehl','Pantry'],['Zucker','Pantry'],['Tomatensuppe','Pantry'],['Olivenöl','Oils, spices & sauces'],['Balsamico Essig','Oils, spices & sauces'],['Ketchup','Oils, spices & sauces'],['Salz','Oils, spices & sauces'],['Pfeffer schwarz','Oils, spices & sauces'],['Salatdressing','Oils, spices & sauces'],['TK Erbsen','Frozen'],['Pizza Margherita','Frozen'],['Vanilleeis','Frozen'],['Erdnüsse','Fruit'],['Kekse','Snacks & sweets'],['Mineralwasser','Drinks'],['Orangensaft','Drinks'],['Toilettenpapier','Household'],['Katzenfutter','Household'],['Duschgel','Household']];
 const wrong=cases.filter(([n,c])=>receiptCategory(n)!==c).map(([n,c])=>`${n}: ${receiptCategory(n)} != ${c}`);
 assert.deepEqual(wrong,[]);
});

test('plant-based items get the vegetarian/vegan alternatives category after dairy',()=>{
 const V='Vegetarian/Vegan alternatives';
 for(const n of ['Reismilch','Rice Milk','Haferdrink','Beyond Meat Burger','Tofu natur','Veganer Aufschnitt'])assert.equal(receiptCategory(n),V,n);
 assert.ok(RECEIPT_CATEGORIES.includes(V));
 const i=RECEIPT_CATEGORIES.indexOf('Dairy & eggs');
 assert.deepEqual(RECEIPT_CATEGORIES.slice(i,i+5),['Dairy & eggs',V,'Meat & fish','Snacks & sweets','Drinks']);
});

test('receipt nuts and seeds land in Fruit/Nuts in any language, nut products stay apart',()=>{
 for(const name of['Sonnenblumenkerne','SONNENBL.KERNE','Sunflower Seeds','Kürbiskerne','Pinienkerne','Mandeln','Mandeln gemahlen','Almonds','Walnüsse','Haselnüsse','Cashewkerne','Erdnüsse geröstet','Peanuts','Pistazien','Studentenfutter','Chiasamen','Leinsamen','Amandes','Noix','Graines de tournesol','Almendras','Pipas de girasol','Mandorle','Semi di girasole'])assert.equal(receiptCategory(name),'Fruit',name);
 assert.equal(receiptCategory('Mandelmilch'),'Vegetarian/Vegan alternatives');
 assert.equal(receiptCategory('Almond Milk'),'Vegetarian/Vegan alternatives');
 assert.equal(receiptCategory('Sonnenblumenöl'),'Oils, spices & sauces');
 assert.equal(receiptCategory('Cumin Seeds'),'Oils, spices & sauces');
 assert.equal(receiptCategory('Erdnussbutter'),'Pantry');
});
