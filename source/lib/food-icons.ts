import {normalize} from './types';
export const FOOD_ICONS=[
 ['orange','Orange'],['lemon','Lemon / lime'],['apple','Apple / pear'],['banana','Banana'],['berries','Berries / tomato'],['fruit','Other fruit'],
 ['ginger','Ginger'],['carrot','Root vegetables'],['leaf','Leafy vegetables'],['vegetable','Other vegetables'],
 ['cheese','Cheese'],['milk','Milk / yogurt'],['egg','Eggs'],['meat','Meat'],['fish','Fish / seafood'],
 ['almond','Almonds'],['nut','Nuts'],['bean','Beans / lentils'],['pasta','Pasta / noodles'],['rice','Rice'],['grain','Grains / flour'],['bread','Bread / pastry'],
 ['sauce','Sauce / tamari'],['coffee','Coffee / tea'],['drink','Drinks'],['soap','Cleaning / toiletries'],['package','Packaged goods'],['basket','Basket']
] as const;
export type FoodIconKey=typeof FOOD_ICONS[number][0];
export type IconPreference={name:string;icon:FoodIconKey};
export function isFoodIcon(value:unknown):value is FoodIconKey{return FOOD_ICONS.some(([key])=>key===value)}
// Match complete words/phrases, not arbitrary substrings inside brands or other foods.
// Longer phrases take precedence: cream cheese, almond milk and ginger beer, for example.
const groups: [FoodIconKey,string][]=[
 ['pasta','pasta|noodle|noodles|nudel|nudeln|spaghetti|penne|fusilli|rigatoni|tagliatelle|macaroni|makkaroni|lasagne|lasagna|ravioli|tortellini|farfalle|linguine|udon|ramen|reisnudeln|rice noodles|egg noodles|eiernudeln|vollkornnudeln'],
 ['rice','rice|reis|basmati|jasmine rice|jasminreis|risotto|wildreis|brown rice|sushi rice|sushireis'],
 ['orange','orangen|mandarine|mandarinen|clementinen'],['lemon','zitrone|zitronen|limette|limetten'],
 ['apple','apfel|aepfel|birne|birnen'],['banana','banane|bananen'],
 ['berries','erdbeere|erdbeeren|himbeeren|blaubeeren|heidelbeeren|brombeeren|kirsche|kirschen|tomate|tomaten|cherrytomaten'],
 ['fruit','obst|fruchte|fruechte|traube|trauben|weintrauben|pfirsich|pfirsiche|nektarinen|pflaume|pflaumen|melone|wassermelone|ananas|aprikosen'],
 ['ginger','ingwer|eingelegter ingwer'],['carrot','karotte|karotten|mohre|mohren|moehre|moehren|kartoffel|kartoffeln|zwiebel|zwiebeln|knoblauch|rote bete|radieschen|susskartoffel|suesskartoffel'],
 ['leaf','salat|kopfsalat|spinat|grunkohl|gruenkohl|kohl|rucola|basilikum|petersilie|koriander'],
 ['vegetable','gemuse|gemuese|brokkoli|blumenkohl|gurke|gurken|paprika|pilz|pilze|champignons|spargel|sellerie|lauch|kurbis|kuerbis'],
 ['cheese','kase|kaese|huttenkase|huettenkaese|frischkase|frischkaese|quark'],
 ['milk','milch|joghurt|sahne|hafermilch|mandelmilch|sojamilch|kokosmilch'],['egg','ei|eier|bio eier'],
 ['meat','fleisch|rindfleisch|hahnchen|haehnchen|huhn|schweinefleisch|schinken|speck|wurst|wurstchen|wuerstchen|hackfleisch|pute|lammfleisch'],
 ['fish','fisch|lachs|thunfisch|kabeljau|forelle|garnelen|muscheln|hering'],
 ['almond','mandel|mandeln'],['nut','nusse|nuesse|walnuss|walnusse|walnuesse|haselnusse|haselnuesse|erdnusse|erdnuesse|erdnussbutter|pistazien'],
 ['bean','bohne|bohnen|linsen|kichererbsen|tonkabohne|tonkabohnen|erbsen'],
 ['grain','mehl|haferflocken|hafer|musli|muesli|getreide|bulgur|griess|gries'],
 ['bread','brot|brotchen|broetchen|vollkornbrot|toast|toastbrot|brezel|brezeln'],
 ['sauce','sosse|sauce|sojasauce|sojasosse|tomatensauce|tomatensosse|senf|mayonnaise'],
 ['coffee','kaffee|tee'],['drink','wasser|saft|apfelsaft|orangensaft|bier|wein|limonade'],
 ['soap','seife|spulmittel|spuelmittel|waschmittel|zahnpasta|schwamm|schwamme|schwaemme|kuchenrolle|kuechenrolle|toilettenpapier'],
 ['package','zucker|salz|ol|oel|olivenol|olivenoel|honig|marmelade|schokolade|backpulver|butter'],
 ['ginger','marinated ginger|pickled ginger|sushi ginger|preserved ginger'],
 ['sauce','tamari sauce|tamari|soy sauce|soya sauce|fish sauce|oyster sauce|hot sauce|chili sauce|chilli sauce|tomato sauce|pasta sauce|teriyaki|ketchup|mustard|mayonnaise|sauce'],
 ['milk','almond milk|oat milk|soy milk|soya milk|coconut milk|cashew milk|milk|yogurt|yoghurt|cream|kefir'],
 ['cheese','cottage cheese|cream cheese|cheese|cheddar|mozzarella|parmesan|parmigiano|gouda|feta|brie|camembert|ricotta|halloumi|mascarpone'],
 ['drink','ginger beer|ginger ale|apple juice|orange juice|coconut water|juice|water|soda|beer|wine|lemonade|kombucha|smoothie'],
 ['grain','almond flour|coconut flour|flour|oat|oats|oatmeal|cereal|quinoa|couscous'],
 ['orange','orange|oranges|mandarin|mandarins|clementine|clementines|tangerine|tangerines|satsuma|satsumas'],
 ['lemon','lemon|lemons|lime|limes'],['apple','apple|apples|pear|pears'],['banana','banana|bananas|plantain|plantains'],
 ['berries','berry|berries|strawberry|strawberries|raspberry|raspberries|blueberry|blueberries|blackberry|blackberries|cherry|cherries|tomato|tomatoes'],
 ['fruit','peach|peaches|nectarine|nectarines|plum|plums|grape|grapes|melon|watermelon|pineapple|mango|mangoes|kiwi|kiwis|apricot|apricots'],
 ['ginger','ginger|galangal'],['carrot','carrot|carrots|potato|potatoes|onion|onions|garlic|beet|beets|beetroot|radish|radishes|turnip|turnips|sweet potato|sweet potatoes'],
 ['leaf','avocado|avocados|spinach|lettuce|kale|cabbage|arugula|rocket|basil|parsley|cilantro|coriander'],
 ['vegetable','broccoli|cauliflower|cucumber|cucumbers|zucchini|courgette|eggplant|aubergine|pepper|peppers|mushroom|mushrooms|asparagus|celery|leek|leeks|pumpkin|squash'],
 ['egg','egg|eggs'],['meat','pancetta|bacon|prosciutto|ham|salami|sausage|sausages|chorizo|beef|chicken|pork|turkey|lamb|steak|meat|duck|mince'],
 ['fish','fish|salmon|tuna|cod|haddock|trout|shrimp|prawn|prawns|sardine|sardines|anchovy|anchovies|mussel|mussels'],
 ['almond','almond|almonds'],['nut','walnut|walnuts|cashew|cashews|hazelnut|hazelnuts|pistachio|pistachios|pecan|pecans|peanut|peanuts|peanut butter|nut|nuts'],
 ['bean','bean|beans|lentil|lentils|chickpea|chickpeas|tofu|hummus|edamame'],
 ['bread','bread|sourdough|croissant|croissants|bagel|bagels|baguette|bun|buns|roll|rolls|tortilla|tortillas|pita|naan'],
 ['coffee','coffee|tea|espresso|matcha'],['soap','tea towel|tea towels|soap|shampoo|detergent|toothpaste|cleaner|dishwashing liquid|dish soap|sponge|sponges'],
 ['package','milk chocolate|chocolate|butter|sugar|salt|oil|sauce|jam|honey|baking powder|baking soda|toilet paper|paper towel|paper towels|tissue|tissues|trash bag|trash bags']
];
const rules=groups.flatMap(([icon,words])=>words.split('|').map(word=>({icon,word}))).sort((a,b)=>b.word.split(' ').length-a.word.split(' ').length||b.word.length-a.word.length);
export function foodIcon(name:string,preferences:readonly IconPreference[]=[],category?:string):FoodIconKey{
 const key=normalize(name);const remembered=preferences.find(p=>p.name===key&&isFoodIcon(p.icon));if(remembered)return remembered.icon;
 const text=' '+key+' ';const rule=rules.find(r=>text.includes(' '+r.word+' '));if(rule)return rule.icon;
 return ({'Produce':'vegetable','Dairy & eggs':'milk','Meat & fish':'meat','Bakery':'bread','Pantry':'package','Frozen':'package','Drinks':'drink','Household':'soap'} as Record<string,FoodIconKey>)[category||'']||'basket';
}
export function iconLabel(key:FoodIconKey){return FOOD_ICONS.find(([id])=>id===key)?.[1]||'Basket'}
