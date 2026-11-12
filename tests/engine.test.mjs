import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RULES } from '../src/rules.mjs';
import { chars, normAnswer, resultMatches, requiredRules, availableWords, chooseWords, changeMatches, gradeChange, isComplete, validationErrors, coverage, newCardState, checkResult, applyChange } from '../src/engine.mjs';
const dataset = JSON.parse(readFileSync(new URL('../data/pilot.json', import.meta.url),'utf8'));
const words=dataset.words;
const word=id=>words.find(x=>x.id===`xl-${id}`);
test('Banco íntegro, identificado y filológicamente referenciado',()=>{
 assert.deepEqual(validationErrors(dataset),[]);
 assert.ok(words.length>=30 && words.length<=80);
 assert.equal(words.length,new Set(words.map(x=>x.id)).size);
 assert.ok(words.every(x=>x.source.file==='banco_evolucion_fonetica_con_filtro_didactico.xlsx'));
});
test('20 normas oficiales exactamente, cubiertas todas',()=>{
 assert.equal(RULES.length,20);
 assert.equal(new Set(RULES.map(x=>x.id)).size,20);
 const report=coverage(words);
 assert.deepEqual(Object.keys(report).sort(),RULES.map(x=>x.id).sort());
 for(const [rule,count] of Object.entries(report))assert.ok(count>0,`Sin ejemplos: ${rule}`);
});
test('La -m fija nunca se confunde con apócope',()=>{
 for(const w of words){const m=w.changes.filter(x=>x.rule==='FIX_M');assert.equal(m.length,w.latin.endsWith('m')?1:0);assert.ok(!requiredRules(w).includes('FIX_M'));}
 const poena=word(245);
 assert.deepEqual(requiredRules(poena),['MONOP']);
 assert.equal(availableWords(words,new Set(['MONOP'])).some(x=>x.id===poena.id),true);
 assert.equal(gradeChange(poena,{rule:'APOC',spans:[[poena.latin.length-1,poena.latin.length]]}).correct,false);
 assert.equal(gradeChange(poena,{rule:'FIX_M',spans:[[poena.latin.length-1,poena.latin.length]]}).correct,true);
});
test('Criterio aprobado: -um > -o exige abertura final y caída fija de -m',()=>{
 const endings=words.filter(w=>w.latin.endsWith('um'));
 assert.ok(endings.length>=10,'El lote debe incluir suficientes terminaciones -um');
 for(const w of endings) {
   const length=chars(w.latin).length, end=length-2;
   const abertura=w.changes.find(t=>t.rule==='ABER' && t.output==='o' && t.spans?.some(([a,b])=>a===end && b===end+1));
   const perdida=w.changes.find(t=>t.rule==='FIX_M' && t.spans?.some(([a,b])=>a===end+1 && b===end+2));
   assert.ok(abertura, `${w.latin}: falta abertura de u final`);
   assert.ok(perdida, `${w.latin}: falta pérdida fija de -m`);
   assert.ok(requiredRules(w).includes('ABER'));
   assert.ok(!availableWords([w],new Set()).length);
 }
 const incompatible=structuredClone(endings[0]);
 incompatible.changes=incompatible.changes.filter(t=>!(t.rule==='ABER' && t.spans?.some(([a])=>a===chars(incompatible.latin).length-2)));
 assert.ok(validationErrors({version:1,words:[incompatible]}).some(e=>e.includes('falta abertura final')));
});

