import {catalogProduct,catalogIconGroup} from './product-catalog';
import {foodIcon,type IconPreference,type FoodIconKey} from './food-icons';
import {normalize,type Item} from './types';
import {HOUSEHOLD_ICONS} from './household-icons';
import {DRINK_ICONS} from './drink-icons';

// Presentation groups do not change stored receipt or budget categories.
export const SHOPPING_GROUPS=["Fruit", "Vegetables", "Salads & herbs", "Bakery", "Dairy & eggs", "Plant-based alternatives", "Meat", "Fish & seafood", "Pasta, rice & grains", "Pulses", "Cans & jars", "Oils & vinegar", "Sauces & condiments", "Spices", "Baking ingredients", "Breakfast & spreads", "Nuts, seeds & dried fruit", "Frozen", "Ready meals", "Snacks & sweets", "Drinks", "Household", "Personal care", "Baby & pets", "Other supermarket items", "Pantry", "Other"] as const;
export type ShoppingGroup=typeof SHOPPING_GROUPS[number];
const iconGroups:Partial<Record<FoodIconKey,ShoppingGroup>>={orange:'Fruit',lemon:'Fruit',apple:'Fruit',banana:'Fruit',berries:'Fruit',fruit:'Fruit',ginger:'Vegetables',carrot:'Vegetables',leaf:'Vegetables',salad:'Salads & herbs',vegetable:'Vegetables',bread:'Bakery',meat:'Meat',fish:'Fish & seafood',milk:'Dairy & eggs',cheese:'Dairy & eggs',butter:'Dairy & eggs',egg:'Dairy & eggs',almond:'Nuts, seeds & dried fruit',nut:'Nuts, seeds & dried fruit',bean:'Pulses',pasta:'Pasta, rice & grains',rice:'Pasta, rice & grains',grain:'Pasta, rice & grains',flour:'Baking ingredients',baking:'Baking ingredients',candy:'Snacks & sweets',seeds:'Nuts, seeds & dried fruit',oil:'Oils & vinegar',spice:'Spices',sauce:'Sauces & condiments',coffee:'Drinks',drink:'Drinks',soap:'Household'};
export function shoppingGroup(name:string,preferences:readonly IconPreference[]=[],category?:string):ShoppingGroup{
 if(category==='Frozen')return 'Frozen';
 const remembered=preferences.some(p=>p.name===normalize(name)||p.name===normalize(name.replace(/ß/gi,'ss')));const catalog=catalogProduct(name);
 const key=foodIcon(name,preferences,category);if(catalog&&!remembered&&catalog.icon===key)return catalog.displayGroup as ShoppingGroup;const extraGroup=catalogIconGroup(key);if(extraGroup)return extraGroup;
 if(HOUSEHOLD_ICONS.some(([icon])=>icon===key))return 'Household';
 if(DRINK_ICONS.some(([icon])=>icon===key))return 'Drinks';
 if(key==='berries'&&/(^| )(tomato|tomatoes|tomate|tomaten|cherrytomaten)( |$)/.test(normalize(name)))return 'Vegetables';
 if(iconGroups[key])return iconGroups[key]!;
 return ({Produce:'Vegetables','Dairy & eggs':'Dairy & eggs','Meat & fish':'Meat',Bakery:'Bakery',Pantry:'Pantry',Drinks:'Drinks',Household:'Household'} as Record<string,ShoppingGroup>)[category||'']||'Other';
}
export function foodGroupClass(name:string,preferences:readonly IconPreference[]=[],category?:string){return 'food-group-'+SHOPPING_GROUPS.indexOf(shoppingGroup(name,preferences,category));}
const storageGroups:Record<string,string>={Fruit:'Produce',Vegetables:'Produce','Salads & herbs':'Produce',Meat:'Meat & fish','Fish & seafood':'Meat & fish','Plant-based alternatives':'Pantry','Pasta, rice & grains':'Pantry',Pulses:'Pantry','Cans & jars':'Pantry','Oils & vinegar':'Pantry','Sauces & condiments':'Pantry',Spices:'Pantry','Baking ingredients':'Pantry','Breakfast & spreads':'Pantry','Nuts, seeds & dried fruit':'Pantry','Ready meals':'Pantry','Snacks & sweets':'Pantry','Personal care':'Household','Baby & pets':'Household','Other supermarket items':'Household'};
export function shoppingCategory(name:string,preferences:readonly IconPreference[]=[],category?:string):string{
 const group=shoppingGroup(name,preferences,category);
 return storageGroups[group]||group;
}
const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
export function sortShoppingItems(items:readonly Item[],preferences:readonly IconPreference[]=[]):Item[]{
 return [...items].sort((a,b)=>SHOPPING_GROUPS.indexOf(shoppingGroup(a.name,preferences,a.category))-SHOPPING_GROUPS.indexOf(shoppingGroup(b.name,preferences,b.category))||collator.compare(foodIcon(a.name,preferences,a.category),foodIcon(b.name,preferences,b.category))||collator.compare(a.name,b.name));
}
