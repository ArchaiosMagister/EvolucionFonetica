// Utilidades puras de consulta. Reutilizan exclusivamente las fichas ya revisadas.
import { RULES } from './rules.mjs';

// Las variantes tipográficas æ/ae y œ/oe, las cantidades vocálicas y las
// tildes no deben impedir encontrar una ficha. No altera las respuestas
// exigibles en el modo de práctica.
export function normalizeStudyQuery(value) {
  return String(value ?? '')
    .replace(/æ/gi, 'ae').replace(/œ/gi, 'oe')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
}
export const sortStudyWords = words => [...words].sort((a,b) =>
  normalizeStudyQuery(a.latin).localeCompare(normalizeStudyQuery(b.latin),'es') || a.id.localeCompare(b.id));
export function findStudyWords(words, query) {
  const q=normalizeStudyQuery(query);
  if (!q) return sortStudyWords(words);
  const candidates=words.filter(w => [w.latin,...(w.answers||[])].some(v => normalizeStudyQuery(v).includes(q)));
  return candidates.sort((a,b) => {
    const score=w => {
      const forms=[w.latin,...(w.answers||[])].map(normalizeStudyQuery);
      return forms.some(x=>x===q)?0:forms.some(x=>x.startsWith(q))?1:2;
    };
    return score(a)-score(b) || normalizeStudyQuery(a.latin).localeCompare(normalizeStudyQuery(b.latin),'es');
  });
}
export function studyWordsForRule(words, ruleId, subtype='') {
  if (!RULES.some(r=>r.id===ruleId)) return [];
  return sortStudyWords(words.filter(w=>w.changes.some(c=>c.rule===ruleId && (!subtype || c.subtype===subtype))));
}
export function studyRuleCounts(words) {
  return Object.fromEntries(RULES.map(rule=>[rule.id,studyWordsForRule(words,rule.id).length]));
}
export function studySubtypes(words, ruleId) {
  const totals=new Map();
  for(const w of words){
    const seen=new Set(w.changes.filter(c=>c.rule===ruleId && c.subtype).map(c=>c.subtype));
    for(const subtype of seen)totals.set(subtype,(totals.get(subtype)||0)+1);
  }
  return [...totals].sort(([a],[b])=>a.localeCompare(b,'es')).map(([name,count])=>({name,count}));
}
// Los intervalos pertenecen al original latino, nunca se deducen del resultado.
// Se devuelve un índice por carácter Unicode, por lo que admite ligaduras,
// grupos, dos tramos discontiguos y puntos de inserción antes/dentro/después.
export function studyHighlight(word, change) {
  const indices=new Set();
  for(const [a,b] of change.spans??[])for(let i=a;i<b;i++)indices.add(i);
  return {indices,anchor:Number.isInteger(change.anchor)?change.anchor:null};
}
