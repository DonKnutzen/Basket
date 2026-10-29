import {test} from 'node:test';
import assert from 'node:assert/strict';
import {currentGermanFlyerPdfLinks} from '../lib/german-flyer-links';

const date=new Date('2026-10-29T12:00:00Z');
const penny='https://penny-publish.blaetterkatalog.de/frontend/catalogs/1408356/3/pdf/complete.pdf';
const aldi='https://magazine.aldi-nord.de/aldi-nord/aldi-aktuell/2026/2026cw44mopromotionaldi-angebote-ab-montag-26-10-1//GetPDF.ashx';
const rewe='https://view.publitas.com/89773/3478778/pdfs/61827fae-6411-4697-a44c-0fca78d9da08.pdf';
const record=(retailer:'rewe'|'aldi-nord'|'penny',sourceUrl:string,validUntil='2026-10-30')=>({
 retailer,sourceUrl,validFrom:'2026-10-26',validUntil
});
test('all authenticated households receive direct imported PDFs for current Kiel flyer weeks',()=>{
 const drafts=[record('penny',penny),record('aldi-nord',aldi),record('rewe',rewe,'2026-10-31')];
 const found=currentGermanFlyerPdfLinks([],drafts,[],date);
 assert.deepEqual(found.map(x=>x.retailer),['rewe','aldi-nord','penny']);
 assert.deepEqual(found.map(x=>x.url),[rewe,aldi,penny]);
 assert.equal(currentGermanFlyerPdfLinks([],drafts,['penny'],date).length,1);
 assert.deepEqual(currentGermanFlyerPdfLinks([],drafts,[],new Date('2026-11-02T12:00:00Z')),[]);
});
test('never invent a PDF from an invalid retailer source, and dedupe page candidates',()=>{
 const drafts=[record('penny',penny),record('penny',penny),record('aldi-nord','https://example.org/flyer.pdf')];
 const found=currentGermanFlyerPdfLinks([],drafts,[],date);
 assert.deepEqual(found.map(x=>x.retailer),['penny']);
 assert.equal(found[0].url,penny);
});
