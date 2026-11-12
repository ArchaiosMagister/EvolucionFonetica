import { RULES, FIXED_RULE, ruleName } from './rules.mjs';
import { chars, availableWords, chooseWords, coverage, validationErrors, newCardState, checkResult, checkAllChanges, requiredRules, optionRuleIds } from './engine.mjs';
const app=document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const themePicker=document.querySelector('#theme-select');
const themeValues=new Set(['light','dark','oled']);
const storedTheme=localStorage.getItem('ev_theme');
const initialTheme=themeValues.has(storedTheme)?storedTheme:(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
function theme(value){
 const mode=themeValues.has(value)?value:'light';
 document.documentElement.dataset.theme=mode;
 themePicker.value=mode;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',mode==='oled'?'#000000':mode==='dark'?'#101b1d':'#0a555b');
 localStorage.setItem('ev_theme',mode);
}
theme(initialTheme);
themePicker.addEventListener('change',event=>theme(event.target.value));
let words=[], selected=new Set(RULES.map(r=>r.id)), mode='guided', requested=10, session=null, cardState=null, feedback='';
let drafts=[], draftSerial=0, batchFeedback='';
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
function initCard(){
 cardState=newCardState(currentWord());feedback='';batchFeedback='';draftSerial=0;
 const w=currentWord();
 drafts=session.mode==='guided'?w.changes.map(t=>({id:`g-${t.id}`,targetId:t.id,spans:t.spans.map(r=>[...r]),anchor:t.anchor,rule:'',status:null})):[];
 blindSpans=[];pendingStart=null;insertion=null;renderCard();
}
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
function renderDraft(word,draft,index) {
 const status=draft.status||'';
 const stateLabel={correct:'✓ Correcto',incorrect:'Revisar',missing:'Sin respuesta'}[status]||'Sin comprobar';
 const label=labelFragment(word,draft);
 const fragment=draft.anchor!==undefined?`<span class="analysis-fragment-small">${esc(label)}</span>`:`<mark>${esc(label)}</mark>`;
 return `<div class="analysis-item ${status==='correct'?'is-correct':status==='incorrect'?'is-wrong':status==='missing'?'is-missing':''}" data-draft-card="${esc(draft.id)}">
  <div class="analysis-item-head"><span class="analysis-number">Cambio ${index+1}</span><span class="analysis-status">${stateLabel}</span></div>
  <div class="analysis-fragment" lang="la">${fragment}</div>
  <label for="draft-${esc(draft.id)}">¿Qué norma corresponde?</label>
  <select id="draft-${esc(draft.id)}" data-draft-rule="${esc(draft.id)}"><option value="">Selecciona una norma…</option>${choiceOptions(word,draft.rule)}</select>
  ${status==='incorrect'?'<p class="analysis-feedback">Revisa esta asociación de fragmento y norma.</p>':status==='missing'?'<p class="analysis-feedback">Selecciona una norma antes de comprobar.</p>':''}
  ${session.mode==='blind'?`<button type="button" class="analysis-remove" data-remove-draft="${esc(draft.id)}" aria-label="Eliminar cambio ${index+1}">Quitar este cambio</button>`:''}
 </div>`;
}
function blindWord(word){
 const letters=chars(word.latin);let pieces='';
 for(let i=0;i<=letters.length;i++){
  const active=insertion===i;
  pieces+=`<button type="button" class="insertion-button ${active?'chosen':''}" data-insert="${i}" title="Marcar inserción en este punto" aria-label="Marcar inserción en el punto ${i}" aria-pressed="${active}">+</button>`;
  if(i<letters.length) {const activeRange=blindSpans.some(([s,e])=>i>=s&&i<e);pieces+=`<button type="button" class="symbol-button ${activeRange?'chosen':''} ${pendingStart===i?'pending':''}" data-letter="${i}" aria-label="Letra ${letters[i]}, posición ${i+1}" aria-pressed="${activeRange||pendingStart===i}">${esc(letters[i])}</button>`;}
 }
 return `<div class="latin-interactive" lang="la" aria-label="Selecciona los fragmentos en ${esc(word.latin)}">${pieces}</div>
 <p class="selection-summary">${pendingStart!==null?'Ahora pulsa la última letra del grupo (puede ser la misma).':blindSpans.length?`Grupos: ${esc(blindSpans.map(([s,e])=>letters.slice(s,e).join('')).join(' + '))}`:insertion!==null?`Inserción en el punto ${insertion}`:'Selecciona un fragmento o el símbolo + de inserción.'}</p>
 `;
}
function choiceOptions(word,value=''){
 // La norma fija aparece primero SOLO en las palabras a las que corresponde.
 return optionRuleIds(word,session.selected).map(id=>`<option value="${id}" ${value===id?'selected':''}>${esc(ruleName(id))}${id==='FIX_M'?' (fija)':''}</option>`).join('');
}
function renderSecond(w){
 const guided=session.mode==='guided',count=drafts.length;
 const description=guided
   ? 'Los fragmentos están señalados. Elige la norma en el desplegable de cada tarjeta; puedes cambiar cualquier respuesta antes de comprobar.'
   : 'Marca la primera y la última letra de un grupo y pulsa «Añadir cambio». Puedes seleccionar varios grupos separados. Usa + para indicar un sonido añadido.';
 const builder=guided?renderGuidedWord(w):`<div class="analysis-builder"><h3>1 · Selecciona las letras</h3><p>Pulsa dos letras para señalar un tramo; repite para añadir otro tramo del mismo fenómeno. También puedes usar + para una inserción. Desliza la palabra horizontalmente si no cabe.</p>
 ${blindWord(w)}<div class="builder-actions"><button type="button" class="button-primary" data-action="add-selection" ${!blindSpans.length && insertion===null?'disabled':''}>Añadir cambio +</button><button type="button" class="button-secondary" data-action="clear-selection">Borrar selección</button></div></div>`;
 return `<h2 class="latin-word" style="font-size:clamp(36px,7vw,63px)" lang="la">${esc(w.latin)}</h2>
  <p class="prompt">Resultado correcto: <strong>${esc(w.answers[0])}</strong>. Identifica los fenómenos y asócialos con sus letras o puntos de inserción.</p>
  <p class="hint-box"><strong>${guided?'Modo guiado':'Modo a ciegas'}.</strong> ${esc(description)}<br>Las respuestas se guardan y sólo se corrigen al pulsar <strong>«Comprobar todo»</strong>.</p>
  ${builder}
  <p class="analysis-help">${guided?'Asigna una norma a cada fragmento. Si dos cambios se superponen, aparecen como tarjetas independientes.':'2 · Asigna una norma a cada cambio añadido. Puedes añadir, modificar o quitar tarjetas antes de comprobar.'}</p>
  ${count?`<div class="analysis-grid">${drafts.map((d,i)=>renderDraft(w,d,i)).join('')}</div>`:'<p class="helper" style="text-align:center">Todavía no has añadido ningún cambio.</p>'}
  <div class="analysis-footer"><button type="button" class="button-primary" data-action="check-all">Comprobar todo <span aria-hidden="true">→</span></button>
  <p class="analysis-progress">${count} ${count===1?'elección guardada':'elecciones guardadas'} · ${cardState.solved.size} de ${w.changes.length} cambios identificados en la última comprobación</p>
  ${batchFeedback?`<div class="feedback ${batchFeedback.startsWith('Todos')?'success':'error'}" role="status">${esc(batchFeedback)}</div>`:''}
  </div>`;
}
function renderComplete(w){
 return `<div class="completion"><div class="success-banner" role="status"><span class="success-check" aria-hidden="true">✓</span><strong>¡Todas las normas correctas!</strong></div><p class="card-kicker" style="text-align:center">Tarjeta completada · ${cardState.mistakes===0?'Sin errores':'Con '+cardState.mistakes+' errores'}</p><div class="completed-word" lang="la">${esc(w.latin)} <span class="result-arrow" aria-hidden="true">→</span> ${esc(w.answers[0])}</div><h3>Explicación de los cambios</h3>
 ${w.changes.map(t=>`<div class="change-detail"><span class="change-tag ${t.rule==='FIX_M'?'fixed-tag':''}">${esc(ruleName(t.rule))}${t.subtype?' · '+esc(t.subtype):''}</span><strong>${esc(labelFragment(w,t))} → ${esc(t.output||'∅')}</strong><p>${esc(t.note)}</p>${t.stages?`<p>Etapas: ${esc(t.stages.join(' · '))}</p>`:''}</div>`).join('')}
 ${w.changes.some(t=>t.rule==='FIX_M')?'<p class="review-note">Normas fijas: según el criterio didáctico oficial, las formas nominales se estudian desde el acusativo. La -m final del acusativo se pierde; no es la apócope seleccionable.</p>':''}
 <p class="review-note">Fuente: Excel docente · Banco, fila ${w.source.row} · Lote ${w.source.lot}. Se respeta la terminología de las normas PAU.</p>
 <button class="button-primary full" data-action="next">${session.index+1===session.cards.length?'Ver resumen':'Siguiente palabra →'}</button></div>`;
}
// Celebración breve, sin dependencias ni bloqueo de la navegación. Se ejecuta
// solamente después de que «Comprobar todo» haya validado todos los cambios.
function celebrateCompletion(){
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const previous=document.querySelector('.celebration-layer');
 previous?.remove();
 const layer=document.createElement('div');
 layer.className='celebration-layer';
 layer.setAttribute('aria-hidden','true');
 const palette=['#36c7a1','#d8a34e','#6dbbe7','#c6a6ed','#ef8d8d'];
 for(let i=0;i<24;i++){
  const piece=document.createElement('span');
  piece.className='celebration-piece';
  const angle=(2*Math.PI*i/24)+((Math.random()-.5)*.20);
  const distance=95+Math.random()*200;
  piece.style.setProperty('--dx',`${Math.cos(angle)*distance}px`);
  piece.style.setProperty('--dy',`${Math.sin(angle)*distance+75}px`);
  piece.style.setProperty('--rot',`${Math.round(Math.random()*960-480)}deg`);
  piece.style.setProperty('--delay',`${Math.round(Math.random()*120)}ms`);
  piece.style.backgroundColor=palette[i%palette.length];
  layer.appendChild(piece);
 }
 document.body.appendChild(layer);
 window.setTimeout(()=>layer.remove(),1550);
}
function next(){if(cardState.phase!==3)return;session.done.push({latin:currentWord().latin,spanish:currentWord().answers[0],mistakes:cardState.mistakes,attempts:cardState.attempts});session.index++;if(session.index<session.cards.length)initCard();else renderFinal();}
function renderFinal(){const total=session.done.length;const perfect=session.done.filter(d=>d.mistakes===0).length;const mistakes=session.done.reduce((n,d)=>n+d.mistakes,0);
 app.innerHTML=`<div class="practice-shell"><section class="panel practice-card"><p class="eyebrow">Sesión terminada</p><h1 class="hero" style="font-family:var(--serif);font-weight:500;font-size:clamp(33px,6vw,50px);margin:0 0 12px">Repaso completado</h1><div class="summary-figure">${perfect}<span style="font-size:24px;color:var(--muted)"> / ${total}</span></div><p class="prompt">Palabras completadas sin errores · ${mistakes} errores durante la práctica.</p><div class="summary-list">${session.done.map(d=>`<div class="summary-line"><strong>${esc(d.latin)} → ${esc(d.spanish)}</strong><span>${d.mistakes===0?'✓ Sin errores':d.mistakes+' errores'}</span></div>`).join('')}</div><button type="button" class="button-primary full" style="margin-top:20px" data-action="home">Nueva práctica</button></section></div>`;}
app.addEventListener('change',event=>{
 const e=event.target;
 if(e.matches('[data-rule]')){if(e.checked)selected.add(e.dataset.rule);else selected.delete(e.dataset.rule);updateAvailable();}
 if(e.matches('input[name="mode"]')){mode=e.value;const hint=e.closest('.field').querySelector('.helper');if(hint)hint.textContent=mode==='guided'?'Se destacan los grupos que debes analizar.':'Descubre tú mismo las letras o puntos de inserción.';}
 if(e.matches('[data-draft-rule]')){
   const draft=drafts.find(d=>d.id===e.dataset.draftRule);
   if(draft){draft.rule=e.value;drafts.forEach(d=>d.status=null);batchFeedback='';
    app.querySelectorAll('.analysis-item').forEach(node=>{node.classList.remove('is-correct','is-wrong','is-missing');node.querySelector('.analysis-status').textContent='Sin comprobar';node.querySelector('.analysis-feedback')?.remove();});
    const previous=app.querySelector('.analysis-footer .feedback');if(previous)previous.remove();
   }
 }
});
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
 if(t.dataset.action==='clear-selection'){blindSpans=[];pendingStart=null;insertion=null;renderCard();return;}
 if(t.dataset.letter!==undefined){
  const i=Number(t.dataset.letter);insertion=null;
  if(pendingStart===null){pendingStart=i;}else{const start=Math.min(pendingStart,i),end=Math.max(pendingStart,i)+1;blindSpans.push([start,end]);pendingStart=null;}
  renderCard();return;
 }
 if(t.dataset.insert!==undefined){insertion=Number(t.dataset.insert);pendingStart=null;blindSpans=[];renderCard();return;}
 if(t.dataset.action==='add-selection'){
  if(pendingStart!==null || (!blindSpans.length && insertion===null))return;
  drafts.push({id:`b-${++draftSerial}`,spans:blindSpans.map(span=>[...span]),anchor:insertion??undefined,rule:'',status:null});
  drafts.forEach(d=>d.status=null);batchFeedback='';blindSpans=[];pendingStart=null;insertion=null;renderCard();
  app.querySelector(`[data-draft-rule="b-${draftSerial}"]`)?.focus();return;
 }
 if(t.dataset.removeDraft){drafts=drafts.filter(d=>d.id!==t.dataset.removeDraft);drafts.forEach(d=>d.status=null);batchFeedback='';renderCard();return;}
 if(t.dataset.action==='check-all'){
  const checked=checkAllChanges(cardState,drafts);
  const byId=new Map(checked.results.map(x=>[x.id,x.status]));
  drafts.forEach(d=>{d.status=byId.get(d.id)||null});
  batchFeedback=checked.message;
  if(!drafts.length)batchFeedback='Añade al menos un cambio antes de comprobar.';
  renderCard();
  if(checked.complete)celebrateCompletion();
  if(cardState.phase===2)app.querySelector('.analysis-footer .feedback')?.scrollIntoView({block:'nearest',behavior:'smooth'});
 }
});
async function load(){try{const response=await fetch('./data/pilot.json',{cache:'no-cache'});if(!response.ok)throw new Error('No se pudo obtener el banco de palabras.');const data=await response.json();const errors=validationErrors(data);if(errors.length)throw new Error('El banco no supera la validación: '+errors.slice(0,3).join(' · '));words=data.words;const report=coverage(words);if(RULES.some(r=>report[r.id]===0))throw new Error('El piloto no cubre todas las normas.');setUp();}catch(error){app.innerHTML=`<div class="fatal"><h1>No ha sido posible iniciar la práctica</h1><p>${esc(error.message)}</p><button class="button-secondary" onclick="location.reload()">Reintentar</button></div>`;app.setAttribute('aria-busy','false');}}
load();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
