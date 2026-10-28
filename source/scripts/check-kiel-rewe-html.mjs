// Bounded, one-time public Kiel REWE market HTML inspection. No hidden endpoint,
// no credentials, no proxy, no anti-bot bypass. Used only to validate a parser.
const url='https://www.rewe.de/marktseite/kiel/8544048/rewe-markt-holstenstr-1';
const res=await fetch(url,{headers:{Accept:'text/html','User-Agent':'BasketPersonalShopping/0.1 (+manual private price check)'},signal:AbortSignal.timeout(15000)});
console.log('STATUS',res.status,'TYPE',res.headers.get('content-type'));
if(!res.ok)process.exit(1);
const html=await res.text();
console.log('HTML length',html.length,'title',html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]);
for(const word of ['Kerrygold','Müller Milch Reis','Knaller','1,59','application/ld+json','validThrough','31.10.2026']){
 const i=html.indexOf(word);console.log('TOKEN',word,'index',i,'near',i<0?'':html.slice(Math.max(0,i-300),i+450).replace(/\s+/g,' ').slice(0,750));
}
