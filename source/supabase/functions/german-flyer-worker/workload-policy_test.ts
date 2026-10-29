import {generateKeyPair,SignJWT} from 'npm:jose@6.1.3';
import {authorizeWorkload} from './workload-policy.ts';
const {privateKey,publicKey}=await generateKeyPair('RS256');
const claims={repository:'DonKnutzen/Basket',repository_id:'1435751169',repository_owner_id:'37830069',ref:'refs/heads/main',workflow_ref:'DonKnutzen/Basket/.github/workflows/central-german-flyers.yml@refs/heads/main',run_id:'1',run_attempt:'1'};
const sign=(changes:Record<string,unknown>={})=>new SignJWT({...claims,...changes}).setProtectedHeader({alg:'RS256'}).setIssuer('https://token.actions.githubusercontent.com').setAudience('basket-flyer-worker').setExpirationTime('2m').sign(privateKey);
Deno.test('GitHub workload identity requires real signatures, repository identity, main and the exact workflow',async()=>{
 await authorizeWorkload(await sign(),async()=>publicKey);
 for(const change of [{repository:'attacker/Basket'},{repository_id:'other'},{ref:'refs/pull/1/merge'},{workflow_ref:'DonKnutzen/Basket/.github/workflows/other.yml@refs/heads/main'}]){
  let denied=false;try{await authorizeWorkload(await sign(change),async()=>publicKey)}catch{denied=true}if(!denied)throw Error('Untrusted workflow accepted');
 }
 const {publicKey:other}=await generateKeyPair('RS256');
 let denied=false;try{await authorizeWorkload(await sign(),async()=>other)}catch{denied=true}if(!denied)throw Error('Wrong signature accepted');
 for(const token of ['eyJhbGciOiJub25lIn0.e30.','fake']){let denied=false;try{await authorizeWorkload(token,async()=>publicKey)}catch{denied=true}if(!denied)throw Error('Forged token accepted')}
});
