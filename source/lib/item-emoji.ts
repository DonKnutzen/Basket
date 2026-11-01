import {normalize} from './types';

// Trilingual (English / German / French) word list for items without a dedicated
// illustration: specific fruit and vegetables plus everyday non-food purchases.
// Whole words only; simple plurals (-s, -es, -n, -en, -e) match automatically.
const ENTRIES:[string,string][]=[
 // Fruit
 ['🍇','grape|weintraube|traube|raisin frais'],
 ['🍉','watermelon|wassermelone|pasteque'],
 ['🍈','melon|honeydew|honigmelone|melone|cantaloupe|cantaloup|galia'],
 ['🍍','pineapple|ananas'],
 ['🥭','mango|mangoes|mangue'],
 ['🍐','pear|birne|poire|nashi'],
 ['🍑','peach|peaches|pfirsich|peche|nectarine|nektarine|apricot|aprikose|abricot'],
 ['🍒','cherry|cherries|kirsche|cerise'],
 ['🍓','strawberry|strawberries|erdbeere|fraise'],
 ['🫐','blueberry|blueberries|heidelbeere|blaubeere|myrtille|bleuet'],
 ['🥝','kiwi|kiwis'],
 ['🥥','coconut|kokosnuss|kokos|noix de coco'],
 ['🫒','olive|oliven'],
 ['🥑','avocado|avocados|avocat'],
 // Vegetables
 ['🍅','tomato|tomatoes|tomate|rispentomate|cherry tomato|cherrytomate'],
 ['🍠','sweet potato|sweet potatoes|susskartoffel|suesskartoffel|patate douce|yam'],
 ['🥔','potato|potatoes|kartoffel|pomme de terre|pommes de terre|patate'],
 ['🧅','onion|zwiebel|oignon|shallot|schalotte|echalote|spring onion|fruhlingszwiebel|fruehlingszwiebel|scallion'],
 ['🧄','garlic|knoblauch|ail'],
 ['🥒','cucumber|gurke|salatgurke|concombre|zucchini|zucchino|courgette|pickle|cornichon'],
 ['🫑','bell pepper|sweet pepper|paprika|paprikaschote|poivron|capsicum'],
 ['🌶️','chili|chilli|chilischote|jalapeno|piment|habanero|peperoncino'],
 ['🥦','broccoli|brokkoli|brocoli'],
 ['🥬','lettuce|cabbage|kohl|weisskohl|rotkohl|chou|bok choy|pak choi|kale|grunkohl|gruenkohl|chard|mangold|blette|spinach|spinat|epinard|leek|lauch|poireau|celery|sellerie|celeri|romaine|kopfsalat|laitue|endive|chicoree'],
 ['🌽','corn|mais|maiskolben|epi de mais'],
 ['🍆','eggplant|aubergine'],
 ['🍄','mushroom|champignon|pilz|shiitake|portobello'],
 ['🫛','peas|pea|erbse|petits pois|pois|edamame|snap pea|zuckerschote|green bean|grune bohne|gruene bohne|haricot vert'],
 ['🎃','pumpkin|kurbis|kuerbis|citrouille|potiron|squash|courge|butternut'],
 ['🌱','asparagus|spargel|asperge|sprouts|sprossen|germes'],
 ['🌿','basil|basilikum|basilic|parsley|petersilie|persil|cilantro|koriander|coriandre|dill|aneth|mint|minze|menthe|rosemary|rosmarin|romarin|thyme|thymian|thym|sage|salbei|sauge|chives|schnittlauch|ciboulette|herbs|krauter|kraeuter|fines herbes'],
 ['🥜','peanut|erdnuss|arachide|cacahuete'],
 ['🌰','chestnut|kastanie|marone|chataigne|marron'],
 // Prepared food
 ['🍰','cake|kuchen|torte|gateau'],
 ['🍕','pizza'],
 ['🍔','burger|hamburger'],
 ['🌮','taco|tacos|tortilla'],
 ['🧊','ice cubes|eiswurfel|eiswuerfel|glacons|glacon'],
 // Non-food
 ['🔌','cable|cord|kabel|ladekabel|charger|ladegerat|ladegeraet|chargeur|adapter|adaptateur|plug|stecker|usb|hdmi|extension cord|verlangerungskabel|rallonge|power bar|steckdosenleiste|multiprise'],
 ['💡','light bulb|bulb|gluhbirne|gluehbirne|leuchtmittel|lamp|lampe|ampoule|led'],
 ['🎧','headphones|earbuds|earphones|kopfhorer|kopfhoerer|ecouteurs|casque'],
 ['📱','phone|handy|smartphone|telephone|phone case|handyhulle|handyhuelle|sim card|sim karte'],
 ['💻','laptop|computer|ordinateur|mouse|maus|souris|keyboard|tastatur|clavier|webcam'],
 ['🖨️','printer|drucker|imprimante|ink|tinte|druckerpatrone|toner|encre|cartridge'],
 ['🖊️','pen|kuli|kugelschreiber|stylo|pencil|bleistift|crayon|marker|textmarker|feutre|highlighter|surligneur'],
 ['📓','notebook|heft|notizbuch|cahier|notepad|block|bloc notes|envelope|umschlag|briefumschlag|enveloppe'],
 ['📎','tape|klebeband|ruban adhesif|scotch|glue|kleber|klebstoff|colle|stapler|tacker|agrafeuse|paper clips|buroklammern|trombones'],
 ['✂️','scissors|schere|ciseaux'],
 ['🩹','band aid|bandaid|bandage|pflaster|pansement|plaster'],
 ['💊','medicine|medication|pills|tablets|vitamins|vitamin|vitamine|ibuprofen|aspirin|aspirine|paracetamol|tylenol|advil|medikament|tabletten|medicament|cough syrup|hustensaft|sirop'],
 ['🧦','socks|socken|chaussettes'],
 ['👕','shirt|t shirt|tshirt|hemd|chemise|clothes|kleidung|vetements|pullover|sweater|pull|hoodie'],
 ['👟','shoes|schuhe|chaussures|sneakers|baskets|boots|stiefel|bottes'],
 ['🧤','winter gloves|mittens|handschuhe|gants|moufles'],
 ['🧣','scarf|schal|echarpe|beanie|mutze|muetze|tuque|bonnet'],
 ['🎁','gift|present|geschenk|cadeau|wrapping paper|geschenkpapier|papier cadeau'],
 ['🎈','balloon|luftballon|ballon'],
 ['🧸','toy|toys|spielzeug|jouet|teddy|lego|puzzle'],
 ['📚','book|buch|bucher|buecher|livre|magazine|zeitschrift|newspaper|zeitung|journal|comic|bd'],
 ['🔧','tool|werkzeug|outil|screwdriver|schraubenzieher|schraubendreher|tournevis|hammer|marteau|wrench|schraubenschlussel|cle a molette|drill|bohrmaschine|perceuse'],
 ['🔩','screws|schrauben|vis|nails|nagel|naegel|clous|dubel|duebel|cheville|bolts'],
 ['🎨','paint|wandfarbe|peinture|paintbrush|pinsel|pinceau|roller|farbrolle'],
 ['🧹','broom|besen|balai|mop|wischmopp|serpillere|dustpan|kehrschaufel'],
 ['🪣','bucket|eimer|seau'],
 ['🪴','houseplant|zimmerpflanze|plante verte|potting soil|blumenerde|terreau|seeds packet|blumentopf|pot de fleurs'],
 ['🎄','christmas tree|weihnachtsbaum|tannenbaum|sapin de noel|ornaments|christbaumkugeln'],
 ['⛽','gas|fuel|benzin|tanken|essence|diesel|gasoline|petrol'],
 ['🚗','windshield washer|washer fluid|scheibenwischwasser|lave glace|motor oil|motorol|motoroel|huile moteur|car wash|autowasche|lavage auto'],
 ['🎫','ticket|fahrkarte|billet|eintrittskarte'],
 ['🔑','key|keys|schlussel|schluessel|cle|cles'],
 ['👜','bag|tasche|sac|backpack|rucksack|sac a dos'],
 ['🧳','suitcase|koffer|valise'],
 ['☂️','umbrella|regenschirm|parapluie'],
 ['🧵','thread|faden|garn|fil a coudre|sewing kit|nahzeug|naehzeug|yarn|wolle|laine'],
 ['🔦','flashlight|taschenlampe|lampe de poche|torch'],
 ['🗑️','trash can|garbage can|mulleimer|muelleimer|abfalleimer|poubelle'],
 ['🍼','baby bottle|flaschchen|flaeschchen|biberon|pacifier|schnuller|tetine'],
 ['🧯','fire extinguisher|feuerloscher|feuerloescher|extincteur|smoke detector|rauchmelder|detecteur de fumee'],
];
const PLURALS=['','s','es','n','en','e','x'];
const index:[string[],string][]=ENTRIES.map(([emoji,words])=>[words.split('|').map(w=>normalize(w)),emoji]);
/** Emoji for an item name in English, German or French; undefined when nothing fits. Longest phrase wins. */
export function itemEmoji(name:string):string|undefined{
 const text=' '+normalize(name.replace(/ß/g,'ss'))+' ';
 let best:{emoji:string;length:number}|undefined;
 for(const [words,emoji] of index)for(const w of words){
  if(best&&w.length<=best.length)continue;
  if(PLURALS.some(p=>text.includes(' '+w+p+' ')))best={emoji,length:w.length};
 }
 return best?.emoji;
}
/** Generic illustration keys that a more specific emoji may replace. */
export const GENERIC_ICON_KEYS=new Set(['fruit','apple','vegetable','package','basket','drink']);
export function isGrapefruit(name:string){return /\b(grapefruits?|pampelmusen?|pomelos?|pamplemousses?)\b/.test(normalize(name))}
