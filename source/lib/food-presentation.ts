import {foodIcon,type IconPreference,type FoodIconKey} from './food-icons';
import {normalize,type Item} from './types';
import {HOUSEHOLD_ICONS} from './household-icons';
import {DRINK_ICONS} from './drink-icons';

// Presentation groups do not change stored receipt or budget categories.
export const SHOPPING_GROUPS=['Fruit','Vegetables','Bakery','Meat','Fish & seafood','Dairy & eggs','Pantry','Frozen','Drinks','Household','Other'] as const;
export type ShoppingGroup=typeof SHOPPING_GROUPS[number];
const iconGroups:Partial<Record<FoodIconKey,ShoppingGroup>>={orange:'Fruit',lemon:'Fruit',apple:'Fruit',banana:'Fruit',berries:'Fruit',fruit:'Fruit',ginger:'Vegetables',carrot:'Vegetables',leaf:'Vegetables',vegetable:'Vegetables',bread:'Bakery',meat:'Meat',fish:'Fish & seafood',milk:'Dairy & eggs',cheese:'Dairy & eggs',egg:'Dairy & eggs',almond:'Pantry',nut:'Pantry',bean:'Pantry',pasta:'Pantry',rice:'Pantry',grain:'Pantry',flour:'Pantry',baking:'Pantry',candy:'Pantry',seeds:'Pantry',oil:'Pantry',spice:'Pantry',sauce:'Pantry',coffee:'Drinks',drink:'Drinks',soap:'Household'};
export function shoppingGroup(name:string,preferences:readonly IconPreference[]=[],category?:string):ShoppingGroup{
 if(category==='Frozen')return 'Frozen';
 const key=foodIcon(name,preferences,category);
 if(HOUSEHOLD_ICONS.some(([icon])=>icon===key))return 'Household';
 if(DRINK_ICONS.some(([icon])=>icon===key))return 'Drinks';
 if(key==='berries'&&/(^| )(tomato|tomatoes|tomate|tomaten|cherrytomaten)( |$)/.test(normalize(name)))return 'Vegetables';
 if(iconGroups[key])return iconGroups[key]!;
 return ({Produce:'Vegetables','Dairy & eggs':'Dairy & eggs','Meat & fish':'Meat',Bakery:'Bakery',Pantry:'Pantry',Drinks:'Drinks',Household:'Household'} as Record<string,ShoppingGroup>)[category||'']||'Other';
}
export function foodGroupClass(name:string,preferences:readonly IconPreference[]=[],category?:string){return 'food-group-'+SHOPPING_GROUPS.indexOf(shoppingGroup(name,preferences,category));}
export function shoppingCategory(name:string,preferences:readonly IconPreference[]=[],category?:string):string{
 const group=shoppingGroup(name,preferences,category);
 return ({Fruit:'Produce',Vegetables:'Produce',Meat:'Meat & fish','Fish & seafood':'Meat & fish'} as Record<string,string>)[group]||group;
}
const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
export function sortShoppingItems(items:readonly Item[],preferences:readonly IconPreference[]=[]):Item[]{
 return [...items].sort((a,b)=>SHOPPING_GROUPS.indexOf(shoppingGroup(a.name,preferences,a.category))-SHOPPING_GROUPS.indexOf(shoppingGroup(b.name,preferences,b.category))||collator.compare(foodIcon(a.name,preferences,a.category),foodIcon(b.name,preferences,b.category))||collator.compare(a.name,b.name));
}
