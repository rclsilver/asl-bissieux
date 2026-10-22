// Generate a standalone checklist from the human-readable Markdown source.
// Run with Node from the repository or a development container. No dependencies.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (Boolean(process.argv[2]) !== Boolean(process.argv[3])) throw new Error('Usage: node generate-validation-sheet.mjs [source.md output.html [subtitle]]');
const sourceURL = process.argv[2] ? pathToFileURL(resolve(process.argv[2])) : new URL('../docs/fiche-validation.md', import.meta.url);
const outputURL = process.argv[3] ? pathToFileURL(resolve(process.argv[3])) : new URL('../docs/fiche-validation.html', import.meta.url);
const subtitle = process.argv[4] ?? 'Lots 1–18 et ajouts dashboard, OVH, Smocker et Viper';
const date = process.argv[4] ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(new Date()) : '21 octobre 2026';
const source = readFileSync(sourceURL, 'utf8');
const reference = source.match(/référence : `([^`]+)`/)?.[1];
if (!reference) throw new Error('Missing reference version');
const sections = [];
let section, item;
for (const line of source.split('\n')) {
  if (line.startsWith('## ')) {
    section = { title: line.slice(3), context: [], items: [] };
    sections.push(section);
    item = null;
  } else if (/^(Lots|Préparation) : /.test(line)) {
    section.context.push(line);
  } else if (/^- \[ \] \*\*/.test(line)) {
    const match = line.match(/^- \[ \] \*\*([A-Z]+\d+) — (.+)\*\*$/);
    if (!match) throw new Error('Invalid test: ' + line);
    item = { id: match[1], title: match[2] };
    section.items.push(item);
  } else if (line.startsWith('  Action : ')) {
    item.action = line.slice(11);
  } else if (line.startsWith('  Attendu : ')) {
    item.expected = line.slice(12);
  }
}
const items = sections.flatMap((s) => s.items);
if (items.length < (process.argv[2] ? 1 : 70) || new Set(items.map((i) => i.id)).size !== items.length) throw new Error('Invalid test inventory');
for (const i of items) if (!i.action || !i.expected) throw new Error('Incomplete test: ' + i.id);
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const renderCase = (i) => `<article class="test" data-test="${i.id}" data-search="${esc(i.id+' '+i.title+' '+i.action+' '+i.expected)}">
  <label class="test-title" for="check-${i.id}"><input id="check-${i.id}" type="checkbox"><span><span class="test-id">${i.id}</span> ${esc(i.title)}</span></label>
  <p><strong>Faire.</strong> ${esc(i.action)}</p>
  <p><strong>Attendu.</strong> ${esc(i.expected)}</p>
  <span class="case-status">À faire</span>
  <details><summary>Noter un écart ou une réserve</summary>
    <label for="status-${i.id}">Autre résultat pour ${i.id}</label>
    <select id="status-${i.id}"><option value="todo">À faire</option><option value="fail">Échec</option><option value="blocked">Bloqué</option><option value="na">Sans objet</option></select>
    <label for="note-${i.id}">Notes pour ${i.id} : résultat observé, reproduction, réserve</label>
    <textarea id="note-${i.id}" rows="3"></textarea>
    <p class="print-note print-only"></p>
  </details>
