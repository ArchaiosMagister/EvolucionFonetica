import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {join} from 'node:path';
const root=join(import.meta.dirname,'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('El aviso antiguo permite seguir practicando y enlaza a Evolutio integrado',()=>{
 const html=read('index.html');
 assert.match(html,/id="schola-legacy-notice"/);
 assert.match(html,/role="note"/);
 assert.match(html,/https:\/\/archaiosmagister.github.io\/ScholaClassica\/apps\/evolucion-fonetica\/index.html/);
 assert.match(html,/Esta versión sigue funcionando/);
 assert.ok(!html.includes('http-equiv="refresh"'));
});
test('El service worker del legado no borra la caché de ScholaClassica ni otras PWA',async()=>{
 const handlers={};
 const removed=[];
 const existing=['schola-vocabula-v4','schola-portal-xyz','schola-evolutio-r1',
  'evolutio-latin-u-20261112','evolutio-latin-u-20261119-transition1',
  'other-app-cache'];
 const caches={
  keys:()=>Promise.resolve(existing),
  delete:async key=>{removed.push(key);return true;}
 };
 const self={
  addEventListener:(type,fn)=>{handlers[type]=fn;},
  clients:{claim:async()=>{}}
 };
 runInNewContext(read('sw.js'),{self,caches});
 assert.equal(typeof handlers.activate,'function');
 let pending;
 handlers.activate({waitUntil:promise=>{pending=promise;}});
 await pending;
 assert.deepEqual(removed,['evolutio-latin-u-20261112']);
 assert.equal(typeof handlers.install,'function');
 assert.equal(typeof handlers.fetch,'function');
});
test('Banco original sigue conteniendo 522 palabras',()=>{
 const bank=JSON.parse(read('data/pilot.json'));
 assert.equal(bank.words.length,522);
 assert.equal(new Set(bank.words.map(x=>x.id)).size,522);
});
