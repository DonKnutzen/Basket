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
 const cases:[string,string][]=[['Erdbeeren','Fruit'],['Heidelbeeren 125g','Fruit'],['Petersilie','Veggies'],['Basilikum Topf','Veggies'],['Rucola','Veggies'],['Champignons','Veggies'],['Salami','Meat & fish'],['Thunfisch','Meat & fish'],['Gouda','Dairy & eggs'],['Butter','Dairy & eggs'],['Toastbrot','Bakery'],['Croissant','Bakery'],['Spaghetti','Pasta, rice & grains'],['Basmati Reis','Pasta, rice & grains'],['Haferflocken','Pasta, rice & grains'],['Müsli','Pasta, rice & grains'],['Kichererbsen','Pasta, rice & grains'],['Mehl','Pantry'],['Zucker','Pantry'],['Tomatensuppe','Pantry'],['Olivenöl','Oils, spices & sauces'],['Balsamico Essig','Oils, spices & sauces'],['Ketchup','Oils, spices & sauces'],['Salz','Oils, spices & sauces'],['Pfeffer schwarz','Oils, spices & sauces'],['Salatdressing','Oils, spices & sauces'],['TK Erbsen','Frozen'],['Pizza Margherita','Frozen'],['Vanilleeis','Frozen'],['Erdnüsse','Snacks & sweets'],['Kekse','Snacks & sweets'],['Mineralwasser','Drinks'],['Orangensaft','Drinks'],['Toilettenpapier','Household'],['Katzenfutter','Household'],['Duschgel','Household']];
 const wrong=cases.filter(([n,c])=>receiptCategory(n)!==c).map(([n,c])=>`${n}: ${receiptCategory(n)} != ${c}`);
 assert.deepEqual(wrong,[]);
});
