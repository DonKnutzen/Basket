import {catalogProduct} from './product-catalog';
// Plain-text recipe reader for pasted text, OCR output and manual input (German, English, French).
export type Ingredient={quantity:string;unit:string;name:string};
export type ParsedRecipe={title:string;servings:string;ingredients:Ingredient[];steps:string[]};
export type Recipe=ParsedRecipe & {id:string;createdAt:number;updatedAt:number};
export type IngredientLanguage='original'|'de'|'en'|'fr';

const UNITS=['cuillères à soupe','cuillère à soupe','cuilleres a soupe','cuillere a soupe','cuillères à café','cuillère à café','cuillere a cafe','c. à soupe','c. a soupe','c. à café','c. a cafe','c. à s.','c. à c.','c.à.s.','c.à.c.','c.à.s','c.à.c','càs','càc',
 'tablespoons','tablespoon','teaspoons','teaspoon','tbsp.','tbsp','tsp.','tsp','cups','cup','c.','ounces','ounce','oz.','oz','pounds','pound','lbs.','lbs','lb.','lb','pinches','pinch','cloves','clove','cans','can','slices','slice','bunch','packages','package','pkg.',
 'kg','mg','g','ml','cl','dl','l','Esslöffel','Teelöffel','EL','TL','Prisen','Prise','Päckchen','Pck.','Pkg.','Becher','Dosen','Dose','Bund','Stück','Stk.','Stk','Zehen','Zehe','Scheiben','Scheibe','Tassen','Tasse',
 'tasses','tasse','pincées','pincée','gousses','gousse','boîtes','boîte','sachets','sachet','botte','tranches','tranche','pièces','pièce'].sort((a,b)=>b.length-a.length);
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const UNIT=new RegExp('^('+UNITS.map(escape).join('|')+')(?=[\\s\'’]|$)','i');
const FRACTION='[½¼¾⅓⅔⅛]';
const QUANTITY=new RegExp('^((?:\\d+\\s+)?\\d+\\/\\d+|\\d+(?:[.,]\\d+)?(?:\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)?\\s*'+FRACTION+'?|'+FRACTION+')\\s*');
const INGREDIENTS_HEADER=/^(zutaten|ingredients?|ingrédients?|ingredients pour|einkaufsliste)\b/i;
const STEPS_HEADER=/^(zubereitung|anleitung|so geht'?s|instructions?|directions?|method|preparation|préparation|étapes|etapes|marche à suivre)\b/i;
const SERVINGS=/(?:(\d+)\s*(?:portionen|portion|personen|person|pers\.?|servings?|portions?|personnes?|stück)\b)|(?:(?:serves|makes|yield|für|pour|servings?|portionen|portions?)\s*:?\s*(\d+))/i;
const BULLET=/^\s*(?:[-–•*·▪◦]|•)\s*/;
const STEP_NUMBER=/^\s*(?:\d+\s*[.)]|(?:step|schritt|étape|etape)\s*\d+\s*[:.)-]?)\s*/i;

/** Splits "200 g Mehl", "2 cups flour" or "1 c. à soupe d'huile" into quantity, unit and name. */
export function parseIngredient(line:string):Ingredient{
 let rest=line.replace(BULLET,'').replace(/\s+/g,' ').trim();
 const quantity=rest.match(QUANTITY)?.[1]?.trim()||'';
 if(quantity)rest=rest.slice(rest.match(QUANTITY)![0].length);
 let unit='';
 const u=quantity?rest.match(UNIT):null;
 if(u){unit=u[1];rest=rest.slice(u[1].length).trim()}
 if(quantity||unit)rest=rest.replace(/^(?:de |d'|d’|of |à |a )/i,'');
 return {quantity,unit,name:rest.replace(/^[,:;]\s*/,'').trim()};
}
export function formatIngredient(i:Ingredient){return [i.quantity,i.unit,i.name].filter(Boolean).join(' ')}
const looksLikeIngredient=(line:string)=>QUANTITY.test(line.replace(BULLET,''))&&line.length<70||BULLET.test(line)&&line.length<60;

export function parseRecipe(text:string):ParsedRecipe{
 const lines=text.replace(/\r/g,'').split('\n').map(l=>l.trim()).filter(Boolean);
 let title='',servings='',section:'none'|'ingredients'|'steps'='none';
 const ingredients:Ingredient[]=[],steps:string[]=[];
 const addStep=(line:string)=>{
  const numbered=STEP_NUMBER.test(line),clean=line.replace(STEP_NUMBER,'').trim();if(!clean)return;
  const last=steps.length-1;
  // OCR breaks sentences across lines; join them unless a new numbered step starts.
  if(!numbered&&last>=0&&!/[.!?:)]$/.test(steps[last]))steps[last]+=' '+clean;else steps.push(clean);
 };
 for(const line of lines){
  const s=line.match(SERVINGS);if(s&&!servings&&line.length<60)servings=s[1]||s[2];
  if(INGREDIENTS_HEADER.test(line)){section='ingredients';continue}
  if(STEPS_HEADER.test(line)){section='steps';continue}
  if(s&&line.length<40&&!looksLikeIngredient(line))continue;
  if(section==='ingredients'){
   if(line.length>90||STEP_NUMBER.test(line)&&!looksLikeIngredient(line)){section='steps';addStep(line);continue}
   const i=parseIngredient(line);if(i.name)ingredients.push(i);continue;
  }
  if(section==='steps'){addStep(line);continue}
  // No headers seen yet: guess from the line itself.
  if(!title&&!looksLikeIngredient(line)&&line.length<80){title=line.replace(/[:.]$/,'');continue}
  if(looksLikeIngredient(line)&&!/[.!?]$/.test(line)){const i=parseIngredient(line);if(i.name)ingredients.push(i);continue}
  addStep(line);
 }
 return {title,servings,ingredients,steps};
}

/** Ingredient name in the chosen language via the product catalogue; unknown names stay as written. */
export function ingredientName(name:string,language:IngredientLanguage){
 if(language==='original')return name;
 const product=catalogProduct(name);
 return product?product[language]:name;
}
