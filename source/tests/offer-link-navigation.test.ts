import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mustCopyExternalOfferLink} from '../lib/offer-link-navigation';

const ios='Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
test('installed iOS Basket copies retailer URLs rather than opening an unsafe second tab',()=>{
 assert.equal(mustCopyExternalOfferLink(ios,true),true);
 assert.equal(mustCopyExternalOfferLink(ios,false),false);
 assert.equal(mustCopyExternalOfferLink(ios+' ChatGPT/1.2026.286',false),true);
 assert.equal(mustCopyExternalOfferLink(ios+' CriOS/100.0',false),true);
 assert.equal(mustCopyExternalOfferLink('Mozilla/5.0 (Linux; Android 16; Pixel)',true),false);
 assert.equal(mustCopyExternalOfferLink('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605',true),false);
 assert.equal(mustCopyExternalOfferLink('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Mobile/15E148',true),true);
});
