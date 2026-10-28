import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 AUBAINE_NS_CSV,aubaineCategory,parseCsv,readAubaineWeeklyCsv,selectAubaineOffers,getAubaineOffers,
 type AubaineFetch,
} from '../lib/aubaine-offers';
const header='province,annee,semaine,du,au,enseigne,slug_enseigne,produit_cle,produit_nom,format_reference,prix_cad,articles_apparies,total_panier_cad,produits_trouves,produits_du_panier,dans_panier_comparable,total_panier_comparable_cad';
const row=(store:string,key:string,product:string,price:string,start='2026-10-22',end='2026-10-28',province='NS')=>
 [province,'2026','43',start,end,store==='sobeys-ns'?'Sobeys':'No Frills',store,key,product,
  '"2 L or 4 L"',price,'1','60.38','8','20','1',''].join(',');
const fixture=header+'\n'+row('sobeys-ns','lait','Milk','5.49')+'\n'+row('no-frills-ns','lait','Milk','4.99')+'\n'+row('sobeys-ns','beurre','Butter','5.49')+'\n';
const now=new Date('2026-10-28T14:00:00Z');
test('small published NS weekly CSV parses quoted commas and escaped quotes',()=>{
 assert.deepEqual(parseCsv('a,b\n"foo, bar","He said ""hello"""\n')[1],['foo, bar','He said "hello"']);
 assert.equal(readAubaineWeeklyCsv(fixture).length,3);
 assert.throws(()=>readAubaineWeeklyCsv('<html>Blocked</html>'),/schema/);
 assert.throws(()=>parseCsv('"unfinished'),/Unterminated/);
});
test('only intentionally generic English German and French staples are matched',()=>{
 assert.equal(aubaineCategory('Milk'),'lait');
 assert.equal(aubaineCategory('Milch'),'lait');
 assert.equal(aubaineCategory('Butter'),'beurre');
 assert.equal(aubaineCategory('Eier'),'oeufs');
 assert.equal(aubaineCategory('Karotten'),'carottes');
 for(const term of ['2 L Milk','2% Milk','Milch 2%','Milk chocolate','Tomaten','Vanilla yogurt','organic eggs','Butter 454g'])assert.equal(aubaineCategory(term),undefined,term);
});
test('NS price quotes require matching week, province, exact source retailer and positive price',()=>{
 const matches=selectAubaineOffers(fixture,'Milk',[],now);
 assert.equal(matches.length,2);
 assert.deepEqual(matches.map(r=>r.storeId),['nofrills','sobeys']);
 assert.deepEqual(matches.map(r=>r.priceCents),[499,549]);
 assert.equal(matches[0].validUntil,'2026-10-28');
 assert.equal(matches[0].sourceUrl,AUBAINE_NS_CSV);
 assert.equal(matches[0].provider,'aubaine');
 assert.equal(matches[0].observedAt,'');
 assert.equal('regularCents' in matches[0],false);
 assert.equal(selectAubaineOffers(fixture,'Milch',['sobeys'],now).length,1);
 assert.equal(selectAubaineOffers(fixture,'Milk',['walmart'],now).length,0);
 assert.equal(selectAubaineOffers(fixture,'Milk',[],new Date('2026-10-29T15:00:00Z')).length,0);
 assert.equal(selectAubaineOffers(fixture,'2% Milk',[],now).length,0);
});
test('ignore malformed fields and rows outside Nova Scotia',()=>{
 const bad=header+'\n'+row('sobeys-ns','lait','Milk','0')+'\n'
  +row('sobeys-ns','lait','Milk','3.59','2026-09-01','2026-09-08')+'\n'
  +row('sobeys-ns','lait','Milk','2.99','2026-10-22','2026-10-28','ON')+'\n'
  +row('unlicensed-shop-ns','lait','Milk','1.00')+'\n';
 assert.deepEqual(selectAubaineOffers(bad,'Milk',[],now),[]);
});
test('source fetch is a single documented CSV request, not a retailer scrape',async()=>{
 const requests:string[]=[];
 const fetcher:AubaineFetch=async(url)=>{requests.push(url);return {ok:true,text:async()=>fixture}};
 const found=await getAubaineOffers('Butter',['sobeys'],fetcher,now);
 assert.equal(found.length,1);
 assert.deepEqual(requests,[AUBAINE_NS_CSV]);
});
