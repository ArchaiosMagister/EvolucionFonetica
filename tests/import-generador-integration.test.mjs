import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { auditImport,key } from '../tools/import-generador.mjs';
import { validationErrors, newCardState, checkResult, checkAllChanges, availableFocusedWords, requiredRules } from '../src/engine.mjs';
const load=p=>JSON.parse(readFileSync(new URL(`../${p}`,import.meta.url),'utf8'));
const bank=load('data/pilot.json');
const source=load('data/imports/generador-655.json');
const review=load('data/imports/revision-generador.json');
const BASE_COUNT=282;
const ORIGINAL_SHA='6327df2d4df3ffc23d1372fcfa1e189450bf3ebc5549dfca3891a00dc91c3fc3';
const base=bank.words.slice(0,BASE_COUNT);
const imported=bank.words.slice(BASE_COUNT);
const sourceNames=new Set(source.items.map(x=>key(x.latin)));
test('Importación trazable: 655 fuentes, 273 coincidencias, 240 altas y 142 pendientes',()=>{
 assert.equal(source.esquema,'evoluciones-latin-castellano/v1');
 assert.equal(source.items.length,655);
 assert.equal(base.length,282);assert.equal(imported.length,240);
 assert.equal(bank.words.length,522);
 assert.equal(createHash('sha256').update(JSON.stringify(base)).digest('hex'),ORIGINAL_SHA);
 const audit=auditImport(source,{version:1,words:base});
 assert.equal(audit.overlap.length,273);
 assert.equal(audit.accepted.length,240);
 assert.equal(audit.pending.length,142);
 assert.equal(audit.conflicts.length,4);
 assert.deepEqual(imported,audit.accepted);
 assert.deepEqual(review.pending,audit.pending);
 assert.deepEqual(review.conflicts.map(x=>x.sourceId),audit.conflicts.map(x=>x.item.id));
});
test('Ningún original se sobrescribe ni se admite un duplicado o fuente excluida',()=>{
 assert.deepEqual(validationErrors(bank),[]);
 assert.equal(new Set(bank.words.map(w=>key(w.latin))).size,522);
 assert.ok(imported.every(w=>sourceNames.has(key(w.latin))));
 assert.ok(imported.every(w=>w.source?.generatorId&&w.source?.sourceStatus==='APTO_PROPUESTO'));
 const prohibited=['inde','pirum','scrinium','quinionem','chœrilum','œagrum','œnomaum','œtam'];
 for(const name of prohibited) assert.equal(imported.some(w=>key(w.latin)===key(name)),false,name);
});
test('Todas las 240 tarjetas importadas tienen corrección guiada y ciega funcional',()=>{
 for(const w of imported){
  const s=newCardState(w);assert.equal(checkResult(s,w.answers[0]),true,w.latin);
  const answers=w.changes.map(t=>({...t}));
  const result=checkAllChanges(s,answers);
  assert.ok(result.complete,w.latin);
  assert.equal(s.phase,3);
  const selected=new Set(requiredRules(w));
  assert.ok(selected.size>0,w.latin);
  for(const id of selected){
   assert.ok(availableFocusedWords([w],id).length===1,w.latin);
   const focused=newCardState(w,id);
   assert.equal(checkResult(focused,w.answers[0]),true);
   const targets=w.changes.filter(t=>t.rule===id);
   assert.equal(checkAllChanges(focused,targets).complete,true,`${w.latin}/${id}`);
  }
 }
});
test('Las adaptaciones cultas siguen etiquetadas; ninguna se confunde con patrimonio seguro',()=>{
 assert.ok(imported.filter(w=>w.source.transmission==='ADAPTACION_CULTA').length>=100);
 assert.ok(imported.every(w=>w.explanation.includes('no constituye certificación filológica adicional')));
 assert.ok(imported.every(w=>w.status==='reviewed-pilot'));
});
