export type DateEvidence={date:string;status:'recognized'|'ambiguous'|'missing'|'invalid'|'confirmed';candidates:string[];source?:string};
export function validPurchaseDate(value:string){
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
const iso=(y:string,m:string,d:string)=>`${y.length===2?'20'+y:y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
const months=[['januar','january','janvier','jan'],['februar','february','fevrier','feb'],['marz','maerz','march','mars','mar'],['april','avril','apr'],['mai','may'],['juni','june','juin','jun'],['juli','july','juillet','jul'],['august','aout','aug'],['september','septembre','sept','sep'],['oktober','october','octobre','okt','oct'],['november','novembre','nov'],['dezember','december','decembre','dez','dec']];
// Country is evidence, not a universal locale: Canadian slash dates remain ambiguous,
// except for national chains whose registers always print month first (10/28/26).
const MONTH_FIRST_CHAINS=/walmart|superstore|no frills|sobeys|costco|foodland|giant tiger|shoppers|dollarama|lawtons|independent|freshco|bulk barn|save easy|nslc|loblaws|food basics|gateway|irving|esso|petro-canada|shell|ultramar|circle k|pioneer/i;
export function receiptDate(text:string,country='',store='',scan=new Date()):DateEvidence{
 const monthFirst=country==='CA'&&MONTH_FIRST_CHAINS.test(store);
 const normalized=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const found:{source:string;candidates:string[]}[]=[];
 for(const raw of normalized.split(/\r?\n/)){
  // A best-before date is not a purchase date.
  if(/best before|expiry|expiration|haltbar|mindestens|meilleur avant/.test(raw))continue;
  // 24h times (always with colons) are not dates: OCR may glue "14:35" onto "02.11.26".
  const time='(?:[01]?\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?';
  // OCR spaces out dotted dates: "Datum: 02. 11. 26", "02. 11.26".
  const line=raw.replace(/\b(\d{1,2})\.\s?(\d{1,2})\.\s?(20\d{2}|\d{2})(?=\D|$)/g,'$1.$2.$3').replace(/\b(\d{1,2}\.\d{1,2}\.\d{2})(\d{1,2}:\d{2})/g,'$1 $2').replace(new RegExp('\\b'+time+'\\s*uhr','g'),' ').replace(new RegExp('(\\d{1,2}[./-]\\d{1,2}[./-](?:20)?\\d{2})[\\s,/]+'+time,'g'),'$1');
  const explicitDMY=/dd[\s/.-]*mm[\s/.-]*yy|tt[\s/.-]*mm[\s/.-]*jj/.test(normalized);
  const explicitMDY=/mm[\s/.-]*dd[\s/.-]*yy/.test(normalized);
  for(const match of line.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b|\b(\d{1,2})([./-])(\d{1,2})\5(20\d{2}|\d{2})\b/g)){
   let candidates:string[];
   if(match[1])candidates=[iso(match[1],match[2],match[3])];
   else{
    const a=match[4],b=match[6],y=match[7],dmy=iso(y,b,a),mdy=iso(y,a,b);
    candidates=explicitDMY&&!explicitMDY?[dmy]:explicitMDY&&!explicitDMY?[mdy]:match[5]==='.'||country==='DE'?[dmy]:monthFirst?[mdy]:[dmy,mdy];
    // Card terminals at those chains print YY/MM/DD ("DateTime: 26/10/31") when month-first cannot be a date.
    if(monthFirst&&a.length===2&&y.length===2&&!validPurchaseDate(mdy))candidates=[iso(a,b,y)];
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
 let candidates=[...new Set(found.flatMap(f=>f.candidates))];
 // Several OCR passes of one photo can disagree ("2006-10-31" next to "2026-10-31"): a reading
 // in the future or more than a year before the scan loses against a plausible one.
 if(candidates.length>1&&new Set(found.map(f=>f.source)).size>1){
  const day=(offset:number)=>{const d=new Date(scan.getFullYear(),scan.getMonth(),scan.getDate()+offset);return iso(String(d.getFullYear()),String(d.getMonth()+1),String(d.getDate()))};
  const plausible=candidates.filter(c=>c>=day(-366)&&c<=day(1));if(plausible.length)candidates=plausible;
 }
 if(!found.length){
  // OCR can garble month and year after "Datum:" while the day survives ("Datum: 02.   a ein Ju").
  // Only a printed day from the past week is trusted, read against the scan date.
  const day=normalized.match(/\bdatum:?\s*(\d{1,2})\.(?!\s*\d)/);
  if(day)for(let back=0;back<7;back++){
   const d=new Date(scan.getFullYear(),scan.getMonth(),scan.getDate()-back);
   if(d.getDate()===Number(day[1])){const date=iso(String(d.getFullYear()),String(d.getMonth()+1),String(d.getDate()));return {date,status:'recognized',candidates:[date],source:day[0]};}
  }
  return {date:'',status:'missing',candidates:[]};
 }
 if(!candidates.length)return {date:'',status:'invalid',candidates:[],source:found.map(f=>f.source).join('; ')};
 // Conflicting dates never silently pick the first one.
 return {date:candidates.length===1?candidates[0]:'',status:candidates.length===1?'recognized':'ambiguous',candidates,source:found.map(f=>f.source).join('; ')};
}
