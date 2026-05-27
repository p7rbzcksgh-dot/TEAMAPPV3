
const STORE_PREFIX = 'tcg-sop-wizard:';
let currentDraftId = null;
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const icons = {
  camera:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="14" r="4"/></svg>',
  plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
};

document.addEventListener('DOMContentLoaded', () => {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) setTimeout(() => window.scrollTo(0, 0), 0);
  initMenu();
  if ($('#sopForm')) initSopBuilder();
  if ($('#requestForm')) initRequestPage();
  if ($('#savedList')) renderSavedList();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sopwizard__sopwizard__service-worker.js').catch(() => {});
});

function initMenu(){
  const menu = $('#sideMenu');
  const shade = $('.menu-shade');
  const open = () => { menu?.classList.add('open'); shade?.classList.add('open'); menu?.setAttribute('aria-hidden','false'); };
  const close = () => { menu?.classList.remove('open'); shade?.classList.remove('open'); menu?.setAttribute('aria-hidden','true'); };
  $$('[data-menu-toggle]').forEach(btn => btn.addEventListener('click', open));
  $$('[data-menu-close]').forEach(btn => btn.addEventListener('click', close));
  document.addEventListener('keydown', e => { if(e.key === 'Escape') close(); });
}

function initSopBuilder(){
  const params = new URLSearchParams(location.search);
  currentDraftId = params.get('id');
  const date = $('#sopDate');
  if (date && !date.value) date.value = new Date().toISOString().slice(0,10);

  const template = params.get('template');
  if (currentDraftId) {
    const record = getDraft(currentDraftId);
    if (record?.sop) loadSop(record.sop); else addStep();
  } else if (template) {
    loadTemplate(decodeURIComponent(template));
  } else {
    addStep({number:'1'});
  }
  $('#addStepBtn')?.addEventListener('click', () => addStep({}, true));
  $('#saveDraftBtn')?.addEventListener('click', saveDraft);
  $('#exportHtmlBtn')?.addEventListener('click', () => exportHtml(collectSop()));
  $('#printPdfBtn')?.addEventListener('click', () => printPdf(collectSop()));
  $('#stepsWrap')?.addEventListener('click', handleStepClick);
  $('#stepsWrap')?.addEventListener('change', handleStepChange);
}

function loadTemplate(dept){
  $('#department').value = dept;
  $('#sopTitle').value = dept + ' SOP Template';
  $('#revision').value = 'R01';
  addStep({number:'1', title:'Prepare Work Area', instructions:'Confirm the work area is clean, organized, and ready. Add a setup photo before starting.', parts:[]});
  addStep({number:'2', title:'Complete Build / Process Step', instructions:'Document the process exactly how the builder should complete it. Add parts and photos inside this step.', parts:[{}]});
  addStep({number:'3', title:'Quality Check / Handoff', instructions:'Record pass/fail checks, inspection notes, and handoff details.', parts:[]});
}

function handleStepClick(e){
  const removeStep = e.target.closest('[data-remove-step]');
  if (removeStep) {
    const step = removeStep.closest('.sop-step');
    if ($$('.sop-step').length === 1) { toast('At least one step is required.'); return; }
    step.remove(); renumberSteps(); return;
  }
  const addPart = e.target.closest('[data-add-part]');
  if (addPart) { addPartRow(addPart.closest('.sop-step').querySelector('.parts-list')); return; }
  const removePart = e.target.closest('[data-remove-part]');
  if (removePart) {
    const list = removePart.closest('.parts-list');
    const row = removePart.closest('.part-row');
    if ($$('.part-row', list).length === 1) $$('input', row).forEach(i => i.value = ''); else row.remove();
    return;
  }
  const removePhoto = e.target.closest('[data-remove-photo]');
  if (removePhoto) { removePhoto.closest('figure').remove(); return; }
}

