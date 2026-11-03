import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readReceiptKind,withReceiptKind} from '../lib/receipt-shopping';

test('receipt kind survives in the raw_text envelope and can be changed',()=>{
 const raw=JSON.stringify({kind:'basket-receipt-v1',text:'ARAL',shopping:{extraItems:[],firstPurchases:[]},receiptKind:'fuel'});
 assert.equal(readReceiptKind(raw),'fuel');
 const changed=withReceiptKind(raw,'takeout');
 assert.equal(readReceiptKind(changed),'takeout');
 assert.equal(JSON.parse(changed).text,'ARAL');
 assert.equal(readReceiptKind(withReceiptKind('plain old text','other')),'other');
 assert.equal(readReceiptKind('plain old text'),undefined);
 assert.equal(readReceiptKind(JSON.stringify({kind:'basket-receipt-v1',receiptKind:'bogus'})),undefined);
});
