// @vitest-environment node
import { expect, test } from 'vitest';
import { ALGORITHM_CATALOG, ALGORITHM_CATALOG_SOURCES, type CatalogCase, type CatalogVariant } from './algorithm-catalog';
test('offline catalog covers every standard case', () => {
  expect(ALGORITHM_CATALOG.filter(c => c.phase === 'F2L' && c.look === 'one-look')).toHaveLength(41);
  expect(ALGORITHM_CATALOG.filter(c => c.phase === 'OLL' && c.look === 'one-look').map(c => c.name)).toEqual(Array.from({length:57}, (_,i) => String(i+1)));
  expect(ALGORITHM_CATALOG.filter(c => c.phase === 'PLL' && c.look === 'one-look')).toHaveLength(21);
});
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
test('two-look catalog supplies 10 OLL and 6 PLL cases with provenance and valid defaults', () => {
 expect(ALGORITHM_CATALOG.filter(c=>c.look==='two-look'&&c.phase==='OLL')).toHaveLength(10);
 expect(ALGORITHM_CATALOG.filter(c=>c.look==='two-look'&&c.phase==='PLL')).toHaveLength(6);
 for(const c of ALGORITHM_CATALOG){
  expect(c.variants.find(v=>v.id===c.defaultVariantId)).toBeDefined();
  expect(new Set(c.variants.map(v=>v.notation)).size).toBe(c.variants.length);
  for(const v of c.variants){expect(v.sourceIds.length).toBeGreaterThan(0); expect(v.sourceIds.every(id=>ALGORITHM_CATALOG_SOURCES.some(s=>s.id===id))).toBe(true); expect(new Alg(v.notation).toString()).toBe(v.notation);}
 }
});
test('independent cubing cubie behavior validates every claimed phase effect',async()=>{
 const p=await puzzles['3x3x3'].kpuzzle();
 const rotations=['','x','x2',"x'",'z',"z'"].flatMap(a=>['','y','y2',"y'"].map(b=>(a+' '+b).trim()));
 for(const c of ALGORITHM_CATALOG)for(const v of c.variants){
  const outcome=p.defaultPattern().applyAlg(v.notation);
  const normalized=rotations.map(r=>outcome.applyAlg(r)).find(s=>s.patternData.CENTERS.pieces.every((v,i)=>v===i))!;
  expect(p.defaultPattern().applyAlg(v.physicalTurns.join(' ')).isIdentical(normalized),v.id).toBe(true);
  const d=normalized.experimentalToTransformation()!.invert().toKPattern().patternData;
  const corners=[4,5,6,7].filter(i=>d.CORNERS.pieces[i]!==i||d.CORNERS.orientation[i]);
  const edges=[4,5,6,7,8,9,10,11].filter(i=>d.EDGES.pieces[i]!==i||d.EDGES.orientation[i]);
  if(c.phase==='F2L'){
   expect(corners.length,v.id).toBeLessThanOrEqual(1);expect(edges.length,v.id).toBeLessThanOrEqual(1);expect(corners.length+edges.length,v.id).toBeGreaterThan(0);expect(edges.every(i=>i>=8),v.id).toBe(true);
  }else{
   expect(corners,v.id).toEqual([]);expect(edges,v.id).toEqual([]);
   if(c.look==='two-look'&&c.phase==='OLL'&&c.step==='corners') expect(d.EDGES.orientation.some(Boolean),v.id).toBe(false);
   if(c.look==='two-look'&&c.phase==='OLL'&&c.step==='edges') expect(d.EDGES.orientation.filter(Boolean).length,v.id).toBe(c.name==='Dot'?4:2);
   if(c.phase==='PLL'){
    expect(d.CORNERS.orientation.some(Boolean),v.id).toBe(false);expect(d.EDGES.orientation.some(Boolean),v.id).toBe(false);
   }
  }
 }
});


test('independent case classes validate every identity, every variant, and full coverage', async()=>{
 const p=await puzzles['3x3x3'].kpuzzle();
 const rotations=['','x','x2',"x'",'z',"z'"].flatMap(a=>['','y','y2',"y'"].map(b=>(a+' '+b).trim()));
function caseKey(c: CatalogCase,v: CatalogVariant){const outcome=p.defaultPattern().applyAlg(v.notation);const t=rotations.map(r=>outcome.applyAlg(r)).find(s=>s.patternData.CENTERS.pieces.every((v,i)=>v===i))!.experimentalToTransformation()!.invert();
 const keys: string[]=[];for(const y of ['','y','y2',"y'"])for(const u of ['','U','U2',"U'"]){const d=p.defaultPattern().applyAlg(y).applyTransformation(t).applyAlg(new Alg(y).invert()).applyAlg(u).patternData;
 if(c.phase==='OLL')keys.push(JSON.stringify([d.CORNERS.orientation.slice(0,4),d.EDGES.orientation.slice(0,4)]));
 else if(c.phase==='PLL')for(const pre of ['','U','U2',"U'"]){const x=p.defaultPattern().applyAlg(pre).applyAlg(y).applyTransformation(t).applyAlg(new Alg(y).invert()).applyAlg(u).patternData;keys.push(JSON.stringify([x.CORNERS.pieces,x.EDGES.pieces]));}
 else{const badC=[4,5,6,7].find(i=>d.CORNERS.pieces[i]!==i||d.CORNERS.orientation[i]);const badE=[8,9,10,11].find(i=>d.EDGES.pieces[i]!==i||d.EDGES.orientation[i]); const cPiece=badC??([8,9,11,10].indexOf(badE!)+4);const ePiece=badE??([8,9,11,10][badC!-4]);keys.push(JSON.stringify([cPiece,d.CORNERS.pieces.indexOf(cPiece),d.CORNERS.orientation[d.CORNERS.pieces.indexOf(cPiece)],ePiece,d.EDGES.pieces.indexOf(ePiece),d.EDGES.orientation[d.EDGES.pieces.indexOf(ePiece)]]));}
 }return keys.sort()[0];}

 for(const phase of ['OLL','PLL','F2L']){
  const keys=new Set<string>();
  for(const c of ALGORITHM_CATALOG.filter(c=>c.look==='one-look'&&c.phase===phase)){
   const variants=c.variants.map(v=>caseKey(c,v));
   expect(new Set(variants).size,c.id).toBe(1);
   expect(keys.has(variants[0]),c.id).toBe(false);
   keys.add(variants[0]);
  }
 }
});




