import {normalize} from './types';
import {HOUSEHOLD_ICONS,householdIcon} from './household-icons';
import {DRINK_ICONS,drinkIcon} from './drink-icons';
export const FOOD_ICONS=[
 ['orange','Orange'],['lemon','Lemon / lime'],['apple','Apple / pear'],['banana','Banana'],['berries','Berries / tomato'],['fruit','Other fruit'],
 ['ginger','Ginger'],['carrot','Root vegetables'],['leaf','Leafy vegetables'],['salad','Salad / mixed greens'],['vegetable','Other vegetables'],
 ['butter','Butter'],['cheese','Cheese'],['milk','Milk / yogurt'],['egg','Eggs'],['meat','Meat'],['fish','Fish / seafood'],
 ['almond','Almonds'],['nut','Nuts'],['bean','Beans / lentils'],['pasta','Pasta / noodles'],['rice','Rice'],['grain','Grains / flour'],['bread','Bread / pastry'],
 ['flour','Flour / starch'],['baking','Baking ingredients'],['candy','Sweets / chocolate'],['seeds','Seeds / kernels'],['oil','Cooking oils'],['spice','Spices / seasonings'],['sauce','Sauce / tamari'],['coffee','Coffee / tea'],...DRINK_ICONS,['drink','Drinks'],...HOUSEHOLD_ICONS,['package','Packaged goods'],['basket','Basket']
] as const;
export type FoodIconKey=typeof FOOD_ICONS[number][0];
export type IconPreference={name:string;icon:FoodIconKey};
export function isFoodIcon(value:unknown):value is FoodIconKey{return FOOD_ICONS.some(([key])=>key===value)}
// Match complete words/phrases, not arbitrary substrings inside brands or other foods.
// Longer phrases take precedence: cream cheese, almond milk and ginger beer, for example.
const groups: [FoodIconKey,string][]=[
 ['butter','butter|salted butter|unsalted butter|sweet cream butter|cultured butter|whipped butter|vegan butter|plant based butter|margarine|gesalzene butter|ungesalzene butter|sussrahmbutter|suessrahmbutter|sauerrahmbutter|mildgesauerte butter|mildgesaeuerte butter|krauterbutter|kraeuterbutter|knoblauchbutter|butterschmalz'],
 ['salad','salat|salate|salad|salads|green salad|mixed salad|mixed greens|leaf salad|salad greens|salad mix|garden salad|caesar salad|caesarsalat|caesar salat|potato salad|pasta salad|tomato salad|cucumber salad|egg salad|chicken salad|gemischter salat|gruner salat|gruener salat|grune salate|gruene salate|blattsalat|salatmischung|salatmix|kartoffelsalat|nudelsalat|tomatensalat|gurkensalat|eiersalat'],
 ['flour','flour|flours|all purpose flour|plain flour|self raising flour|self rising flour|bread flour|cake flour|pastry flour|whole wheat flour|almond flour|coconut flour|rice flour|chickpea flour|corn flour|cornflour|corn starch|cornstarch|potato starch|tapioca starch|starch|mehl|mehle|weizenmehl|dinkelmehl|roggenmehl|vollkornmehl|mandelmehl|kokosmehl|reismehl|kichererbsenmehl|maismehl|buchweizenmehl|speisestarke|speisestaerke|maisstarke|maisstaerke|kartoffelstarke|kartoffelstaerke|tapiokastarke|robin hood|five roses|aurora flour'],
 ['baking','baking ingredients|baking supplies|baking powder|baking soda|bicarbonate of soda|sodium bicarbonate|yeast|dry yeast|instant yeast|vanilla sugar|vanilla extract|vanilla essence|cocoa powder|baking cocoa|gelatin|gelatine|corn syrup|icing sugar|powdered sugar|caster sugar|granulated sugar|brown sugar|sugar|backzutaten|backzutat|backpulver|natron|hefe|trockenhefe|frischhefe|vanillezucker|vanillinzucker|vanilleextrakt|backkakao|kakaopulver|puderzucker|zucker|gelierzucker|hagelzucker|brauner zucker|speisegelatine|sahnesteif|backaroma|redpath|fleischmanns|fleischmann s|magic baking powder|royal baking powder|dr oetker backpulver|dr oetker vanillezucker'],
 ['candy','wine gums|sweets|sweet|candy|candies|chocolate|chocolates|chocolate bar|chocolate bars|milk chocolate|dark chocolate|white chocolate|gummy bears|gummies|gummy candy|jelly beans|licorice|liquorice|sussigkeiten|suessigkeiten|schokolade|schokoladen|milchschokolade|vollmilchschokolade|zartbitterschokolade|weisse schokolade|schokoriegel|fruchtgummi|gummibarchen|gummibaerchen|bonbon|bonbons|lakritz|pralinen|haribo|goldbaren|goldbaeren|milka|ritter sport|lindt|kinder|kinder bueno|kinder schokolade|kinder schokobons|ferrero rocher|ferrero|merci|toffifee|toblerone|duplo|hanuta|knoppers|nimm2|nimm 2|katjes|maom|maoam|cadbury|dairy milk|hershey|hersheys|hershey s|reese|reeses|reese s|kitkat|kit kat|coffee crisp|aero|caramilk|crunchie|oh henry|wunderbar|smarties|skittles|twix|snickers|mars|bounty|maltesers|maynards|sour patch kids|swedish berries|swedish fish|fuzzy peach|jolly rancher|m m s|m ms'],
 ['oil','olive oil|extra virgin olive oil|virgin olive oil|sunflower oil|sunflower seed oil|canola oil|rapeseed oil|sesame oil|sesame seed oil|toasted sesame oil|avocado oil|coconut oil|vegetable oil|cooking oil|peanut oil|grapeseed oil|grape seed oil|flaxseed oil|linseed oil|pumpkin seed oil|walnut oil|oil|oils|ol|ole|oel|oele|olivenol|olivenoel|sonnenblumenol|sonnenblumenoel|rapsol|rapsoel|sesamol|sesamoel|avocadool|avocadooel|kokosol|kokosoel|pflanzenol|pflanzenoel|speiseol|speiseoel|erdnussol|erdnussoel|traubenkernol|traubenkernoel|leinol|leinoel|kurbiskernol|kuerbiskernoel|walnussol|walnussoel'],
 ['spice','spice|spices|seasoning|seasonings|mixed spices|spice mix|spice blend|gewurz|gewurze|gewurzmischung|gewurzpulver|gewuerz|gewuerze|gewuerzmischung|curry|curry powder|currypulver|garam masala|masala|cumin|cumin seeds|kreuzkummel|kreuzkuemmel|kummel|kuemmel|turmeric|kurkuma|cinnamon|zimt|zimtpulver|nutmeg|muskat|muskatnuss|clove|cloves|nelke|nelken|cardamom|kardamom|allspice|piment|saffron|safran|anise|anis|star anise|sternanis|paprika powder|ground paprika|paprikapulver|chili powder|chilli powder|chilipulver|chilli flakes|chili flakes|chiliflocken|black pepper|white pepper|ground pepper|peppercorns|schwarzer pfeffer|weisser pfeffer|pfeffer|pfefferkorner|pfefferkoerner|coriander seeds|koriandersamen|mustard seeds|senfkorner|senfkoerner|fennel seeds|fenchelsamen|salt|sea salt|salz|meersalz|oregano|thyme|thymian|rosemary|rosmarin|dill|sage|salbei|marjoram|majoran|herbes de provence'],
 ['seeds','sunflower seeds|sunflower seed|sunflower kernels|pumpkin seeds|pumpkin seed|pumpkin kernels|sesame seeds|sesame seed|sesame|chia seeds|chia seed|chia|flax seeds|flax seed|flaxseed|flaxseeds|linseed|linseeds|hemp seeds|hemp hearts|poppy seeds|seed mix|mixed seeds|seeds|seed|kernels|sonnenblumenkerne|sonnenblumenkern|kurbiskerne|kuerbiskerne|kurbiskern|sesam|sesamsamen|chiasamen|chia samen|leinsamen|leinsaat|hanfsamen|hanfherzen|mohn|mohnsamen|saat|saaten|samen|kerne|kernemischung|saatenmischung'],
 ['fruit','fruit salad|obstsalat|fruchtsalat|grapefruit|grapefruits|pomegranate|granatapfel|dattel|datteln|date|dates|feige|feigen|fig|figs|passion fruit|passionsfrucht|kokosnuss|coconut|mango|mangos|mangoes'],
 ['vegetable','sugar snap peas|snow peas|zuckerschoten|rosenkohl|brussels sprouts|rotkohl|red cabbage|weisskohl|white cabbage|kohlrabi|fennel|fenchel|pak choi|bok choy|artichoke|artichokes|artischocke|artischocken|okra'],
 ['bean','split peas|gelbe erbsen|grune erbsen|green peas|weisse bohnen|butter beans|baked beans|schwarze bohnen|black beans|kidney beans|kidneybohnen|tempeh|sojabohnen|soybeans|lupinen|lupin beans'],
 ['grain','buckwheat|buchweizen|hirse|millet|amaranth|pearl barley|graupen|farro|dinkel|spelt|grunkern|gruenkern|semolina|haferkleie|oat bran|cornmeal|maisgries|maismehl|breadcrumbs|paniermehl'],
 ['milk','creme fraiche|sour cream|saure sahne|schmand|double cream|whipping cream|sussesahne|suessesahne|kefir|buttermilk'],
 ['sauce','red wine vinegar|white wine vinegar|rotweinessig|weissweinessig|tahini|tahin|sesammus|salad dressing|salad sauce|salat dressing|salatdressing|salat sauce|salatsauce|salat sosse|salatsosse|balsamic vinegar|apple cider vinegar|vinegar|essig|apfelessig|balsamico'],
 ['leaf','curry leaf|curry leaves|bay leaf|bay leaves|curryblatter|curryblaetter|lorbeerblatt|lorbeerblatter|lorbeerblaetter|lorbeer|basilikumblatter|basil leaves'],
 ['coffee','nescafe|nespresso|cappuccino|latte macchiato'],
 ['milk','skyr|buttermilch|kondensmilch|haferdrink|mandeldrink|sojadrink'],
 ['cheese','huttenkase|hüttenkäse|cottage cheese|bergkase|bergkaese|edamer|emmentaler|ziegenkase|ziegenkaese|schafskase|schafskaese'],
 ['meat','butter chicken|hahnchenbrust|haehnchenbrust|pute|putenbrust|rinderhack|schweinehack|gehacktes|bratwurst|leberwurst|salami|pancetta'],
 ['fish','fischstabchen|fischstaebchen|garnelen|krabben|seelachs'],
 ['bean','kidneybohnen|weisse bohnen|schwarze bohnen|rote linsen|grune linsen|grüne linsen'],
 ['vegetable','salatgurke|salatgurken|eisbergsalat|eisberg salat|cherrytomaten|cocktailtomaten|auberginen|zucchini'],
 ['nut','haselnuss|haselnusse|cashewnusse|cashewkerne|erdnuss|erdnusse|walnusskerne|nussmischung|studentenfutter'],
 ['grain','mandelmehl|kokosmehl|weizenmehl|dinkelmehl|roggenmehl|polenta'],
 ['bread','laugenbrotchen|laugenbroetchen|baguette|knackebrot|knaeckebrot|vollkornbrotchen|vollkornbroetchen'],
 ['sauce','tomatenmark|tomatenpassata|passierte tomaten|pesto|remoulade|barbecue sauce|bbq sauce|sriracha'],
 ['package','nutella|oreo|marmite|chips|crisps|crackers|keks|kekse|schokoriegel|schokolade|backkakao'],
 ['pasta','pasta|noodle|noodles|nudel|nudeln|spaghetti|penne|fusilli|rigatoni|tagliatelle|macaroni|makkaroni|lasagne|lasagna|ravioli|tortellini|farfalle|linguine|udon|ramen|reisnudeln|rice noodles|egg noodles|eiernudeln|vollkornnudeln'],
 ['rice','rice|reis|basmati|jasmine rice|jasminreis|risotto|wildreis|brown rice|sushi rice|sushireis'],
 ['orange','orangen|mandarine|mandarinen|clementinen'],['lemon','zitrone|zitronen|limette|limetten'],
 ['apple','apfel|aepfel|birne|birnen'],['banana','banane|bananen'],
 ['berries','erdbeere|erdbeeren|himbeeren|blaubeeren|heidelbeeren|brombeeren|kirsche|kirschen|tomate|tomaten|cherrytomaten'],
 ['fruit','obst|fruchte|fruechte|traube|trauben|weintrauben|pfirsich|pfirsiche|nektarinen|pflaume|pflaumen|melone|wassermelone|ananas|aprikosen'],
 ['ginger','ingwer|eingelegter ingwer'],['carrot','karotte|karotten|mohre|mohren|moehre|moehren|kartoffel|kartoffeln|zwiebel|zwiebeln|knoblauch|rote bete|radieschen|susskartoffel|suesskartoffel'],
 ['leaf','kopfsalat|spinat|grunkohl|gruenkohl|kohl|rucola|basilikum|petersilie|koriander'],
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
 ['coffee','kaffee|tee'],
 ['package','zucker|salz|ol|oel|olivenol|olivenoel|honig|marmelade|schokolade|backpulver'],
 ['ginger','marinated ginger|pickled ginger|sushi ginger|preserved ginger'],
 ['sauce','tamari sauce|tamari|soy sauce|soya sauce|fish sauce|oyster sauce|hot sauce|chili sauce|chilli sauce|tomato sauce|pasta sauce|teriyaki|ketchup|mustard|mayonnaise|sauce'],
 ['milk','almond milk|oat milk|soy milk|soya milk|coconut milk|cashew milk|milk|yogurt|yoghurt|cream|kefir'],
 ['cheese','cottage cheese|cream cheese|cheese|cheddar|mozzarella|parmesan|parmigiano|gouda|feta|brie|camembert|ricotta|halloumi|mascarpone'],
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
 ['almond','almond butter|mandelmus|almond|almonds'],['nut','cashew butter|cashewmus|walnut|walnuts|cashew|cashews|hazelnut|hazelnuts|pistachio|pistachios|pecan|pecans|peanut|peanuts|peanut butter|nut|nuts'],
 ['bean','bean|beans|lentil|lentils|chickpea|chickpeas|tofu|hummus|edamame'],
 ['bread','bread|sourdough|croissant|croissants|bagel|bagels|baguette|bun|buns|roll|rolls|tortilla|tortillas|pita|naan'],
 ['coffee','coffee|tea|espresso|matcha'],
 ['package','rum cake|rum raisin|rumkuchen|rumrosinen|milk chocolate|chocolate|sugar|salt|oil|sauce|jam|honey|baking powder|baking soda|sponge cake|sponge cakes|sponge fingers']
];
const rules=groups.flatMap(([icon,words])=>words.split('|').map(word=>({icon,word:normalize(word.replace(/ß/gi,'ss'))}))).sort((a,b)=>b.word.split(' ').length-a.word.split(' ').length||b.word.length-a.word.length);
export function foodIcon(name:string,preferences:readonly IconPreference[]=[],category?:string):FoodIconKey{
 const key=normalize(name.replace(/ß/gi,'ss'));const remembered=preferences.find(p=>(p.name===normalize(name)||p.name===key)&&isFoodIcon(p.icon));if(remembered)return remembered.icon;
 const household=householdIcon(key);if(household)return household;
 const text=' '+key+' ';if(['haribo','milka','ritter sport','lindt','kinder bueno','ferrero','ferrero rocher','toffifee','toblerone','katjes','maoam','cadbury','hershey','hersheys','hershey s','reese','reeses','reese s','kitkat','kit kat','coffee crisp','caramilk','crunchie','oh henry','wunderbar','smarties','skittles','twix','snickers','maltesers','maynards','sour patch kids','jolly rancher'].some(brand=>text.includes(' '+brand+' ')))return 'candy';const beverage=drinkIcon(key);if(beverage)return beverage;const rule=rules.find(r=>text.includes(' '+r.word+' '));if(rule)return rule.icon;
 return ({'Produce':'vegetable','Dairy & eggs':'milk','Meat & fish':'meat','Bakery':'bread','Pantry':'package','Frozen':'package','Drinks':'drink','Household':'soap'} as Record<string,FoodIconKey>)[category||'']||'basket';
}
export function iconLabel(key:FoodIconKey){return FOOD_ICONS.find(([id])=>id===key)?.[1]||'Basket'}
