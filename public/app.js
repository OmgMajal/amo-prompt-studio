const $ = s => document.querySelector(s);
const form = $('#brief-form');
let config, current, tab = 'package', poll, busy = false;
const labels = { queued:'Queued', running:'Working', example_only:'Template example', human_review:'Human review needed', changes_requested:'Changes requested', blocked:'Blocked', failed:'Failed', cancelled:'Stopped', interrupted:'Interrupted' };
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path, options) {
  const response = await fetch(path,options); const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.'); return result;
}
function error(message='') { $('#error').textContent = message; }
function team() {
  $('#team').innerHTML = config.specialists.map((r,i) => {
    const events = current?.events.filter(e => e.role === r.id) || [];
    const latest = events.at(-1)?.status;
    const state = latest === 'running' && current?.status === 'running' ? 'Working' : latest === 'completed' ? current.mode === 'preview' ? 'Template rendered' : 'Output recorded' : current && !['queued','running'].includes(current.status) ? 'Not completed' : 'Waiting for brief';
    return `<div class="team-card ${state === 'Working' ? 'working' : ''}"><span class="avatar">${['B','E','S','W','V','F','R'][i]}</span><div><strong>${escape(r.name)}</strong><small>${state}</small></div></div>`;
  }).join('');
}
function targetPicker() {
  const registry = config?.platformRegistry || {};
  const picker = $('#target-picker'); if (!picker) return;
  picker.innerHTML = Object.values(registry).map(definition => Object.values(definition.surfaces).map(surface => `<label class="target-option"><input type="checkbox" data-target-label="${escape(`${definition.name} ${surface.label}`)}"><span><strong>${escape(definition.name)}</strong><small>${escape(surface.label)} · ${escape(surface.format)}</small></span></label>`).join('')).join('');
  picker.querySelectorAll('input[data-target-label]').forEach(input => input.onchange = () => {
    const selected = [...picker.querySelectorAll('input:checked')].map(item => item.dataset.targetLabel);
    if (selected.length) form.elements.platforms.value = selected.join(', ');
  });
}
async function history() {
  const runs = await api('/api/runs');
  $('#history').innerHTML = runs.length ? runs.map(r => `<button data-run="${escape(r.id)}">${escape(r.business)}<small>${r.mode === 'preview' ? 'Template' : 'Live'} · ${escape(labels[r.status])}</small></button>`).join('') : '<p>No runs yet. Start with a brief.</p>';
  $('#history').querySelectorAll('[data-run]').forEach(button => button.onclick = () => openRun(button.dataset.run).catch(e=>error(e.message)));
}
function note() {
  const live = form.elements.mode.value === 'live';
  const research = form.elements.webResearch?.checked;
  $('#mode-note').textContent = live ? config?.provider === 'ollama' ? `Real AI on this Mac · No API fees or key. ${research ? 'Seven' : 'Six'} specialist calls share one local model; local inference is queued to fit memory. Human review is required.` : `Live sends your brief to the configured provider. Up to ${research ? 7 : 6} calls, 6,000 output tokens each; provider charges apply. No fixed price cap. Human review is required.` : research ? 'Preview records a research plan but does not contact the web or model. Live research saves unverified source candidates for human verification.' : 'Preview adapts fixed templates to your brief. It does not simulate a real AI review.';
}
function render() {
  team(); if (!current) return;
  $('#run-status').textContent = labels[current.status] || current.status;
  const pending = ['queued','running'].includes(current.status);
  $('#run-actions').hidden = false; $('#cancel').hidden = !pending;
  const msg = current.mode === 'preview' ? 'TEMPLATE PREVIEW · No AI specialists were invoked. These are editable examples, not reviewed AI outputs.' : current.connection?.provider === 'ollama' ? `LOCAL AI · ${current.connection.model} on this Mac. No API fees. Separate specialist calls; human review still required.` : 'LIVE RUN · Separate calls to the same model. Outputs remain unverified until you review them.';
  const targetSummary = (current.platformTargets || []).map(t => `${t.platformName} / ${t.surfaceName}`).join(' · ');
  $('#run-summary').innerHTML = `<div class="notice ${current.mode === 'preview' ? 'warning' : ''}">${msg}</div>${targetSummary ? `<p class="helper"><strong>Platform targets:</strong> ${escape(targetSummary)}</p>` : ''}${current.error ? `<div class="notice warning">${escape(current.error)}</div>` : ''}`;
  const target = $('#result-content');
  if (tab === 'package') {
    const cards = ['copy','visual','format'].flatMap(id => (current.outputs[id]?.deliverables || []).map(d => ({...d, role:id})));
    target.innerHTML = cards.length ? cards.map((d,i) => `<article class="output-card"><h3><span>${d.role === 'copy' ? '↗ Writing' : d.role === 'visual' ? '◈ Visual' : '▣ Format'} · ${escape(d.title)}</span><button data-copy="${i}">Copy prompt</button></h3><p class="prompt-body">${escape(d.prompt)}</p><div class="criteria">ACCEPTANCE CRITERIA<ul>${d.acceptanceCriteria.map(c=>`<li>${escape(c)}</li>`).join('')}</ul></div></article>`).join('') : '<div class="empty-state"><h3>The studio is gathering context.</h3><p>Prompts appear after the analyst and strategy handoffs.</p></div>';
    target.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(cards[Number(b.dataset.copy)].prompt); b.textContent='Copied'; } catch { error('Copy was unavailable. Select the prompt text or export the package.'); } });
    const review = current.outputs.review;
    if (review) target.insertAdjacentHTML('beforeend',`<div class="notice warning"><strong>${current.mode === 'preview' ? 'Illustrative review' : 'Reviewer decision'}: ${escape(review.review.verdict.replaceAll('_',' '))}</strong><ul>${review.review.findings.map(f=>`<li>${escape(f)}</li>`).join('')}</ul></div>`);
  } else if (tab === 'collaboration') {
    target.innerHTML = config.specialists.map(role => {
      const out = current.outputs[role.id];
      if (!out) return `<article class="handoff"><h3>${escape(role.name)}</h3><p>No output recorded.</p></article>`;
      return `<article class="handoff"><h3>${escape(role.name)}</h3><p>${escape(out.summary)}</p><details><summary>Facts, sources, assumptions & disagreements</summary><p>Fact references: ${out.factsUsed.map(escape).join(', ') || 'None'}. User-provided; unverified.</p><p>Web source references: ${(out.sourcesUsed || []).map(escape).join(', ') || 'None'}. Search candidates remain unverified.</p><p><strong>Assumptions</strong></p><ul>${out.assumptions.map(a=>`<li>${escape(a.statement)} — Basis: ${escape(a.basis)}</li>`).join('') || '<li>None reported by this role.</li>'}</ul><p><strong>Uncertainties</strong></p><ul>${out.uncertainties.map(a=>`<li>${escape(a)}</li>`).join('') || '<li>None reported; this does not prove certainty.</li>'}</ul><p><strong>Disagreements</strong></p><ul>${out.disagreements.map(a=>`<li>With ${escape(a.withRole)}: ${escape(a.reason)}</li>`).join('') || '<li>None reported; agreement does not prove correctness.</li>'}</ul></details></article>`;
    }).join('');
  } else {
    const compound = current.compound;
    target.innerHTML = `${current.mode === 'preview' ? '<p class="helper">Checks below concern template structure. They are not evidence of AI quality or truthfulness.</p>' : '<p class="helper">Structural checks and a model review do not verify factual accuracy.</p>'}${current.checks.map(c=>`<div class="check ${c.passed ? 'pass' : 'fail'}"><span>${c.passed ? '✓' : '○'}</span>${escape(c.name)}</div>`).join('')}${compound ? `<div class="handoff"><h3>Compound package · ${escape(compound.registryVersion)}</h3><p>${escape(compound.targets.length)} platform targets are bundled with strategy, content needs, and confirmation requirements. Publication is disabled; human decision required.</p><ul>${(compound.strategyPlan || []).map(plan=>`<li><strong>${escape(plan.targetName)}</strong> · ${escape(plan.contentNeeds.length)} content needs · ${escape(plan.channelRole)}</li>`).join('')}${compound.targets.map(item=>`<li><strong>${escape(item.target.platformName)} / ${escape(item.target.surfaceName)}</strong> · ${escape(item.target.format)}</li>`).join('')}</ul></div>` : ''}${current.webResearch?.enabled ? `<div class="handoff"><h3>Web research · ${escape(current.webResearch.status)}</h3><p>Search results are unverified candidates, not business facts. ${escape(current.webResearch.sources?.length || 0)} source candidates saved.</p><ul>${(current.webResearch.sources || []).map(source=>`<li><a href="${escape(source.url)}" target="_blank" rel="noreferrer">${escape(source.title || source.id)}</a><br>${escape(source.snippet || '')}</li>`).join('') || '<li>No source candidates returned.</li>'}</ul></div>` : ''}<div class="handoff"><h3>Source brief · saved with this run</h3><ul class="facts-list">${current.facts.map(f=>`<li><strong>${escape(f.id)}</strong>: ${escape(f.text)}<br>User-provided · unverified</li>`).join('')}</ul></div><div class="handoff"><h3>Execution record</h3>${current.events.map(e=>`<div class="evidence-event"><span>${escape(new Date(e.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</span><div><strong>${escape(e.role)} · ${escape(e.status)}</strong>${escape(e.detail)}</div></div>`).join('')}</div><div class="handoff"><h3>Known limits</h3><ul>${current.limitations.map(l=>`<li>${escape(l)}</li>`).join('')}</ul></div>`;
  }
}
async function openRun(id) {
  clearTimeout(poll); current = await api(`/api/runs/${id}`); render();
  if (['queued','running'].includes(current.status)) poll = setTimeout(()=>openRun(id).catch(e=>error(e.message)),900);
  else await history();
}
form.onsubmit = async event => {
  event.preventDefault(); if (busy) return; error(); busy = true; $('#start').disabled = true;
  try {
    const brief = Object.fromEntries(['business','niche','audience','objective','voice','platforms','products','constraints','approvalOwner','successCriteria','riskNotes','validationPlan'].map(key=>[key,form.elements[key].value]));
    const {id} = await api('/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brief,mode:form.elements.mode.value,webResearch:form.elements.webResearch.checked})});
    await openRun(id); await history();
  } catch (e) { error(e.message); } finally { busy=false; $('#start').disabled=false; }
};
$('#example').onclick = () => {
  const example = { business:'Sunday Crumb (fictional)', niche:'Neighborhood bakery', audience:'Local residents planning a relaxed weekend breakfast', objective:'Encourage people to visit the bakery this weekend', platforms:'Instagram feed and Stories', voice:'Warm, inviting, simple; no exaggerated claims', products:'Fictional example: sourdough loaves and cinnamon rolls. No pricing, opening hours, or photographs supplied.', constraints:'English. No discounts, health claims, invented testimonials, or unsupported ingredient claims. Ask for opening hours and approved product references.' };
  for (const [key,value] of Object.entries(example)) form.elements[key].value=value;
};
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{ tab=button.dataset.tab; document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===button))); render(); });
$('#open-rules').onclick=()=>$('#rules-dialog').showModal();
$('#close-rules').onclick=()=>$('#rules-dialog').close();
$('#refresh-history').onclick=()=>history().catch(e=>error(e.message));
$('#new-brief').onclick=()=>{ form.reset(); note(); form.elements.business.focus(); };
form.querySelectorAll('[name=mode]').forEach(input=>input.onchange=note);
form.elements.webResearch.onchange=note;
$('#cancel').onclick=async()=>{ if (!current) return; try { await api(`/api/runs/${current.id}/cancel`,{method:'POST'}); $('#cancel').textContent='Stopping…'; } catch(e) {error(e.message);} };
$('#export').onclick=()=>{
  if (!current) return;
  const blob = new Blob([JSON.stringify(current,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`prompt-studio-${current.id}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('#export-compound').onclick=async()=>{
  if (!current) return;
  try { const response=await fetch(`/api/runs/${current.id}/compound.md`); if (!response.ok) throw Error('Compound package is not available yet.'); const blob=await response.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`prompt-studio-${current.id}.md`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); } catch(e) { error(e.message); }
};
try {
  config=await api('/api/config'); targetPicker(); $('#live-mode').disabled=!config.liveConfigured;
  $('#live-description').textContent=config.liveConfigured ? config.provider === 'ollama' ? 'Local AI · No API fees' : 'Provider charges apply' : config.connectionMessage || 'Connection needed';
  if (config.liveConfigured && config.provider === 'ollama') $('#live-mode').checked = true;
  $('#rules-text').textContent=config.rules; team(); note(); await history();
} catch(e) { error(`Studio unavailable: ${e.message}`); $('#start').disabled=true; }
