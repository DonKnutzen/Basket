// Complete, normalized names shared by category and illustration recognition.
export const DRINK_ICONS=[
 ['cola','Cola / cola zero'],['energy','Energy drinks'],['wine','Wine'],['beer','Beer / cider'],
 ['sparkling','Sparkling wine / champagne'],['water','Water'],['juice','Juice'],
 ['soda','Lemonade / soft drinks'],['spirits','Spirits']
] as const;
export type DrinkIconKey=typeof DRINK_ICONS[number][0];
const groups:readonly [DrinkIconKey,string][]=[
 ['cola','coca cola|coca cola zero|coca cola light|coca cola diet|coca cola zero sugar|cocacola|coke|coke zero|diet coke|cola|cola zero|cola light|pepsi|pepsi max|pepsi zero|rc cola'],
 ['energy','red bull|redbull|red bull sugarfree|red bull sugar free|red bull zero|energy|energy drink|energy drinks|energygetrank|energygetranke|energygetraenk|energygetraenke|energydrink|energydrinks|monster|rockstar|monster energy|rockstar energy|rockstar energy drink'],
 ['sparkling','sparkling wine|non alcoholic sparkling wine|alcohol free sparkling wine|sekt|schaumwein|prosecco|champagne|champagner|cremant|cava|spumante|secco|bubbly'],
 ['water','water|waters|sparkling water|still water|mineral water|spring water|soda water|club soda|seltzer|wasser|mineralwasser|sprudelwasser|sprudel|tafelwasser|stilles wasser|wasser mit kohlensaure|wasser mit kohlensaeure'],
 ['juice','juice|juices|apple juice|orange juice|grape juice|cranberry juice|tomato juice|fruit juice|coconut water|saft|safte|saefte|apfelsaft|orangensaft|traubensaft|tomatensaft|fruchtsaft|multivitaminsaft|multivitamin saft|direktsaft|smoothie|smoothies|kokoswasser'],
 ['soda','root beer|rootbeer|ginger beer|ginger ale|gingerale|lemonade|limonade|limo|soda|soft drink|soft drinks|fanta|sprite|schweppes|7up|7 up|spezi|mezzo mix|club mate|gatorade|powerade|tonic|tonic water|bitter lemon|ice tea|iced tea|eistee|icetea|kombucha'],
 ['wine','wine|wines|red wine|white wine|rose wine|non alcoholic wine|alcohol free wine|wein|weine|rotwein|weisswein|weiss wein|rosewein|rose wein|rose|merlot|cabernet sauvignon|pinot noir|pinot grigio|sauvignon blanc|chardonnay|riesling|gewurztraminer|gewuerztraminer'],
 ['beer','beer|beers|bier|biere|non alcoholic beer|alcohol free beer|alkoholfreies bier|lager|pils|pilsner|pilsener|ipa|weizenbier|weissbier|helles|dunkelbier|radler|shandy|cider|hard cider|apfelwein|heineken|corona|becks|beck s|krombacher|bitburger|warsteiner|paulaner|budweiser|bud light|coors|molson|keiths|keith s|alexander keith s'],
 ['spirits','spirits|spirituose|spirituosen|whisky|whiskey|bourbon|scotch|vodka|wodka|gin|rum|rhum|tequila|brandy|cognac|liqueur|likor|likoer|schnaps|schnapse|schnaepse|obstler']
];
const normalized=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
const rules=groups.flatMap(([icon,words])=>words.split('|').map(word=>({icon,word:normalized(word)})))
 .sort((a,b)=>b.word.split(' ').length-a.word.split(' ').length||b.word.length-a.word.length);
export function drinkIcon(normalizedName:string):DrinkIconKey|undefined{
 // Food made with a drink keeps its food illustration.
 if(/\b(vinegar|essig|weinessig|rotweinessig|weissweinessig|wine gums|beer batter|beer battered|rum raisin|rum cake|rum cakes|rumkuchen|rumrosinen|weintrauben)\b/.test(normalizedName))return undefined;
 const text=' '+normalizedName+' ';
 return rules.find(({word})=>text.includes(' '+word+' '))?.icon;
}
