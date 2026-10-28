/** Presentation-only formatter for raw, private flyer text.
 * No text is sent to a server; source lines are NEVER assumed to be verified offers.
 */
export type FlyerTextSection={page:number;lines:string[];total:number;matched:number};
const PAGE=/^\[\[BASKET_FLYER_PAGE_(\d{1,3})\]\]$/;
export function groupFlyerText(text:string,filter='',onlyPrices=true,maxPerPage=160):FlyerTextSection[]{
 const query=filter.toLocaleLowerCase('de').trim();
 const sections:FlyerTextSection[]=[];
 let current:FlyerTextSection={page:1,lines:[],total:0,matched:0};
 const flush=()=>{if(current.total||current.lines.length)sections.push(current)};
 for(const original of text.split(/\r?\n/).slice(0,2400)){
  const line=original.replace(/\s+/g,' ').trim();
  if(!line)continue;
  const page=line.match(PAGE);
  if(page){flush();current={page:Number(page[1]),lines:[],total:0,matched:0};continue;}
  current.total++;
  if(query&&!line.toLocaleLowerCase('de').includes(query))continue;
  if(!query&&onlyPrices&&!/(?:\d{1,4}[.,]\d{2}|€|\bEUR\b)/i.test(line))continue;
  current.matched++;
  if(current.lines.length<maxPerPage)current.lines.push(line.slice(0,260));
 }
 flush();
 return sections;
}