function handleStepChange(e){
  const input = e.target.closest('[data-photo-input]');
  if (!input || !input.files?.length) return;
  const step = input.closest('.sop-step');
  const grid = step.querySelector('.photo-grid');
  const files = Array.from(input.files).filter(file => file.type.startsWith('image/'));
  if (!files.length) return;
  const status = step.querySelector('[data-photo-status]');
  if (status) status.textContent = 'Processing photos...';
  Promise.all(files.map(fileToCompressedDataUrl)).then(images => {
    images.forEach(src => appendPhoto(grid, src));
    if (status) status.textContent = images.length + ' photo(s) added to this step.';
    input.value = '';
  }).catch(err => { console.error(err); if(status) status.textContent='Photo upload failed'; toast('Photo upload failed. Try a smaller image.'); });
}

function fileToCompressedDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 1400;
        const scale = Math.min(max / img.width, max / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function addStep(data={}, shouldScroll=false){
  const wrap = $('#stepsWrap'); if (!wrap) return;
  const index = $$('.sop-step', wrap).length + 1;
  const step = document.createElement('section');
  step.className = 'sop-step';
  step.dataset.step = String(index);
  step.innerHTML = `
    <div class="step-card-head">
      <div class="step-badge">Step <strong data-step-display>${escapeHTML(data.number || index)}</strong></div>
      <button type="button" class="remove-step" data-remove-step aria-label="Remove step">×</button>
    </div>
    <div class="step-fields">
      <div class="step-two-col">
        <label>Step Number<input data-step-number value="${escapeAttr(data.number || index)}" placeholder="${index}"></label>
        <label>Step Title<input data-step-title placeholder="e.g., Install roller shaft set" value="${escapeAttr(data.title || '')}"></label>
      </div>
      <label>Build Instructions<textarea data-step-instructions placeholder="Write the step exactly how the builder should do it...">${escapeText(data.instructions || '')}</textarea></label>
      <label>Quality / Safety Notes <span class="optional-text">Optional</span><textarea data-step-quality placeholder="Orientation checks, warnings, torque notes, inspection requirements...">${escapeText(data.quality || '')}</textarea></label>
    </div>
    <div class="photo-panel">
      <div class="mini-panel-head"><h3>Step Photos</h3><span data-photo-status class="photo-status">Add as many photos as needed.</span></div>
      <label class="photo-label">${icons.camera} Add / Take Photos<input data-photo-input type="file" accept="image/*" capture="environment" multiple></label>
      <div class="photo-grid"></div>
    </div>
    <div class="parts-panel">
      <div class="parts-head"><h3>Parts Used In This Step</h3></div>
      <div class="parts-list"></div>
      <button type="button" class="small-link add-part-bottom" data-add-part>+ Add Another Part</button>
    </div>`;
  wrap.appendChild(step);
  const list = step.querySelector('.parts-list');
  const parts = Array.isArray(data.parts) && data.parts.length ? data.parts : [{}];
  parts.forEach(part => addPartRow(list, part));
  if (Array.isArray(data.photos)) data.photos.forEach(src => appendPhoto(step.querySelector('.photo-grid'), src));
  renumberSteps(false);
  if (shouldScroll) step.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function addPartRow(list, part={}){
  const row = document.createElement('div');
  row.className = 'part-row';
  row.innerHTML = `
    <label>Part #<input data-part-number placeholder="Part #" value="${escapeAttr(part.number || '')}"></label>
    <label>Qty<input data-part-qty type="number" inputmode="decimal" min="0" step="0.01" placeholder="Qty" value="${escapeAttr(part.qty || '')}"></label>
    <label>Description<input data-part-desc placeholder="Description" value="${escapeAttr(part.description || '')}"></label>
    <button type="button" class="icon-remove" data-remove-part aria-label="Remove part">×</button>`;
  list.appendChild(row);
}

function appendPhoto(grid, src){
  const fig = document.createElement('figure');
  fig.className = 'photo-thumb';
  fig.innerHTML = `<img src="${src}" alt="SOP step photo"><button type="button" class="remove-photo" data-remove-photo aria-label="Remove photo">×</button>`;
  grid.appendChild(fig);
}

function renumberSteps(updateEmpty=true){
  $$('.sop-step').forEach((step, idx) => {
    step.dataset.step = String(idx+1);
    const input = step.querySelector('[data-step-number]');
    if (updateEmpty && input && !input.value.trim()) input.value = String(idx+1);
    const display = step.querySelector('[data-step-display]');
    if (display) display.textContent = input?.value?.trim() || String(idx+1);
    input?.addEventListener('input', () => { if(display) display.textContent = input.value.trim() || String(idx+1); }, {once:true});
  });
}

function collectSop(){
  const val = id => ($(id)?.value || '').trim();
  const sop = {
    title: val('#sopTitle'), sopNumber: val('#sopNumber'), mainAssembly: val('#mainAssembly'), date: val('#sopDate'), revision: val('#revision'),
    author: val('#author'), department: val('#department'), updatedAt: new Date().toISOString(), steps: []
  };
  $$('.sop-step').forEach((step, idx) => {
    const parts = $$('.part-row', step).map(row => ({
      number: row.querySelector('[data-part-number]')?.value.trim() || '',
      qty: row.querySelector('[data-part-qty]')?.value.trim() || '',
      description: row.querySelector('[data-part-desc]')?.value.trim() || ''
    })).filter(p => p.number || p.qty || p.description);
    const photos = $$('.photo-grid img', step).map(img => img.src);
    sop.steps.push({
      number: step.querySelector('[data-step-number]')?.value.trim() || String(idx+1),
      title: step.querySelector('[data-step-title]')?.value.trim() || '',
      instructions: step.querySelector('[data-step-instructions]')?.value.trim() || '',
      quality: step.querySelector('[data-step-quality]')?.value.trim() || '',
      parts, photos
    });
  });
  return sop;
}

function loadSop(sop){
  $('#sopTitle').value = sop.title || '';
  $('#sopNumber').value = sop.sopNumber || '';
  if ($('#mainAssembly')) $('#mainAssembly').value = sop.mainAssembly || 'SBX';
  $('#sopDate').value = sop.date || new Date().toISOString().slice(0,10);
  $('#revision').value = sop.revision || '';
  $('#author').value = sop.author || '';
  $('#department').value = sop.department || 'Assembly';
  $('#stepsWrap').innerHTML = '';
  if (sop.steps?.length) sop.steps.forEach(addStep); else addStep();
}

function saveDraft(){
  const sop = collectSop();
  if (!sop.title) { toast('Add an SOP title before saving.'); $('#sopTitle')?.focus(); return; }
  if (!currentDraftId) currentDraftId = 'draft-' + Date.now();
  const record = { id: currentDraftId, updatedAt: new Date().toISOString(), sop };
  try {
    localStorage.setItem(STORE_PREFIX + currentDraftId, JSON.stringify(record));
    history.replaceState(null, '', 'sopwizard__sopwizard__create-sop.html?id=' + encodeURIComponent(currentDraftId));
    toast('Draft saved on this device.');
  } catch (err) { console.error(err); toast('Draft is too large to save locally. Export HTML instead.'); }
}

function getDraft(id){ try { return JSON.parse(localStorage.getItem(STORE_PREFIX + id) || 'null'); } catch(e){ return null; } }
function allDrafts(){
  const records=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key?.startsWith(STORE_PREFIX)){ try{ const rec=JSON.parse(localStorage.getItem(key)); if(rec?.sop) records.push(rec); }catch(e){} }
  }
  return records.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
}

