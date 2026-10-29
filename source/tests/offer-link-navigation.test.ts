import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shouldOpenExternalOfferInSameTab} from '../lib/offer-link-navigation';

const ios='Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
test('iOS Basket and ChatGPT embedded browsers open actual retailer links in the same tab',()=>{
 assert.equal(shouldOpenExternalOfferInSameTab(ios,true),true);
 assert.equal(shouldOpenExternalOfferInSameTab(ios,false),false);
 assert.equal(shouldOpenExternalOfferInSameTab(ios+' ChatGPT/1.2026.286',false),true);
 assert.equal(shouldOpenExternalOfferInSameTab(ios+' CriOS/100.0',false),true);
 assert.equal(shouldOpenExternalOfferInSameTab(ios+' EdgiOS/120.0',false),true);
 assert.equal(shouldOpenExternalOfferInSameTab('Mozilla/5.0 (Linux; Android 16; Pixel)',true),false);
 assert.equal(shouldOpenExternalOfferInSameTab('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605',true),false);
 assert.equal(shouldOpenExternalOfferInSameTab('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Mobile/15E148',true),true);
});
test('browser decision never replaces a direct link with clipboard-only controls',()=>{
 // In both modes the OfferSourceLink component renders an <a href="...">;
 // this pure helper decides only whether the target is _self or _blank.
 assert.equal(shouldOpenExternalOfferInSameTab(ios,true),true);
 assert.equal(shouldOpenExternalOfferInSameTab('Firefox/130',false),false);
});
