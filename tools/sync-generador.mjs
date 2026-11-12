// Ejecutar con `node tools/sync-generador.mjs` para auditar una nueva copia del banco.
// No escribe por defecto; `--apply` regenera solo la sección importada y la cola.
import {readFileSync,writeFileSync} from 'node:fs';
import {auditImport} from './import-generador.mjs';
const source=JSON.parse(readFileSync(new URL('../data/imports/generador-655.json',import.meta.url),'utf8'));
const bank=JSON.parse(readFileSync(new URL('../data/pilot.json',import.meta.url),'utf8'));
const base=bank.words.filter(w=>!w.source?.generatorId);
const audit=auditImport(source,{version:1,words:base});
const summary={source:source.esquema,totalSource:source.items.length,overlap:audit.overlap.length,autoAligned:audit.accepted.length,pending:audit.pending.length,conflicts:audit.conflicts.length};
console.log(JSON.stringify(summary,null,2));
if(process.argv.includes('--apply')){
 const next={...bank,words:[...base,...audit.accepted]};
 writeFileSync(new URL('../data/pilot.json',import.meta.url),JSON.stringify(next,null,2)+'\n');
 const queue={version:1,source:'ArchaiosMagister/GeneradorExamenes',baseWordCount:base.length,summary,pending:audit.pending,conflicts:audit.conflicts.map(x=>({sourceId:x.item.id,latin:x.item.latin,castellano:x.item.castellano,type:x.type,existingId:x.wordId,sourceRules:x.item.normas,existingRules:x.currentRules,sourceNote:x.item.observacion}))};
 writeFileSync(new URL('../data/imports/revision-generador.json',import.meta.url),JSON.stringify(queue,null,2)+'\n');
}