function renderSavedList(){
  const list=$('#savedList'); if(!list) return;
  const drafts=allDrafts();
  if(!drafts.length){
    list.innerHTML = `<div class="empty-state glass-card"><img src="sopwizard__sopwizard__tcg-cogs-branding.png" alt=""><h2>No saved SOPs yet</h2><p>Create a new SOP and tap Save Draft. Drafts stay on this device until exported or browser data is cleared.</p><a class="glow-btn" href="sopwizard__sopwizard__create-sop.html">${icons.plus} Create A New SOP</a></div>`;
    return;
  }
  list.innerHTML = drafts.map(rec => `<article class="saved-card"><h2>${escapeHTML(rec.sop.title || 'Untitled SOP')}</h2><p>${escapeHTML(rec.sop.mainAssembly || 'SBX')} · ${escapeHTML(rec.sop.department || '')} · ${escapeHTML(rec.sop.revision || '')} · ${new Date(rec.updatedAt).toLocaleString()}</p><div class="saved-actions"><a class="glow-btn" href="sopwizard__sopwizard__create-sop.html?id=${encodeURIComponent(rec.id)}">Open Draft</a><button class="glow-btn" type="button" data-export-saved="${escapeAttr(rec.id)}">Export HTML</button><button class="glow-btn" type="button" data-delete-saved="${escapeAttr(rec.id)}">Delete</button></div></article>`).join('');
  list.addEventListener('click', e => {
    const exp=e.target.closest('[data-export-saved]');
    if(exp){ const rec=getDraft(exp.dataset.exportSaved); if(rec?.sop) exportHtml(rec.sop); }
    const del=e.target.closest('[data-delete-saved]');
    if(del && confirm('Delete this saved draft from this device?')){ localStorage.removeItem(STORE_PREFIX + del.dataset.deleteSaved); renderSavedList(); }
  }, {once:true});
}