test('El filtro no devuelve fenómenos no elegidos (incluso en 250 combinaciones)',()=>{
 let seed=8342;const rng=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
 const sets=[new Set(),new Set(RULES.map(x=>x.id)),...RULES.map(x=>new Set([x.id]))];
 for(let j=0;j<250;j++)sets.push(new Set(RULES.filter(()=>rng()>.42).map(x=>x.id)));
 for(const selected of sets){const pool=availableWords(words,selected);assert.ok(pool.every(w=>requiredRules(w).every(r=>selected.has(r))));assert.ok(pool.every(w=>requiredRules(w).length>0));}
 assert.equal(chooseWords(words,new Set(['MONOP']),999,()=>0).length,availableWords(words,new Set(['MONOP'])).length);
});
test('Las respuestas permiten mayúsculas y espacios, pero no eliminan tildes',()=>{
 assert.equal(normAnswer('  PENA  '),'pena');
 assert.equal(resultMatches(word(245),'  PeNa '),true);
 assert.equal(resultMatches(word(605),'marmol'),false);
 assert.equal(resultMatches(word(605),'  MÁRMOL '),true);
 assert.equal(resultMatches(word(245),'pœnam'),false);
});
test('No se desbloquea el análisis con un resultado erróneo y no se revela la respuesta',()=>{
 const state=newCardState(word(245));
 assert.equal(applyChange(state,word(245).changes[0]).correct,false);
 assert.equal(state.phase,1);
 assert.equal(checkResult(state,'incorrecto'),false);
 assert.equal(state.phase,1);
 assert.equal(checkResult(state,'pena'),true);
 assert.equal(state.phase,2);
 assert.equal(checkResult(state,'pena'),false);
});
test('El motor comprueba regla, posición y repetición, incluso en cambios solapados',()=>{
 const sample=word(502);const asim=sample.changes.find(x=>x.rule==='ASMIL');const simpl=sample.changes.find(x=>x.rule==='SIMPL');
 assert.deepEqual(asim.spans,simpl.spans);
 assert.equal(changeMatches(asim,simpl),false);
 assert.equal(gradeChange(sample,{...asim,rule:'SIMPL'}).correct,true);
 assert.equal(gradeChange(sample,{...asim,spans:[[0,1]]}).correct,false);
 const solved=new Set([asim.id]);
 assert.equal(gradeChange(sample,asim,solved).repeated,true);
 assert.equal(gradeChange(sample,simpl,solved).correct,true);
});
test('Grupos de varias letras, tramos no contiguos e inserciones tienen índices válidos',()=>{
 const changes=words.flatMap(w=>w.changes.map(t=>({word:w,...t})));
 assert.ok(changes.some(t=>t.spans.some(([start,end])=>end-start>1)));
 assert.ok(changes.some(t=>t.spans.length>1));
 assert.ok(changes.some(t=>t.anchor===0));
 assert.ok(changes.some(t=>t.anchor>0));
 const stellam=word(614);
 assert.equal(stellam.changes.filter(t=>t.anchor!==undefined).length,2);
 const metathesis=word(722).changes.find(t=>t.rule==='METAT');
 assert.equal(metathesis.spans.length,2);
 assert.notEqual(metathesis.spans[0][1],metathesis.spans[1][0]);
 const min=word(150).changes.find(t=>t.rule==='MIN_MBR');
 assert.equal(chars(word(150).latin).slice(...min.spans[0]).join(''),'mĭn');
});
test('Cada tarjeta se puede completar, sin avance prematuro, con sus transformaciones anotadas',()=>{
 for(const w of words){const s=newCardState(w);assert.equal(checkResult(s,w.answers[0]),true);assert.equal(s.phase,2);
  for(let i=0;i<w.changes.length;i++){
   const outcome=applyChange(s,w.changes[i]);assert.equal(outcome.correct,true,`${w.id}/${w.changes[i].id}`);
   assert.equal(s.solved.size,i+1);
   assert.equal(s.phase,i===w.changes.length-1?3:2);
  }
  assert.ok(isComplete(w,s.solved));
 }
});
test('La ampliación de un lote no altera los filtros ni el banco anterior',()=>{
 const baseline=JSON.stringify(words);
 const newWord=structuredClone(word(245));newWord.id='new-lot';newWord.source.row=9999;
 const augmented=[...words,newWord];const rules=new Set(['MONOP']);
 const orig=availableWords(words,rules).map(w=>w.id);
 const after=availableWords(augmented,rules).map(w=>w.id).filter(id=>id!=='new-lot');
 assert.deepEqual(after,orig);
 assert.equal(JSON.stringify(words),baseline);
});
