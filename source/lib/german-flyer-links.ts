/** The links shown to every signed-in household are the retailer's own
 * flyer URLs from the active, imported Kiel PDFs. Never guess a PDF URL. */
import {berlinDay} from './rewe-official-weekly';
import {germanSourceUrl,type GermanOffer} from './german-central-offers';
import type {GermanDraft} from './german-offer-drafts';

export type FlyerPdfLink={retailer:'rewe'|'aldi-nord'|'penny';url:string;validUntil:string;pageCount:number};
type FlyerRecord=Pick<GermanDraft,'retailer'|'sourceUrl'|'validFrom'|'validUntil'>;
const retailerOrder=['rewe','aldi-nord','penny'] as const;
const selected=(retailer:string,stores:readonly string[])=>
 !stores.length||stores.includes(retailer==='aldi-nord'?'aldi':retailer);

/** Deduplicate multiple detected regions into one link per retailer, without
 * leaking private operator records or promising that links jump to a page. */
export function currentGermanFlyerPdfLinks(
 offers:readonly GermanOffer[],drafts:readonly FlyerRecord[],
 stores:readonly string[]=[],now=new Date()
):FlyerPdfLink[]{
 const today=berlinDay(now),out:FlyerPdfLink[]=[];
 for(const retailer of retailerOrder){
  if(!selected(retailer,stores))continue;
  const candidates=[...drafts,...offers].filter(o=>o.retailer===retailer&&o.validFrom<=today&&o.validUntil>=today);
  const seen=new Set<string>();
  const originals=candidates.map(o=>({url:germanSourceUrl(o.sourceUrl||''),until:o.validUntil}))
   .filter((x):x is {url:string;until:string}=>!!x.url);
  for(const item of originals)seen.add(item.url);
  // The most recent available imported source for this store.
  if(originals.length)out.push({retailer,url:originals[0].url,validUntil:originals[0].until,pageCount:seen.size});
 }
 return out;
}