function exportHtml(sop){
  if(!sop.title){ toast('Add an SOP title before exporting.'); $('#sopTitle')?.focus(); return; }
  const html = buildExportHtml(sop);
  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=safeFileName(`${sop.sopNumber || sop.title || 'TCG-SOP'}.html`);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  toast('HTML export downloaded.');
}

function printPdf(sop){
  if(!sop.title){ toast('Add an SOP title before printing.'); $('#sopTitle')?.focus(); return; }
  const win = window.open('', '_blank');
  if(!win){ toast('Popup blocked. Allow popups to print/save PDF.'); return; }
  win.document.open();
  win.document.write(buildExportHtml(sop));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 650);
}

function buildExportHtml(sop){
  const rows = [
    ['SOP Title', sop.title], ['SOP Number', sop.sopNumber], ['Main Assembly', sop.mainAssembly], ['Date', sop.date], ['Revision', sop.revision], ['Author', sop.author], ['Department', sop.department]
  ].map(([k,v])=>`<tr><th>${k}</th><td>${escapeHTML(v||'')}</td></tr>`).join('');
  const steps = sop.steps.map(step => {
    const parts = step.parts.length ? `<table class="parts"><thead><tr><th>Part #</th><th>Qty</th><th>Description</th></tr></thead><tbody>${step.parts.map(p=>`<tr><td>${escapeHTML(p.number)}</td><td>${escapeHTML(p.qty)}</td><td>${escapeHTML(p.description)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No parts listed for this step.</p>';
    const photos = step.photos.length ? `<div class="photos">${step.photos.map(src=>`<img src="${src}" alt="Step photo">`).join('')}</div>` : '<p class="muted">No photos added.</p>';
    return `<section class="step"><h2>Step ${escapeHTML(step.number)}: ${escapeHTML(step.title || '')}</h2><h3>Instructions</h3><p>${nl2br(escapeHTML(step.instructions || ''))}</p>${step.quality ? `<h3>Quality / Safety Notes</h3><p>${nl2br(escapeHTML(step.quality))}</p>`:''}<h3>Parts Used</h3>${parts}<h3>Photos</h3>${photos}</section>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(sop.title)} | TCG SOP</title><style>
    body{font-family:Arial,system-ui,sans-serif;margin:0;background:#f7f7f7;color:#111}main{max-width:980px;margin:0 auto;padding:28px}.cover{background:#111;color:#fff;padding:24px;border-radius:18px}.cover h1{margin:0 0 8px;text-transform:uppercase}.meta{width:100%;border-collapse:collapse;margin:18px 0;background:#fff}.meta th,.meta td,.parts th,.parts td{border:1px solid #ddd;padding:8px;text-align:left}.meta th{width:180px;background:#f0f0f0}.step{background:#fff;border:1px solid #ddd;border-radius:16px;margin:18px 0;padding:20px;break-inside:avoid}.step h2{color:#d86600;margin-top:0}.step h3{margin-bottom:6px}.parts{width:100%;border-collapse:collapse}.parts th{background:#f0f0f0}.photos{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.photos img{width:100%;border-radius:10px;border:1px solid #ddd}.muted{color:#666}@media print{body{background:#fff}main{padding:0}.cover,.step{border-radius:0}}
  </style></head><body><main><section class="cover"><h1>${escapeHTML(sop.title)}</h1><p>TCG Machines Standard Operating Procedure</p></section><table class="meta"><tbody>${rows}</tbody></table>${steps}</main></body></html>`;
}

function toast(msg){
  let t=$('.toast');
  if(!t){ t=document.createElement('div'); t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toast._timer); toast._timer=setTimeout(()=>t.classList.remove('show'), 2600);
}
function safeFileName(name){ return name.replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'_'); }
function escapeHTML(str=''){ return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function escapeAttr(str=''){ return escapeHTML(str).replace(/`/g,'&#96;'); }
function escapeText(str=''){ return escapeHTML(str); }
function nl2br(str=''){ return String(str).replace(/\n/g,'<br>'); }


/* Required SOPs / Urgent Process Change pages */
function initRequestPage(){
  const type = document.body.dataset.requestType || 'required';
  const storageKey = STORE_PREFIX + 'requests:' + type;
  const list = $('#requestList');
  if (!list) return;

  const saved = loadRequestList(storageKey);
  if (saved.length) saved.forEach(item => addRequestCard(item, false));
  else addRequestCard({}, false);

  $$('[data-add-request]').forEach(btn => btn.addEventListener('click', () => addRequestCard({}, true)));
  $('[data-save-request-list]')?.addEventListener('click', () => saveRequestList(storageKey, type));
  $('[data-export-request-list]')?.addEventListener('click', () => exportRequestList(type));
  $('[data-print-request-list]')?.addEventListener('click', () => printRequestList(type));

  list.addEventListener('click', e => {
    const remove = e.target.closest('[data-remove-request]');
    if (remove) {
      const cards = $$('.request-card', list);
      if (cards.length === 1) {
        clearRequestCard(cards[0]);
        toast('Cleared the request card.');
      } else {
        remove.closest('.request-card').remove();
        renumberRequestCards();
      }
      return;
    }

    const box = e.target.closest('[data-status-box]');
    if (box) setStatus(box.closest('.request-card'), box.value);
  });

  list.addEventListener('change', e => {
    const fileInput = e.target.closest('[data-existing-sop-upload]');
    if (!fileInput || !fileInput.files?.length) return;
    handleExistingSopUpload(fileInput);
  });
}

function loadRequestList(storageKey){
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch(e) {
    return [];
  }
}

function addRequestCard(data={}, shouldScroll=false){
  const list = $('#requestList');
  const type = document.body.dataset.requestType || 'required';
  const index = $$('.request-card', list).length + 1;
  const isUrgent = type === 'urgent';
  const status = data.status || 'incomplete';
  const card = document.createElement('section');
  card.className = 'request-card sop-step';
  card.dataset.request = String(index);
  card.innerHTML = `
    <div class="request-main">
      <div class="request-card-head">
        <div class="step-badge">Request <strong data-request-display>${index}</strong></div>
        <button type="button" class="remove-step" data-remove-request aria-label="Remove request">×</button>
      </div>
      <div class="request-fields">
        <label>SOP Description<textarea data-request-description placeholder="Describe the SOP or urgent process change needed...">${escapeText(data.description || '')}</textarea></label>
        <label>SAA / SA / MA / Procedure<input data-request-code placeholder="e.g., SA075, MFG0390, Procedure name" value="${escapeAttr(data.code || '')}"></label>
        <label>Requested Date<input data-request-date type="date" value="${escapeAttr(data.date || '')}"></label>
        <label>Requested By<input data-request-by placeholder="Name" value="${escapeAttr(data.requestedBy || '')}"></label>
      </div>
      ${isUrgent ? urgentUploadBlock(data) : ''}
    </div>
    <aside class="request-status" aria-label="Request status">
      <p>Status</p>
      <label class="check-row"><input type="checkbox" data-status-box value="incomplete" ${status !== 'complete' ? 'checked' : ''}> Incomplete</label>
      <label class="check-row"><input type="checkbox" data-status-box value="complete" ${status === 'complete' ? 'checked' : ''}> Complete</label>
    </aside>`;
  list.appendChild(card);
  if (!data.date && card.querySelector('[data-request-date]')) card.querySelector('[data-request-date]').value = new Date().toISOString().slice(0,10);
  if (shouldScroll) card.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function urgentUploadBlock(data={}){
  return `
    <div class="urgent-upload-panel">
      <div class="mini-panel-head">
        <h3>Existing SOP Upload / Edit</h3>
        <span class="photo-status" data-upload-status>${escapeHTML(data.fileName || 'No SOP uploaded yet.')}</span>
      </div>
      <label class="photo-label">${icons.plus} Upload Existing SOP
        <input data-existing-sop-upload type="file" accept=".html,.htm,.txt,.md,.pdf,.doc,.docx,application/pdf,text/html,text/plain">
      </label>
      <label>Editable SOP Text / Change Notes
        <textarea data-existing-sop-text placeholder="If an HTML/TXT SOP is uploaded, the readable text will load here. For PDF/Word files, add the change notes here.">${escapeText(data.existingText || '')}</textarea>
      </label>
    </div>`;
}

function clearRequestCard(card){
  $$('input, textarea', card).forEach(el => {
    if (el.type === 'checkbox') el.checked = el.value === 'incomplete';
    else el.value = '';
  });
  const status = card.querySelector('[data-upload-status]');
  if (status) status.textContent = 'No SOP uploaded yet.';
}

function setStatus(card, status){
  $$('[data-status-box]', card).forEach(box => box.checked = box.value === status);
}

function renumberRequestCards(){
  $$('.request-card').forEach((card, idx) => {
    card.dataset.request = String(idx+1);
    const display = card.querySelector('[data-request-display]');
    if (display) display.textContent = String(idx+1);
  });
}

function handleExistingSopUpload(input){
  const file = input.files[0];
  const card = input.closest('.request-card');
  const status = card.querySelector('[data-upload-status]');
  const textArea = card.querySelector('[data-existing-sop-text]');
  if (status) status.textContent = file.name;

  const readable = file.type.includes('text') || /\.(html?|txt|md)$/i.test(file.name);
  if (!readable) {
    if (textArea && !textArea.value.trim()) {
      textArea.value = `Uploaded file: ${file.name}\n\nAdd the urgent process change notes here.`;
    }
    toast('File attached. Add change notes in the text box.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    let content = String(reader.result || '');
    if (/\.html?$/i.test(file.name)) {
      const doc = new DOMParser().parseFromString(content, 'text/html');
      content = doc.body?.innerText || content;
    }
    if (textArea) textArea.value = content.trim();
    toast('Existing SOP loaded for editing.');
  };
  reader.onerror = () => toast('Could not read that file.');
  reader.readAsText(file);
}

function collectRequestList(){
  const type = document.body.dataset.requestType || 'required';
  return {
    type,
    updatedAt: new Date().toISOString(),
    items: $$('.request-card').map((card, idx) => ({
      number: idx + 1,
      description: card.querySelector('[data-request-description]')?.value.trim() || '',
      code: card.querySelector('[data-request-code]')?.value.trim() || '',
      date: card.querySelector('[data-request-date]')?.value.trim() || '',
      requestedBy: card.querySelector('[data-request-by]')?.value.trim() || '',
      status: card.querySelector('[data-status-box][value="complete"]')?.checked ? 'complete' : 'incomplete',
      fileName: card.querySelector('[data-upload-status]')?.textContent?.replace('No SOP uploaded yet.','').trim() || '',
      existingText: card.querySelector('[data-existing-sop-text]')?.value.trim() || ''
    }))
  };
}

function saveRequestList(storageKey, type){
  const data = collectRequestList();
  try {
    localStorage.setItem(storageKey, JSON.stringify(data.items));
    toast(type === 'urgent' ? 'Urgent changes saved on this device.' : 'Required SOP list saved on this device.');
  } catch(e) {
    toast('List is too large to save locally. Export HTML instead.');
  }
}

function exportRequestList(type){
  const data = collectRequestList();
  const html = buildRequestExportHtml(data);
  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const a=document.createElement('a');
  const title = data.type === 'urgent' ? 'Urgent_Process_Changes' : 'Required_SOPs';
  a.href=URL.createObjectURL(blob);
  a.download=safeFileName(`${title}.html`);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  toast('HTML export downloaded.');
}

function printRequestList(type){
  const data = collectRequestList();
  const win = window.open('', '_blank');
  if(!win){ toast('Popup blocked. Allow popups to print/save PDF.'); return; }
  win.document.open();
  win.document.write(buildRequestExportHtml(data));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 650);
}

function buildRequestExportHtml(data){
  const title = data.type === 'urgent' ? 'Urgent Process Changes' : 'Required SOPs';
  const rows = data.items.map(item => `
    <section class="item">
      <h2>${title.slice(0,-1)} ${item.number}</h2>
      <table>
        <tr><th>SOP Description</th><td>${escapeHTML(item.description)}</td></tr>
        <tr><th>SAA / SA / MA / Procedure</th><td>${escapeHTML(item.code)}</td></tr>
        <tr><th>Requested Date</th><td>${escapeHTML(item.date)}</td></tr>
        <tr><th>Requested By</th><td>${escapeHTML(item.requestedBy)}</td></tr>
        <tr><th>Status</th><td>${escapeHTML(item.status)}</td></tr>
        ${item.fileName ? `<tr><th>Uploaded SOP</th><td>${escapeHTML(item.fileName)}</td></tr>` : ''}
      </table>
      ${item.existingText ? `<h3>Existing SOP Text / Change Notes</h3><pre>${escapeHTML(item.existingText)}</pre>` : ''}
    </section>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | TCG SOP Wizard</title><style>
    body{font-family:Arial,system-ui,sans-serif;margin:0;background:#f7f7f7;color:#111}main{max-width:980px;margin:0 auto;padding:28px}.cover{background:#111;color:#fff;padding:24px;border-radius:18px}.cover h1{margin:0;text-transform:uppercase}.item{background:#fff;border:1px solid #ddd;border-radius:16px;margin:18px 0;padding:20px;break-inside:avoid}.item h2{color:#d86600;margin-top:0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}th{width:220px;background:#f0f0f0}pre{white-space:pre-wrap;background:#f3f3f3;border:1px solid #ddd;border-radius:10px;padding:12px}@media print{body{background:#fff}main{padding:0}.cover,.item{border-radius:0}}
  </style></head><body><main><section class="cover"><h1>${title}</h1><p>TCG Machines SOP Wizard · Exported ${new Date(data.updatedAt).toLocaleString()}</p></section>${rows}</main></body></html>`;
}

