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
