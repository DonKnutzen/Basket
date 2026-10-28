import data from './product-catalog.json';
// Local bilingual recognition catalogue. Item names and stored identities are not rewritten.
export const PRODUCT_CATALOG=data;
export const CATALOG_ICONS=[
 ['can','Canned food'],['jar','Jarred food'],['spread','Spreads'],['snack','Snacks'],['meal','Prepared meals'],['icecream','Ice cream'],['plant-protein','Plant based protein'],
 ['storage-bag','Food storage bags'],['dishwasher','Dishwasher supplies'],['brush','Dish brushes'],['gloves','Household gloves'],['floss','Dental floss'],['mouthwash','Mouthwash'],['lotion','Creams / skin care'],['razor','Razors'],['cotton','Cotton pads / swabs'],['period','Period products'],['wipes','Wet wipes'],['condom','Condoms'],['diaper','Diapers'],['baby-food','Baby food'],['baby-milk','Infant formula'],['baby-care','Baby care'],['pet-food','Pet food'],['cat-litter','Cat litter'],['pet-treat','Pet treats'],['battery','Batteries'],['candle','Candles'],['fire','Matches / lighters'],['napkin','Napkins'],['tableware','Disposable tableware'],['skewer','Toothpicks / skewers'],['charcoal','Charcoal'],['flowers','Flowers'],['card','Greeting cards'],['shopping-bag','Shopping bags']
] as const;
export type CatalogIconKey=typeof CATALOG_ICONS[number][0];
const fold=(s:string)=>s.toLowerCase().replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const index=new Map<string,typeof data[number]>();
const singular=(s:string)=>s.replace(/[a-zA-Z]+$/,word=>{
 const lower=word.toLowerCase();if(['asparagus','couscous','hummus','floss','molasses'].includes(lower))return word;
 if(lower.endsWith('ies'))return word.slice(0,-3)+'y';
 if(/(ches|shes|xes|sses|zzes)$/.test(lower))return word.slice(0,-2);
 if(['potatoes','tomatoes','mangoes'].includes(lower))return word.slice(0,-2);
 return lower.endsWith('s')&&!lower.endsWith('ss')?word.slice(0,-1):word;
});
for(const item of data)for(const name of [item.de,item.en,singular(item.en),...item.aliases,item.de.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/Ä/g,'Ae').replace(/Ö/g,'Oe').replace(/Ü/g,'Ue')]){const key=fold(name);if(key)index.set(key,item)}
const phrases=[...index].sort((a,b)=>b[0].split(' ').length-a[0].split(' ').length||b[0].length-a[0].length);
export function catalogExactProduct(name:string){return index.get(fold(name))}
const cache=new Map<string,(typeof phrases)[number]|null>();
export function catalogMatch(name:string){const key=fold(name);if(cache.has(key))return cache.get(key)||undefined;const text=' '+key+' ';const result=phrases.find(([alias])=>text.includes(' '+alias+' '));if(cache.size>=1024)cache.clear();cache.set(key,result||null);return result}
export function catalogProduct(name:string){const key=fold(name);const exact=index.get(key);if(exact)return exact;const text=' '+key+' ';return phrases.find(([alias])=>text.includes(' '+alias+' '))?.[1]}
export function catalogCategory(name:string){const group=catalogExactProduct(name)?.group;return group?({Fruit:'Produce',Vegetables:'Produce',Meat:'Meat & fish','Fish & seafood':'Meat & fish'} as Record<string,string>)[group]||group:undefined}

export function catalogIconGroup(key:string){if(!CATALOG_ICONS.some(([icon])=>icon===key))return;return key==='icecream'?'Frozen':['can','jar','spread','snack','meal','plant-protein'].includes(key)?'Pantry':'Household'}
