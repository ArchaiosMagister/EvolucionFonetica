import { RULES, FIXED_RULE, ruleName } from './rules.mjs';
import { chars, availableWords, chooseWords, coverage, validationErrors, newCardState, checkResult, applyChange, requiredRules } from './engine.mjs';
const app=document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const themeBtn=document.querySelector('#theme-toggle');
const initialTheme = localStorage.getItem('ev_theme') || (matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
function theme(mode){document.documentElement.dataset.theme=mode;themeBtn.textContent=mode==='dark'?'☼':'☾';localStorage.setItem('ev_theme',mode)}
theme(initialTheme);themeBtn.onclick=()=>theme(document.documentElement.dataset.theme==='dark'?'light':'dark');
let words=[], selected=new Set(RULES.map(r=>r.id)), mode='guided', requested=10, session=null, cardState=null, feedback='', choice='', selectedTarget=null;
let blindSpans=[], pendingStart=null, insertion=null;
const phaseTitle={1:'Fase 1 · Resultado castellano',2:'Fase 2 · Identifica los cambios',3:'Explicación de la evolución'};
const currentWord=()=>session?.cards[session.index];
const progress=()=>session? Math.round((session.index/session.cards.length)*100):0;
const labelFragment=(word,t)=>t.anchor!==undefined?`Inserción ${t.anchor===0?'antes de '+chars(word.latin)[0]??'':'tras la letra '+chars(word.latin)[t.anchor-1]}`:t.spans.map(([s,e])=>chars(word.latin).slice(s,e).join('')).join(' + ');
function setupHTML(){
 const pool=availableWords(words,selected);const count=Math.min(requested,pool.length);
 return `<section class="hero"><p class="eyebrow">Laboratorio de lengua histórica</p><h1>Del latín al <em>castellano</em>.</h1><p class="intro">Descubre la palabra resultante y demuestra qué transformaciones explican su evolución. Primero la respuesta; después, las normas.</p><div class="details-steps"><span class="step-pill"><b>01</b> Resuelve</span><span class="step-pill"><b>02</b> Analiza</span><span class="step-pill"><b>03</b> Comprueba</span></div></section>
 <section class="setup-grid"><div class="panel"><div class="panel-header"><div><h2>Normas fonéticas</h2><p>Selecciona sólo las que has estudiado.</p></div><div class="rule-actions"><button class="text-button" data-action="select-all">Todas</button><button class="text-button" data-action="select-none">Ninguna</button></div></div>
 <div class="rules">${RULES.map((r,i)=>`<label class="rule-option" title="${esc(r.description)}"><input type="checkbox" data-rule="${r.id}" ${selected.has(r.id)?'checked':''}><span class="rule-num">${String(i+1).padStart(2,'0')}</span><span>${esc(r.name)}</span></label>`).join('')}</div></div>
 <aside class="panel side-panel"><h2>Tu sesión</h2><div class="field"><div class="field-label">Modalidad de análisis</div><div class="choice-row"><label class="choice-label"><input type="radio" name="mode" value="guided" ${mode==='guided'?'checked':''}> Guiado</label><label class="choice-label"><input type="radio" name="mode" value="blind" ${mode==='blind'?'checked':''}> A ciegas</label></div><p class="helper">${mode==='guided'?'Se destacan los grupos que debes analizar.':'Descubre tú mismo las letras o puntos de inserción.'}</p></div>
 <div class="field"><label class="field-label" for="requested">Número de tarjetas</label><input id="requested" type="number" min="1" max="${Math.max(pool.length,1)}" value="${count||1}" inputmode="numeric"><p class="helper" id="eligible-count">${pool.length} palabras elegibles con las normas seleccionadas.${pool.length<count?' Se ajustará el número.':''}</p></div>
 <button type="button" class="button-primary full" data-action="start" ${!pool.length?'disabled':''}>Empezar práctica <span aria-hidden="true">→</span></button>${!pool.length?'<p class="feedback error">No hay palabras compatibles. Elige otras normas; nunca se ampliará el filtro automáticamente.</p>':''}
 <details class="rule-reference"><summary>Consultar las 20 normas oficiales</summary><div class="reference-list">${RULES.map((r,i)=>`<p><strong>${i+1}. ${esc(r.name)}.</strong> ${esc(r.description)}<br><em>${esc(r.examples.join('; '))}</em></p>`).join('')}<p><strong>Normas fijas.</strong> Los sustantivos y adjetivos castellanos se explican desde el acusativo latino según el criterio didáctico oficial. La -m final del acusativo se pierde y no se marca como apócope.</p></div></details>
 </aside></section>`;
}
function setUp(){session=null;cardState=null;feedback='';app.innerHTML=setupHTML();app.setAttribute('aria-busy','false');}
function updateAvailable(){const pool=availableWords(words,selected);const countEl=document.querySelector('#eligible-count');if(countEl)countEl.textContent=`${pool.length} palabras elegibles con las normas seleccionadas.${pool.length<requested?' Si solicitas más, se ajustará a las disponibles.':''}`;const start=document.querySelector('[data-action="start"]');if(start)start.disabled=!pool.length;const num=document.querySelector('#requested');if(num){num.max=String(Math.max(1,pool.length));num.value=String(pool.length?Math.min(requested,pool.length):1);}}
function startSession(){
 const pool=availableWords(words,selected);if(!pool.length){setUp();return;}
 const n=Math.max(1,Math.min(requested,pool.length));
 session={cards:chooseWords(words,selected,n),index:0,done:[],selected:[...selected],mode};
 initCard();
}
function initCard(){cardState=newCardState(currentWord());feedback='';choice='';selectedTarget=null;blindSpans=[];pendingStart=null;insertion=null;renderCard();}
function renderCard(){
 const w=currentWord();if(!w){renderFinal();return;}
 const stage=cardState.phase;
 app.innerHTML=`<div class="practice-shell"><div class="topline"><button type="button" class="back-button" data-action="back">← Cambiar normas</button><span class="tiny">Tarjeta ${session.index+1} de ${session.cards.length} · ${session.mode==='guided'?'Guiado':'A ciegas'}</span></div><div class="progress-track" role="progressbar" aria-valuenow="${progress()}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso"><div class="progress-value" style="width:${progress()}%"></div></div><article class="panel practice-card"><p class="eyebrow">${phaseTitle[stage]}</p>${stage===1?renderFirst(w):stage===2?renderSecond(w):renderComplete(w)}</article></div>`;
 app.setAttribute('aria-busy','false');
}
function renderFirst(w){return `<h1 class="latin-word" lang="la">${esc(w.latin)}</h1><p class="prompt">¿Cuál es el resultado de esta palabra latina en castellano?</p><form class="question-form" id="result-form"><label for="castellano">Resultado castellano</label><input id="castellano" class="answer-input" type="text" placeholder="Escribe la palabra…" autocomplete="off" autocapitalize="off" spellcheck="false" required><div class="answer-actions"><button class="button-primary full" type="submit">Comprobar respuesta →</button></div>${feedback?`<div class="feedback ${feedback.startsWith('Incorrect')?'error':'success'}" role="status">${esc(feedback)}</div>`:''}<p class="helper">Debes acertar antes de identificar los fenómenos. La solución no se revela automáticamente.</p></form>`;}
function renderGuidedWord(word){
 const set=new Set(word.changes.flatMap(x=>x.spans.flatMap(([s,e])=>Array.from({length:e-s},(_,j)=>s+j))));
 let html='';const letters=chars(word.latin);
 for(let i=0;i<letters.length;i++)html+=`<span class="guided-char" ${set.has(i)?'data-mark="true"':''}>${esc(letters[i])}</span>`;
 return `<div class="guided-word" lang="la" aria-label="${esc(word.latin)}">${html}</div>`;
}
function guidedTargets(word){return `<div class="analysis-targets">${word.changes.map(t=>{
 const solved=cardState.solved.has(t.id);
 return `<button type="button" class="target ${solved?'done':''} ${selectedTarget===t.id?'active':''}" data-target="${t.id}" ${solved?'disabled':''}><span class="fragment">${solved?'✓ ':''}${esc(labelFragment(word,t))}</span><span class="target-text">${solved?'Fenómeno identificado':t.rule==='FIX_M'?'Norma fija · identifica la regla':'Selecciona su norma'}</span></button>`;
 }).join('')}</div>`;}
function blindWord(word){
 const letters=chars(word.latin);let pieces='';
 for(let i=0;i<=letters.length;i++){
  const active=insertion===i;
  pieces+=`<button type="button" class="insertion-button ${active?'chosen':''}" data-insert="${i}" title="Marcar inserción en este punto" aria-label="Marcar inserción en el punto ${i}" aria-pressed="${active}">+</button>`;
  if(i<letters.length) {const activeRange=blindSpans.some(([s,e])=>i>=s&&i<e);pieces+=`<button type="button" class="symbol-button ${activeRange?'chosen':''} ${pendingStart===i?'pending':''}" data-letter="${i}" aria-label="Letra ${letters[i]}, posición ${i+1}" aria-pressed="${activeRange||pendingStart===i}">${esc(letters[i])}</button>`;}
 }
 return `<div class="latin-interactive" lang="la" aria-label="Selecciona los fragmentos en ${esc(word.latin)}">${pieces}</div>
 <p class="selection-summary">${pendingStart!==null?'Ahora pulsa la última letra del grupo (puede ser la misma).':blindSpans.length?`Grupos: ${esc(blindSpans.map(([s,e])=>letters.slice(s,e).join('')).join(' + '))}`:insertion!==null?`Inserción en el punto ${insertion}`:'Selecciona un fragmento o el símbolo + de inserción.'}</p>
 <div class="selection-actions"><button type="button" class="button-secondary" data-action="clear-selection">Borrar selección</button></div>`;
}
function choiceOptions(word){let ids=[...session.selected];if(word.changes.some(t=>t.rule===FIXED_RULE.id))ids.push(FIXED_RULE.id);return ids.map(id=>`<option value="${id}" ${choice===id?'selected':''}>${esc(ruleName(id))}${id==='FIX_M'?' (fija)':''}</option>`).join('');}
function renderSecond(w){
 const total=w.changes.length,done=cardState.solved.size;
 const showSelector=session.mode==='blind' || selectedTarget;
 return `<h2 class="latin-word" style="font-size:clamp(36px,7vw,63px)" lang="la">${esc(w.latin)}</h2><p class="prompt">Resultado correcto: <strong>${esc(w.answers[0])}</strong>. Identifica los fenómenos y asócialos con sus letras o puntos de inserción.</p>
 <div class="hint-box">${session.mode==='guided'?'<strong>Modo guiado.</strong> Pulsa uno de los fragmentos resaltados en la lista y asígnale su norma. Hay grupos que se superponen porque intervienen en más de un fenómeno.':'<strong>Modo a ciegas.</strong> Pulsa la primera y la última letra de un grupo (dos veces la misma si es una sola). Puedes añadir tramos no contiguos. Para sonidos añadidos, pulsa <strong>+</strong> en el lugar de inserción.'} <br><strong>${done}/${total}</strong> cambios identificados.</div>
 ${session.mode==='guided'?renderGuidedWord(w)+guidedTargets(w):blindWord(w)}
 ${showSelector?`<div class="answer-box"><label for="phenomenon">Norma aplicable</label><select id="phenomenon"><option value="">Elige una norma…</option>${choiceOptions(w)}</select><button type="button" class="button-primary" data-action="check-change" ${!choice?'disabled':''}>Comprobar fenómeno →</button></div>`:''}
 ${feedback?`<div class="feedback ${feedback.startsWith('Correcto')?'success':'error'}" role="status">${esc(feedback)}</div>`:''}`;
}
function renderComplete(w){
 return `<div class="completion"><p class="card-kicker" style="text-align:center">Tarjeta completada · ${cardState.mistakes===0?'Sin errores':'Con '+cardState.mistakes+' errores'}</p><div class="completed-word" lang="la">${esc(w.latin)} <span class="result-arrow" aria-hidden="true">→</span> ${esc(w.answers[0])}</div><h3>Explicación de los cambios</h3>
 ${w.changes.map(t=>`<div class="change-detail"><span class="change-tag ${t.rule==='FIX_M'?'fixed-tag':''}">${esc(ruleName(t.rule))}${t.subtype?' · '+esc(t.subtype):''}</span><strong>${esc(labelFragment(w,t))} → ${esc(t.output||'∅')}</strong><p>${esc(t.note)}</p>${t.stages?`<p>Etapas: ${esc(t.stages.join(' · '))}</p>`:''}</div>`).join('')}
 ${w.changes.some(t=>t.rule==='FIX_M')?'<p class="review-note">Normas fijas: según el criterio didáctico oficial, las formas nominales se estudian desde el acusativo. La -m final del acusativo se pierde; no es la apócope seleccionable.</p>':''}
 <p class="review-note">Fuente: Excel docente · Banco, fila ${w.source.row} · Lote ${w.source.lot}. Se respeta la terminología de las normas PAU.</p>
 <button class="button-primary full" data-action="next">${session.index+1===session.cards.length?'Ver resumen':'Siguiente palabra →'}</button></div>`;
}
function next(){if(cardState.phase!==3)return;session.done.push({latin:currentWord().latin,spanish:currentWord().answers[0],mistakes:cardState.mistakes,attempts:cardState.attempts});session.index++;if(session.index<session.cards.length)initCard();else renderFinal();}
function renderFinal(){const total=session.done.length;const perfect=session.done.filter(d=>d.mistakes===0).length;const mistakes=session.done.reduce((n,d)=>n+d.mistakes,0);
 app.innerHTML=`<div class="practice-shell"><section class="panel practice-card"><p class="eyebrow">Sesión terminada</p><h1 class="hero" style="font-family:var(--serif);font-weight:500;font-size:clamp(33px,6vw,50px);margin:0 0 12px">Repaso completado</h1><div class="summary-figure">${perfect}<span style="font-size:24px;color:var(--muted)"> / ${total}</span></div><p class="prompt">Palabras completadas sin errores · ${mistakes} errores durante la práctica.</p><div class="summary-list">${session.done.map(d=>`<div class="summary-line"><strong>${esc(d.latin)} → ${esc(d.spanish)}</strong><span>${d.mistakes===0?'✓ Sin errores':d.mistakes+' errores'}</span></div>`).join('')}</div><button type="button" class="button-primary full" style="margin-top:20px" data-action="home">Nueva práctica</button></section></div>`;}
app.addEventListener('change',event=>{const e=event.target;if(e.matches('[data-rule]')){if(e.checked)selected.add(e.dataset.rule);else selected.delete(e.dataset.rule);updateAvailable();}if(e.matches('input[name="mode"]')){mode=e.value;const hint=e.closest('.field').querySelector('.helper');if(hint)hint.textContent=mode==='guided'?'Se destacan los grupos que debes analizar.':'Descubre tú mismo las letras o puntos de inserción.';}if(e.id==='phenomenon'){choice=e.value;const btn=app.querySelector('[data-action="check-change"]');if(btn)btn.disabled=!choice;}});
app.addEventListener('input',event=>{if(event.target.id==='requested'){const val=Number(event.target.value);if(Number.isFinite(val)&&val>0)requested=Math.floor(val);updateAvailable();}});
app.addEventListener('submit',event=>{if(event.target.id!=='result-form')return;event.preventDefault();const answer=document.querySelector('#castellano').value;if(checkResult(cardState,answer)){feedback='';renderCard();}else{feedback='Incorrecto. Revisa el resultado e inténtalo de nuevo.';renderCard();document.querySelector('#castellano')?.focus();}});
app.addEventListener('click',event=>{
 const t=event.target.closest('button');if(!t)return;
 if(t.dataset.action==='select-all'){selected=new Set(RULES.map(r=>r.id));setUp();return;}
 if(t.dataset.action==='select-none'){selected.clear();setUp();return;}
 if(t.dataset.action==='start'){requested=Number(document.querySelector('#requested')?.value)||10;startSession();return;}
 if(t.dataset.action==='back'||t.dataset.action==='home'){setUp();return;}
 if(t.dataset.action==='next'){next();return;}
 if(!cardState || cardState.phase!==2)return;
 if(t.dataset.target){selectedTarget=t.dataset.target;choice='';feedback='';renderCard();return;}
 if(t.dataset.action==='clear-selection'){blindSpans=[];pendingStart=null;insertion=null;feedback='';renderCard();return;}
 if(t.dataset.letter!==undefined){const i=Number(t.dataset.letter);insertion=null;if(pendingStart===null){pendingStart=i;}else{const start=Math.min(pendingStart,i),end=Math.max(pendingStart,i)+1;blindSpans.push([start,end]);pendingStart=null;}feedback='';renderCard();return;}
 if(t.dataset.insert!==undefined){const i=Number(t.dataset.insert);insertion=i;pendingStart=null;blindSpans=[];feedback='';renderCard();return;}
 if(t.dataset.action==='check-change'){
  const w=currentWord();const original=w.changes.find(x=>x.id===selectedTarget);
  const guess=session.mode==='guided'?{rule:choice,spans:original?.spans??[],anchor:original?.anchor}:{rule:choice,spans:blindSpans,anchor:insertion??undefined};
  const outcome=applyChange(cardState,guess);
  feedback=outcome.correct?'Correcto. '+outcome.note:outcome.note;
  choice='';selectedTarget=null;blindSpans=[];pendingStart=null;insertion=null;renderCard();
 }
});
async function load(){try{const response=await fetch('./data/pilot.json',{cache:'no-cache'});if(!response.ok)throw new Error('No se pudo obtener el banco de palabras.');const data=await response.json();const errors=validationErrors(data);if(errors.length)throw new Error('El banco no supera la validación: '+errors.slice(0,3).join(' · '));words=data.words;const report=coverage(words);if(RULES.some(r=>report[r.id]===0))throw new Error('El piloto no cubre todas las normas.');setUp();}catch(error){app.innerHTML=`<div class="fatal"><h1>No ha sido posible iniciar la práctica</h1><p>${esc(error.message)}</p><button class="button-secondary" onclick="location.reload()">Reintentar</button></div>`;app.setAttribute('aria-busy','false');}}
load();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
