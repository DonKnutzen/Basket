import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'npm:jose@6.1.3';
const jwks=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
export async function authorizeWorkload(token:string,key:JWTVerifyGetKey= jwks){
 const {payload:c}=await jwtVerify(token,key,{issuer:'https://token.actions.githubusercontent.com',audience:'basket-flyer-worker',algorithms:['RS256']});
 if(c.repository!=='DonKnutzen/Basket'||c.repository_id!=='1435751169'||c.repository_owner_id!=='37830069'||
  c.ref!=='refs/heads/main'||c.workflow_ref!=='DonKnutzen/Basket/.github/workflows/central-german-flyers.yml@refs/heads/main'||
  typeof c.exp!=='number'||typeof c.run_id!=='string'||typeof c.run_attempt!=='string')throw Error('Untrusted workflow');
 return c;
}
