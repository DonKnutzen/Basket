import type {Recipe} from './recipe-parser';
import {MAX_FLYER_IMAGE,boundedImage,ocrWorker} from './flyer-reader';
// Recipes stay on this device for now, kept per signed-in user.
const key=(userId:string)=>'basket-recipes:'+userId;
export function loadRecipes(userId:string):Recipe[]{
 try{const value=JSON.parse(localStorage.getItem(key(userId))||'[]');return Array.isArray(value)?value:[]}catch{return []}
}
export function storeRecipes(userId:string,recipes:Recipe[]){
 try{localStorage.setItem(key(userId),JSON.stringify(recipes));return true}catch{return false}
}
/** Recognizes a recipe photo on this device (English, German, French). */
export async function readRecipePhoto(file:File){
 if(!/^image\//.test(file.type)&&!/\.(?:jpe?g|png|webp|heic)$/i.test(file.name))throw new Error('Choose a photo of the recipe.');
 if(file.size>MAX_FLYER_IMAGE)throw new Error('Choose a photo no larger than 12 MB.');
 const worker=await ocrWorker(['eng','deu','fra'],false);
 try{
  const canvas=await boundedImage(file);
  const result=await worker.recognize(canvas);
  canvas.width=0;canvas.height=0;
  return String(result?.data?.text||'');
 }finally{try{await worker.terminate()}catch{}}
}
