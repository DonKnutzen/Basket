import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRecipe,parseIngredient,ingredientName,formatIngredient} from '../lib/recipe-parser';

test('ingredient lines split into quantity, unit and name',()=>{
 assert.deepEqual(parseIngredient('200 g Mehl'),{quantity:'200',unit:'g',name:'Mehl'});
 assert.deepEqual(parseIngredient('200g Zucker'),{quantity:'200',unit:'g',name:'Zucker'});
 assert.deepEqual(parseIngredient('2 cups flour'),{quantity:'2',unit:'cups',name:'flour'});
 assert.deepEqual(parseIngredient("1 c. à soupe d'huile"),{quantity:'1',unit:'c. à soupe',name:'huile'});
 assert.deepEqual(parseIngredient('- 1 1/2 tsp salt'),{quantity:'1 1/2',unit:'tsp',name:'salt'});
 assert.deepEqual(parseIngredient('½ Bund Petersilie'),{quantity:'½',unit:'Bund',name:'Petersilie'});
 assert.deepEqual(parseIngredient('3 Eier'),{quantity:'3',unit:'',name:'Eier'});
 assert.deepEqual(parseIngredient('2 large eggs'),{quantity:'2',unit:'',name:'large eggs'});
 assert.deepEqual(parseIngredient('Salz und Pfeffer'),{quantity:'',unit:'',name:'Salz und Pfeffer'});
 assert.deepEqual(parseIngredient('2 gousses d’ail'),{quantity:'2',unit:'gousses',name:'ail'});
 assert.equal(formatIngredient(parseIngredient('1 l Milch')),'1 l Milch');
});

test('German recipe with headers',()=>{
 const r=parseRecipe(`Pfannkuchen\nZutaten für 4 Portionen\n200 g Mehl\n3 Eier\n500 ml Milch\n1 Prise Salz\nZubereitung\n1. Mehl, Eier und Milch verrühren.\n2. Den Teig 10 Minuten ruhen\nlassen.\n3. In der Pfanne ausbacken.`);
 assert.equal(r.title,'Pfannkuchen');
 assert.equal(r.servings,'4');
 assert.deepEqual(r.ingredients.map(i=>i.name),['Mehl','Eier','Milch','Salz']);
 assert.deepEqual(r.steps,['Mehl, Eier und Milch verrühren.','Den Teig 10 Minuten ruhen lassen.','In der Pfanne ausbacken.']);
});

test('English and French recipes',()=>{
 const en=parseRecipe(`Banana Bread\nServes 8\nIngredients:\n- 2 cups flour\n- 3 ripe bananas\n- 1/2 cup sugar\nDirections\nMash the bananas. Mix everything and bake for 60 minutes at 175 °C.`);
 assert.equal(en.title,'Banana Bread');assert.equal(en.servings,'8');
 assert.deepEqual(en.ingredients,[{quantity:'2',unit:'cups',name:'flour'},{quantity:'3',unit:'',name:'ripe bananas'},{quantity:'1/2',unit:'cup',name:'sugar'}]);
 assert.equal(en.steps.length,1);
 const fr=parseRecipe(`Vinaigrette\nPour 4 personnes\nIngrédients\n1 c. à soupe d'huile\n2 c. à café de moutarde\nPréparation\nMélanger le tout.`);
 assert.equal(fr.servings,'4');
 assert.deepEqual(fr.ingredients.map(i=>[i.unit,i.name]),[['c. à soupe','huile'],['c. à café','moutarde']]);
 assert.deepEqual(fr.steps,['Mélanger le tout.']);
});

test('recipes without headers are guessed line by line',()=>{
 const r=parseRecipe('Tomato soup\n1 kg tomatoes\n1 onion\nCook the onion, add the tomatoes and simmer for 20 minutes.');
 assert.equal(r.title,'Tomato soup');
 assert.deepEqual(r.ingredients.map(i=>i.name),['tomatoes','onion']);
 assert.equal(r.steps.length,1);
});

test('ingredient names translate through the catalogue',()=>{
 assert.equal(ingredientName('Milch','en'),'Milk');
 assert.equal(ingredientName('Milch','fr'),'Lait');
 assert.equal(ingredientName('flour','original'),'flour');
 assert.equal(ingredientName('Eier','en'),'Eggs');
 assert.equal(ingredientName('Spezialzutat','de'),'Spezialzutat');
});