</article>`;

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Fiche de validation — ASL Bissieux</title>
<style>
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#202c34;background:#f5f7f8;font-size:16px;line-height:1.55;--accent:#174f65;--line:#c5ced4;--muted:#465763}
*{box-sizing:border-box}body{margin:0}a{color:var(--accent);text-underline-offset:.2em}a:visited{color:var(--accent)}a:hover{text-decoration-thickness:2px}::selection{background:#c9e5ee;color:#183f50}
input,textarea,select,button{font:inherit;color:inherit}input,textarea,select{background:#fff;border:1px solid #768994;border-radius:4px;padding:.55rem;max-width:100%;caret-color:var(--accent)}textarea{resize:vertical;width:100%}input[type=checkbox]{width:1.4rem;height:1.4rem;accent-color:var(--accent);flex:none;margin:.1rem 0 0}button{min-height:44px;border:1px solid var(--accent);border-radius:4px;background:#fff;padding:.55rem .8rem;cursor:pointer}button:hover{background:#e9f1f4}button.primary{background:var(--accent);color:#fff}button.primary:hover{background:#103c4f}button:disabled{opacity:.6;cursor:default}:focus-visible{outline:3px solid #bc6500;outline-offset:3px}
.skip{display:block;padding:.7rem;position:absolute;top:-8rem;background:white}.skip:focus{top:0;z-index:5}header,footer{max-width:1200px;margin:auto;padding:2rem 1.5rem}h1{font-size:1.9rem;line-height:1.2;margin:0 0 .8rem}h2{font-size:1.4rem;line-height:1.3;margin:0 0 .7rem}p{margin:.6rem 0;max-width:74ch}.muted{color:var(--muted)}.layout{max-width:1200px;margin:auto;display:grid;grid-template-columns:240px minmax(0,1fr);gap:2rem;padding:0 1.5rem 2rem}main{min-width:0}nav{font-size:.92rem}nav ul{padding:0;list-style:none;margin:.7rem 0}nav a{display:block;padding:.45rem 0;min-height:44px}nav details>summary{font-weight:650}
.session{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;margin:1.4rem 0}.session label{display:flex;flex-direction:column;gap:.3rem}.session input{width:100%}.toolbar{display:flex;flex-wrap:wrap;gap:.6rem;margin:1rem 0}.progress-area{padding:1rem 0;border-block:1px solid var(--line)}progress{width:100%;height:1rem;accent-color:var(--accent)}#counts{font-variant-numeric:tabular-nums}.filters{display:flex;flex-wrap:wrap;gap:1rem;margin:1.3rem 0}.filters label{display:flex;flex-direction:column;gap:.3rem}.filters input{min-width:12rem;width:100%}.filter-search{flex:1}.section{padding:1.5rem;background:#fff;border:1px solid var(--line);margin-bottom:1.8rem;border-radius:4px;scroll-margin-top:1rem}.section-context{font-size:.94rem;color:var(--muted)}.section-count{font-size:.9rem;color:var(--muted)}.test{padding:1.2rem 0;border-top:1px solid var(--line);margin-top:1rem;break-inside:avoid}.test-title{display:flex;gap:.8rem;align-items:flex-start;font-weight:650;cursor:pointer;min-height:44px}.test-id{font-size:.9rem;color:var(--muted);font-variant-numeric:tabular-nums}.test p{padding-left:2.2rem}.test details{margin:.6rem 0 0 2.2rem}.test details label{display:block;font-size:.9rem;margin:.6rem 0 .25rem}.test details select{margin-bottom:.3rem}summary{cursor:pointer;min-height:44px;padding:.5rem 0}.case-status{display:block;margin-left:2.2rem;font-size:.9rem;font-weight:650}.test[data-result=pass] .case-status{color:#24613a}.test[data-result=fail] .case-status{color:#a12a24}.test[data-result=blocked] .case-status{color:#775007}.print-only{display:none}.final{margin:2rem 0}.final label{display:block;font-weight:650;margin:1rem 0 .4rem}#empty{padding:1rem;background:#fff;border:1px solid var(--line)}[hidden]{display:none!important}footer{border-top:1px solid var(--line);font-size:.9rem}
@media(max-width:760px){.layout{grid-template-columns:minmax(0,1fr);gap:1rem;padding-inline:1rem}header,footer{padding:1.4rem 1rem}.session{grid-template-columns:minmax(0,1fr)}.section{padding:1rem}h1{font-size:1.6rem}.test p{padding-left:0}.test details{margin-left:0}.filters label{width:100%}.toolbar button{flex:1 1 160px}}
@media print{@page{margin:14mm}body{background:#fff;color:#000;font-size:10pt}header,footer,.layout{display:block;max-width:none;padding:0;margin:0}nav,.toolbar,.filters,#storage-status,.skip,progress,.section-count{display:none!important}.section{border:0;padding:0;margin:1.4rem 0}.section h2{break-after:avoid}.session{grid-template-columns:repeat(3,minmax(0,1fr))}.session input{border:0;padding:0}.section[hidden],.test[hidden]{display:block!important}.test{padding:.7rem 0;margin:0}.test p{padding:0}.test details{margin:.2rem 0}.test details summary,.test details label,.test details textarea,.test details select{display:none!important}.print-only{display:block}.test .print-note{white-space:pre-wrap;padding:0;overflow-wrap:anywhere}.test-title{min-height:0}.case-status{margin:0}.final select,.final textarea{display:none}.final .print-only{white-space:pre-wrap;overflow-wrap:anywhere}.progress-area{border:0;padding:0}.print-note:empty{display:none}.muted,.test-id,.section-context{color:#333}input[type=checkbox]{print-color-adjust:exact;width:1rem;height:1rem}.session label{break-inside:avoid}}
</style>
<style>@media print{#empty{display:none!important}}</style>
</head>
<body>
<a class="skip" href="#tests">Aller aux tests</a>
<header>
<h1>Fiche de validation — ASL Bissieux</h1>
<p class="muted">${esc(subtitle)} · Référence ${esc(reference)} · ${esc(date)}</p>
<p>Coche une case après avoir effectué le test et obtenu le résultat attendu. Pour un échec, un blocage ou un cas sans objet, utilise « Noter un écart ou une réserve ». Rien n’est prévalidé.</p>
<div class="session">
  <label for="reviewer">Validateur<input id="reviewer" autocomplete="name"></label>
  <label for="session-date">Date de la séance<input id="session-date" type="date"></label>
  <label for="environment">Navigateur / appareil<input id="environment" placeholder="Ex. Firefox, ordinateur"></label>
</div>
<div class="toolbar">
  <button id="export-html" class="primary" disabled>Enregistrer la fiche remplie</button>
  <button id="export-json" disabled>Exporter les résultats JSON</button>
  <button id="import-json" disabled>Importer des résultats</button>
  <input type="file" id="file-input" accept="application/json,.json" hidden>
  <button id="print" disabled>Imprimer / PDF</button>
</div>
<p id="storage-status" role="status">La sauvegarde automatique dépend du stockage autorisé par ton navigateur. Exporte la fiche pour conserver ou partager tes résultats.</p>
<noscript><p>Les cases restent utilisables, mais le suivi automatique nécessite JavaScript. Utilise aussi la version Markdown jointe pour une recette sur papier.</p></noscript>
<div class="progress-area"><p id="counts" role="status" aria-live="polite">0 validé sur ${items.length} tests</p><progress id="progress" value="0" max="${items.length}" aria-label="Tests validés"></progress></div>
</header>
<div class="layout">
<nav aria-label="Parcours de validation"><details open><summary>Parcours</summary><ul>${sections.map((s,n)=>`<li><a href="#section-${n}">${esc(s.title)}</a></li>`).join('')}</ul></details></nav>
<main id="tests" tabindex="-1">
<div class="filters"><label class="filter-search" for="search">Rechercher un test<input id="search" type="search" placeholder="Identifiant ou mots du test"></label><label for="filter">Afficher<select id="filter"><option value="all">Tous les résultats</option><option value="todo">À faire</option><option value="pass">Validés</option><option value="fail">Échecs</option><option value="blocked">Bloqués</option><option value="na">Sans objet</option></select></label></div>
<p id="empty" hidden>Aucun test ne correspond. Efface la recherche ou change le filtre.</p>
${sections.map((s,n)=>`<section class="section" id="section-${n}" aria-labelledby="title-${n}"><h2 id="title-${n}">${esc(s.title)}</h2>${s.context.map(c=>`<p class="section-context">${esc(c)}</p>`).join('')}<p class="section-count"></p>${s.items.map(renderCase).join('')}</section>`).join('')}
<section class="final" aria-labelledby="final-title"><h2 id="final-title">Décision de validation</h2>
<label for="verdict">Décision humaine</label><select id="verdict"><option value="">Non prononcée</option><option>Validé</option><option>Validé avec réserves</option><option>À corriger</option></select><p id="print-verdict" class="print-only"></p>
<label for="final-notes">Réserves et anomalies à transmettre (identifiants des tests)</label><textarea id="final-notes" rows="5"></textarea><p id="print-final-notes" class="print-only"></p>
<p>La progression ne prononce pas la validation à ta place. Les tests bloqués ou sans objet restent distincts des réussites. Aucun résultat n’est envoyé automatiquement à l’agent ; joins l’export à la conversation pour le partager.</p>
<p>Cette recette concerne le local : elle ne valide ni Google ou OVH en production, ni un déploiement de production. Ne saisis aucune valeur secrète dans les notes.</p>
</section>
<button id="reset" disabled>Effacer les résultats de cette fiche</button>
</main></div>
<footer>Les cases reflètent uniquement cette séance. Les tests automatisés et les validations historiques sont des éléments de preuve distincts. Si le stockage local est indisponible, utilise l’export HTML ou JSON. La fiche ne contacte aucun service et ne modifie pas l’application.</footer>
<script id="saved-state" type="application/json">{}</script>
<script>
(() => {
  'use strict';
  const reference = ${JSON.stringify(reference)};
  const key = 'asl-bissieux-validation-' + reference + '-v1';
  const rows = [...document.querySelectorAll('[data-test]')];
  const ids = new Set(rows.map(r => r.dataset.test));
  const labels = {todo:'À faire',pass:'Validé',fail:'Échec',blocked:'Bloqué',na:'Sans objet'};
  const metaIds = ['reviewer','session-date','environment','verdict','final-notes'];
  const get = id => document.getElementById(id);
  const status = text => { get('storage-status').textContent = text; };
  const result = row => get('check-' + row.dataset.test).checked ? 'pass' : get('status-' + row.dataset.test).value;
  function collect() {
    return {schema:1,project:'asl-bissieux',reference,updatedAt:new Date().toISOString(),meta:Object.fromEntries(metaIds.map(id=>[id,get(id).value])),tests:Object.fromEntries(rows.map(row=>[row.dataset.test,{result:result(row),note:get('note-'+row.dataset.test).value}]))};
  }
  function validate(state) {
    if (!state || state.schema !== 1 || state.project !== 'asl-bissieux' || state.reference !== reference || !state.tests || typeof state.tests !== 'object' || Array.isArray(state.tests) || !state.meta || typeof state.meta !== 'object') throw new Error('Ce fichier ne correspond pas à cette version de la fiche.');
    for (const [id,value] of Object.entries(state.tests)) if (!ids.has(id) || !value || !Object.hasOwn(labels,value.result) || typeof value.note !== 'string' || value.note.length > 20000) throw new Error('Résultats invalides pour le test ' + id + '.');
    for (const id of metaIds) if (state.meta[id] !== undefined && (typeof state.meta[id] !== 'string' || state.meta[id].length > 20000)) throw new Error('Informations de séance invalides.');
    if (state.meta.verdict && !['Validé','Validé avec réserves','À corriger'].includes(state.meta.verdict)) throw new Error('Décision de validation invalide.');
    return state;
  }
  function apply(state) {
    validate(state);
    for (const id of metaIds) get(id).value = state.meta[id] || '';
    for (const row of rows) {
      const id = row.dataset.test;
      const value = state.tests[id] || {result:'todo',note:''};
      get('check-'+id).checked = value.result === 'pass';
      get('status-'+id).value = value.result === 'pass' ? 'todo' : value.result;
      get('note-'+id).value = value.note;
      if (value.note || ['fail','blocked','na'].includes(value.result)) row.querySelector('details').open = true;
    }
    update();
  }
  function update() {
    const count = {todo:0,pass:0,fail:0,blocked:0,na:0};
    for (const row of rows) {
      const value = result(row); count[value]++; row.dataset.result = value;
      row.querySelector('.case-status').textContent = labels[value];
      row.querySelector('.print-note').textContent = get('note-'+row.dataset.test).value;
    }
    const text = count.pass + ' validé(s) sur ' + rows.length + ' · ' + count.todo + ' à faire · ' + count.fail + ' échec(s) · ' + count.blocked + ' bloqué(s) · ' + count.na + ' sans objet';
    if (get('counts').textContent !== text) get('counts').textContent = text;
    get('progress').value = count.pass;
    document.querySelectorAll('.section').forEach(section => {
      const tests = [...section.querySelectorAll('[data-test]')];
      section.querySelector('.section-count').textContent = tests.filter(r=>result(r)==='pass').length + ' / ' + tests.length + ' validé(s)';
    });
    get('print-verdict').textContent = get('verdict').value || 'Non prononcée';
    get('print-final-notes').textContent = get('final-notes').value;
    filter();
  }
  function filter() {
    const query = get('search').value.toLocaleLowerCase('fr').trim();
    const selection = get('filter').value;
    for (const row of rows) row.hidden = (selection !== 'all' && result(row) !== selection) || (query && !row.dataset.search.toLocaleLowerCase('fr').includes(query));
    document.querySelectorAll('.section').forEach(section=>{section.hidden = ![...section.querySelectorAll('[data-test]')].some(row=>!row.hidden);});
    get('empty').hidden = rows.some(row=>!row.hidden);
  }
  function save() {
    update();
    try { localStorage.setItem(key,JSON.stringify(collect())); status('Enregistré dans ce navigateur. Exporte la fiche pour la conserver ou la transmettre.'); }
    catch { status('Stockage local indisponible : exporte la fiche HTML ou les résultats JSON pour les conserver.'); }
  }
  function download(content,type,name) {
    const url = URL.createObjectURL(new Blob([content],{type}));
    const anchor = document.createElement('a'); anchor.href=url; anchor.download=name;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('Export demandé. Vérifie le téléchargement ; les résultats ne sont pas envoyés automatiquement.');
  }
  rows.forEach(row=>{
    const id=row.dataset.test;
    get('check-'+id).addEventListener('change',()=>{if(get('check-'+id).checked) get('status-'+id).value='todo'; save();});
    get('status-'+id).addEventListener('change',()=>{get('check-'+id).checked=false;save();});
    get('note-'+id).addEventListener('input',save);
  });
  metaIds.forEach(id=>get(id).addEventListener('input',save));
  get('search').addEventListener('input',filter); get('filter').addEventListener('change',filter);
  get('export-json').addEventListener('click',()=>download(JSON.stringify(collect(),null,2),'application/json','asl-bissieux-resultats-'+reference+'.json'));
  get('export-html').addEventListener('click',()=>{
    const clone=document.documentElement.cloneNode(true);
    clone.querySelector('#saved-state').textContent=JSON.stringify(collect()).replaceAll('<',String.fromCharCode(92)+'u003c');
    document.querySelectorAll('input[id],textarea[id],select[id]').forEach(control=>{
      const target=clone.querySelector('#'+control.id);
      if(control.type==='checkbox') { if(control.checked) target.setAttribute('checked',''); else target.removeAttribute('checked'); }
      else if(control.tagName==='TEXTAREA') target.textContent=control.value;
      else if(control.tagName==='SELECT') [...target.options].forEach(o=>{if(o.value===control.value) o.setAttribute('selected','');else o.removeAttribute('selected');});
      else if(control.type!=='file') target.setAttribute('value',control.value);
    });
    clone.querySelectorAll('[hidden]').forEach(e=>{if(e.id!=='file-input' && e.id!=='empty') e.removeAttribute('hidden');});
    clone.querySelector('#search').setAttribute('value','');
    clone.querySelector('#empty').setAttribute('hidden','');
    [...clone.querySelector('#filter').options].forEach(o=>{if(o.value==='all') o.setAttribute('selected','');else o.removeAttribute('selected');});
    download('<!doctype html>\\n'+clone.outerHTML,'text/html;charset=utf-8','asl-bissieux-fiche-remplie-'+reference+'.html');
  });
  get('import-json').addEventListener('click',()=>get('file-input').click());
  get('file-input').addEventListener('change',async()=>{
    const file=get('file-input').files[0];if(!file)return;
    try {
      if(file.size>2*1024*1024)throw new Error('Fichier trop volumineux (maximum 2 Mio).');
      const state=validate(JSON.parse(await file.text()));
      if(!window.confirm('Remplacer les résultats affichés par ceux du fichier importé ?'))return;
      apply(state);save();status('Résultats importés. Exporte une copie après tes prochaines modifications.');
    } catch(error){status('Import refusé : '+error.message);}
    finally{get('file-input').value='';}
  });
  get('reset').addEventListener('click',()=>{
    if(!window.confirm('Effacer toutes les cases, notes et informations de séance ? Exporte une copie avant de continuer.'))return;
    apply({schema:1,project:'asl-bissieux',reference,meta:{},tests:{}});save();
  });
  const printOpen=[];
  window.addEventListener('beforeprint',()=>{update();document.querySelectorAll('details').forEach(d=>{printOpen.push([d,d.open]);d.open=true;});});
  window.addEventListener('afterprint',()=>{for(const [d,open] of printOpen.splice(0))d.open=open;});
  get('print').addEventListener('click',()=>window.print());
  const candidates=[];
  try{const saved=JSON.parse(get('saved-state').textContent);if(saved.schema)candidates.push(validate(saved));}catch{status('La sauvegarde intégrée est invalide ; importer un export valide pour reprendre.');}
  try{const saved=localStorage.getItem(key);if(saved)candidates.push(validate(JSON.parse(saved)));}catch{status('Stockage local indisponible ou invalide. Utilise un export pour conserver les résultats.');}
  candidates.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  if(candidates.length)apply(candidates[0]);else update();
  for(const id of ['export-html','export-json','import-json','print','reset'])get(id).disabled=false;
})();
</script>
</body></html>`;
writeFileSync(outputURL, html);
console.log(`Generated ${items.length} tests in ${sections.length} sections for ${reference}`);
