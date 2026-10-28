// Aliases use the same accent-free, lower-case spelling as normalize() in types.
// Keep this module independent so category and icon recognition share one list.
export const HOUSEHOLD_ICONS=[
 ['sponge','Sponges'],['toilet-paper','Toilet paper'],['paper-towel','Paper towels'],['toothpaste','Toothpaste'],
 ['toothbrush','Toothbrushes'],['tissue','Tissues'],['trash-bag','Trash bags'],['dish-soap','Dish soap'],
 ['detergent','Laundry detergent'],['cleaner','Cleaning spray'],['shampoo','Shampoo / shower gel'],
 ['deodorant','Deodorant'],['cloth','Cleaning cloths'],['foil','Foil / food wrap'],['soap','Soap / hand wash']
] as const;
export type HouseholdIconKey=typeof HOUSEHOLD_ICONS[number][0];
const groups:readonly [HouseholdIconKey,string][]=[
 ['sponge','sponge|sponges|kitchen sponge|kitchen sponges|dish sponge|dish sponges|cleaning sponge|cleaning sponges|scouring pad|scouring pads|scrub sponge|scrub sponges|schwamm|schwamme|schwaemme|spulschwamm|spulschwamme|spuelschwamm|spuelschwaemme|putzschwamm|putzschwamme|putzschwaemme|topfschwamm|topfschwamme|topfschwaemme|scheuerschwamm|scheuerschwamme|scheuerschwaemme'],
 ['toilet-paper','toilet paper|toilet roll|toilet rolls|toilet tissue|bathroom tissue|loo roll|loo rolls|tp|klopapier|klo papier|toilettenpapier|toiletten papier|wc papier|wc paper|klorolle|klorollen|toilettenrolle|toilettenrollen'],
 ['paper-towel','paper towel|paper towels|paper roll|paper rolls|kitchen roll|kitchen rolls|kitchen towel|kitchen towels|kitchen paper|kuchenrolle|kuchenrollen|kuechenrolle|kuechenrollen|kuchenpapier|kuechenpapier|kuchentucher|kuechentuecher|papierhandtuch|papierhandtucher|papierhandtuecher|zewa'],
 ['toothpaste','toothpaste|toothpastes|tooth paste|dental paste|zahnpasta|zahn pasta|zahncreme|zahn creme|elmex|sensodyne'],
 ['toothbrush','toothbrush|toothbrushes|tooth brush|tooth brushes|electric toothbrush|electric toothbrushes|zahnburste|zahnbursten|zahnbuerste|zahnbuersten|elektrische zahnburste|elektrische zahnbuerste'],
 ['tissue','tissue|tissues|facial tissue|facial tissues|tissue box|tissue boxes|kleenex|taschentuch|taschentucher|taschentuecher|papiertaschentuch|papiertaschentucher|papiertaschentuecher|kosmetiktuch|kosmetiktucher|kosmetiktuecher'],
 ['trash-bag','trash bag|trash bags|garbage bag|garbage bags|bin bag|bin bags|bin liner|bin liners|waste bag|waste bags|compost bag|compost bags|mullbeutel|muellbeutel|mullsack|mullsacke|mullsaecke|mulltute|mulltuten|muelltuete|muelltueten|muellsack|muellsaecke|biomullbeutel|biomuellbeutel'],
 ['dish-soap','dish soap|dishwashing liquid|dish washing liquid|dish liquid|dish detergent|washing up liquid|washing up detergent|spulmittel|spuelmittel|geschirrspulmittel|geschirrspuelmittel|handspulmittel|handspuelmittel'],
 ['detergent','laundry detergent|laundry liquid|laundry powder|washing powder|washing liquid|laundry pods|detergent pods|detergent|fabric softener|waschmittel|vollwaschmittel|colorwaschmittel|feinwaschmittel|waschpulver|flussigwaschmittel|fluessigwaschmittel|weichspuler|weichspueler|waschpods'],
 ['cleaner','cleaner|cleaners|cleaning spray|cleaning sprays|all purpose cleaner|all purpose cleaning spray|multipurpose cleaner|multi purpose cleaner|glass cleaner|window cleaner|bathroom cleaner|toilet cleaner|disinfectant|bleach|reiniger|reinigungsspray|allzweckreiniger|glasreiniger|fensterreiniger|badreiniger|wc reiniger|toilettenreiniger|desinfektionsmittel|scheuermilch'],
 ['shampoo','shampoo|shampoos|shampooing|conditioner|hair conditioner|shower gel|body wash|duschgel|duschbad|haarshampoo|haarwaschmittel|haarspulung|haarspuelung'],
 ['deodorant','deodorant|deodorants|deodorant spray|deodorant stick|antiperspirant|anti perspirant|deo|deos|deospray|deoroller|deo roller|deostick'],
 ['cloth','cleaning cloth|cleaning cloths|microfiber cloth|microfiber cloths|microfibre cloth|microfibre cloths|dishcloth|dishcloths|dish cloth|dish cloths|tea towel|tea towels|dish towel|dish towels|putztuch|putztucher|putztuecher|spultuch|spultucher|spueltuch|spueltuecher|mikrofasertuch|mikrofasertucher|mikrofasertuecher|geschirrtuch|geschirrtucher|geschirrtuecher'],
 ['foil','aluminum foil|aluminium foil|tin foil|tinfoil|foil|cling film|cling wrap|plastic wrap|food wrap|parchment paper|baking paper|wax paper|alufolie|aluminiumfolie|frischhaltefolie|backpapier'],
 ['soap','soap|soaps|hand soap|hand wash|handwash|liquid soap|bar soap|seife|seifen|handseife|flussigseife|fluessigseife|kernseife']
];
const rules=groups.flatMap(([icon,words])=>words.split('|').map(word=>({icon,word})))
 .sort((a,b)=>b.word.split(' ').length-a.word.split(' ').length||b.word.length-a.word.length);
export function householdIcon(normalizedName:string):HouseholdIconKey|undefined{
 const text=' '+normalizedName+' ';
 // A sponge cake is food; whole-word matching alone cannot distinguish it.
 if(/\bsponge (cake|cakes|finger|fingers|pudding|puddings)\b/.test(normalizedName))return undefined;
 return rules.find(({word})=>text.includes(' '+word+' '))?.icon;
}
