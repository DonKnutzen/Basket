/**
 * One opt-in personal grocery-list comparison through GroceryPulse's documented
 * no-key /api/shopper/plan endpoint. NO retailer scraping, crawling, bulk API
 * extraction or historical copying. Origin-checked, authenticated, bounded.
 * Provider explicitly refuses third-party browser origins, hence server-side.
 * The service compares HALIFAX chain medians, NOT Dartmouth individual stores.
 */
import {getBasketUser} from '../../../lib/basket-user';
import {isAllowedOrigin,withCors,preflight} from '../../../lib/cors';
export const dynamic='force-dynamic';
const allowedStores=new Set(['No Frills','Atlantic Superstore','Sobeys','Walmart','Giant Tiger','Wholesale Club']);
const json=(r:unknown,request:Request,status=200)=>withCors(Response.json(r,{status,headers:{'Cache-Control':'no-store','Vary':'Origin'}}),request);
export const OPTIONS=preflight;
export async function POST(request:Request){
  if(!isAllowedOrigin(request))return json({error:'origin_not_allowed'},request,403);
  if(!await getBasketUser(request))return json({error:'sign_in_required'},request,401);
  if(Number(request.headers.get('content-length')||0)>4500)return json({error:'list_too_large'},request,413);
  let data:unknown;
  try{data=await request.json()}catch{return json({error:'invalid_json'},request,400)}
  if(!data||typeof data!=='object')return json({error:'invalid_request'},request,400);
  const body=data as Record<string,unknown>;
  if(body.city!=='halifax')return json({error:'unsupported_city'},request,400);
  if(!Array.isArray(body.lines)||body.lines.length<1||body.lines.length>30 ||
      !body.lines.every((s:unknown)=>typeof s==='string'&&s.length>0&&s.length<=100&&!!s.trim()&& !/[\r\n]/.test(s)))
    return json({error:'invalid_lines'},request,400);
  if(body.stores!==undefined&&(!Array.isArray(body.stores)||body.stores.length>6 ||
      !body.stores.every((v:unknown)=>typeof v==='string'&&allowedStores.has(v))))
    return json({error:'invalid_stores'},request,400);
  const list=(body.lines as string[]).join('\n');
  if(list.length>3000)return json({error:'list_too_large'},request,413);
  const payload={city:'halifax',list,language:'en',...((body.stores as string[]|undefined)?.length?{stores:body.stores}: {})};
  try{
    const response=await fetch('https://grocerypulse.ca/api/shopper/plan',{
      method:'POST',
      headers:{'Accept':'application/json','Content-Type':'application/json'},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(15000),
      cache:'no-store',
    });
    if(response.status===429)return json({error:'source_rate_limited'},request,429);
    if(!response.ok)return json({error:'source_unavailable'},request,502);
    const text=await response.text();
    if(text.length>100000)return json({error:'source_response_too_large'},request,502);
    const result=JSON.parse(text) as Record<string,unknown>;
    if(result.tool!=='plan_grocery_order'||!Array.isArray(result.lines)||!Array.isArray(result.stores))
      return json({error:'unexpected_provider_response'},request,502);
    return json({source:'GroceryPulse.ca',market:'Halifax',evaluatedOn:result.evaluatedOn,
      lines:result.lines,stores:result.stores,summary:result.summary,
      recommendation:result.recommendation,comparisonUrl:result.comparisonUrl,
      caveats:result.caveats,interpretation:result.interpretation},request);
  }catch{return json({error:'source_unavailable'},request,503)}
}
