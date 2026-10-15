import fs from 'node:fs';
import vm from 'node:vm';
import { Alg } from 'cubing/alg';
const raw = fs.readFileSync('docs/research/catalog-sources/cube-coach-algorithms.txt','utf8');
const cases = vm.runInNewContext(raw.slice(raw.indexOf('export const cases')).replace('export const cases: Case[] =',''));
const catalog=cases.map(c=>({id:`${c.type}-${c.name}`,phase:c.type.toUpperCase(),name:String(c.name),look:'one-look',group:c.group,defaultVariantId:`${c.type}-${c.name}-1`,variants:[...new Set(c.moves.map(s=>new Alg(s).expand().toString()))].map((notation,i)=>({id:`${c.type}-${c.name}-${i+1}`,notation,sourceIds:['cube-coach'],sourceRecommendation:'not-stated',sourceOrder:i+1}))}));
fs.writeFileSync('src/data/cfop-catalog-v1.json',JSON.stringify(catalog,null,2)+'\n');
console.log(catalog.length);
const get=id=>catalog.find(c=>c.id===id);
// Reject the second source OLL 32 entry: it breaks two lower-layer pairs.
get('oll-32').variants.splice(1,1);
const add=(id,name,base,step)=>{
 const original=get(base);
 const variants=original.variants.map((v,i)=>({...v,id:`${id}-${i+1}`}));
 catalog.push({id,phase:original.phase,name,look:'two-look',step,group:'Two-look',defaultVariantId:variants[0].id,variants});
};
for(const [name,base] of [['Sune',27],['Anti-Sune',26],['H',21],['Pi',22],['U',23],['T',24],['L',25]])add(`2look-oll-${base}`,name,`oll-${base}`,'corners');
add('2look-oll-line','Line','oll-45','edges');
add('2look-oll-l','L shape','oll-44','edges');
const line=get('oll-45').variants[0].notation;
// Composition of the two sourced edge orientation operations handles the dot.
const dot=new Alg(`${line} f R U R' U' f'`).expand().toString();
catalog.push({id:'2look-oll-dot',phase:'OLL',name:'Dot',look:'two-look',step:'edges',group:'Two-look',defaultVariantId:'2look-oll-dot-1',variants:[{id:'2look-oll-dot-1',notation:dot,sourceIds:['cube-coach'],sourceRecommendation:'catalog-composition'}]});
for(const name of ['T','Y','Ua','Ub','H','Z'])add(`2look-pll-${name}`,name,`pll-${name}`,['T','Y'].includes(name)?'corners':'edges');
fs.writeFileSync('src/data/cfop-catalog-v1.json',JSON.stringify(catalog,null,2)+'\n');


