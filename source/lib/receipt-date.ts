export type DateEvidence={date:string;status:'recognized'|'ambiguous'|'missing'|'invalid'|'confirmed';candidates:string[];source?:string};
export function validPurchaseDate(value:string){
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
const iso=(y:string,m:string,d:string)=>`${y.length===2?'20'+y:y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
const months=[['januar','january','janvier','jan'],['februar','february','fevrier','feb'],['marz','maerz','march','mars','mar'],['april','avril','apr'],['mai','may'],['juni','june','juin','jun'],['juli','july','juillet','jul'],['august','aout','aug'],['september','septembre','sept','sep'],['oktober','october','octobre','okt','oct'],['november','novembre','nov'],['dezember','december','decembre','dez','dec']];
// Country is evidence, not a universal locale: Canadian slash dates remain ambiguous.
export function receiptDate(text:string,country=''):DateEvidence{
 const normalized=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const found:{source:string;candidates:string[]}[]=[];
 for(const line of normalized.split(/\r?\n/)){
  // A best-before date is not a purchase date.
  if(/best before|expiry|expiration|haltbar|mindestens|meilleur avant/.test(line))continue;
  const explicitDMY=/dd[\s/.-]*mm[\s/.-]*yy|tt[\s/.-]*mm[\s/.-]*jj/.test(normalized);
  const explicitMDY=/mm[\s/.-]*dd[\s/.-]*yy/.test(normalized);
  for(const match of line.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b|\b(\d{1,2})([./-])(\d{1,2})\5(20\d{2}|\d{2})\b/g)){
   let candidates:string[];
   if(match[1])candidates=[iso(match[1],match[2],match[3])];
   else{
    const a=match[4],b=match[6],y=match[7],dmy=iso(y,b,a),mdy=iso(y,a,b);
    candidates=explicitDMY&&!explicitMDY?[dmy]:explicitMDY&&!explicitDMY?[mdy]:match[5]==='.'||country==='DE'?[dmy]:[dmy,mdy];
   }
   found.push({source:match[0],candidates:[...new Set(candidates.filter(validPurchaseDate))]});
  }
  months.forEach((names,index)=>{
   const month='(?:'+names.join('|')+')\\.?';
   const patterns=[new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th|er)?[.\\s-]+'+month+'[,\\s-]+(20\\d{2}|\\d{2})\\b','g'),new RegExp('\\b'+month+'[\\s-]+(\\d{1,2})(?:st|nd|rd|th)?[,]?[\\s-]+(20\\d{2}|\\d{2})\\b','g')];
   for(const pattern of patterns)for(const match of line.matchAll(pattern)){
    const date=iso(match[2],String(index+1),match[1]);found.push({source:match[0],candidates:validPurchaseDate(date)?[date]:[]});
   }
  });
 }
 const candidates=[...new Set(found.flatMap(f=>f.candidates))];
 if(!found.length)return {date:'',status:'missing',candidates:[]};
 if(!candidates.length)return {date:'',status:'invalid',candidates:[],source:found.map(f=>f.source).join('; ')};
 // Conflicting dates never silently pick the first one.
 return {date:candidates.length===1?candidates[0]:'',status:candidates.length===1?'recognized':'ambiguous',candidates,source:found.map(f=>f.source).join('; ')};
}
