import { randomUUID } from 'node:crypto';
import { RULES, SPECIALISTS } from './rules.mjs';
import { normalizePlatformTargets } from './platforms.mjs';
import { buildCompoundPackage } from './compound.mjs';
import { evaluatePlatformOutputs } from './evaluate.mjs';
import { researchBrief, previewResearch } from './research.mjs';

const DRAFT_ROLES = ['copy', 'visual', 'format'];

export const BRIEF_FIELDS = ['business', 'niche', 'audience', 'objective', 'voice', 'platforms', 'products', 'constraints', 'approvalOwner', 'successCriteria', 'riskNotes', 'validationPlan'];
export function normalizeBrief(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Provide a business brief.');
  const brief = Object.fromEntries(BRIEF_FIELDS.map(key => {
    const raw = value[key] ?? '';
    if (typeof raw !== 'string' || raw.length > 4000) throw new Error(`Invalid ${key}: use text up to 4,000 characters.`);
    return [key, raw.trim()];
  }));
  for (const key of ['business', 'audience', 'objective', 'platforms']) if (!brief[key]) throw new Error(`Please complete ${key}.`);
  return brief;
}
export function newRun(input, mode = 'preview', { webResearch = false } = {}) {
  if (!['preview', 'live'].includes(mode)) throw new Error('Choose preview or live mode.');
  const brief = normalizeBrief(input);
  const platformTargets = normalizePlatformTargets(brief.platforms);
  return { id: randomUUID(), createdAt: new Date().toISOString(), version: '0.3.0', mode, status: 'queued', brief, platformTargets, sharedRequirements: sharedRequirementsFor(brief), webResearch: { enabled: Boolean(webResearch), status: webResearch ? 'queued' : 'disabled', sources: [], queries: [], errors: [], limitations: [] },
    facts: Object.entries(brief).filter(([,text]) => text).map(([id,text]) => ({ id, text, source: `User brief: ${id}`, verification: 'user_provided_unverified' })),
    outputs: {}, events: [], checks: [], limitations: [webResearch ? 'Optional web research is enabled; retrieved sources remain unverified candidates.' : 'No web research or external verification.', 'AI honesty cannot be guaranteed.', 'No final captions or images are generated.', ...(mode === 'preview' ? ['Template preview: no AI specialists were invoked; review is illustrative only.'] : ['Specialists use separate calls to the same model; this is not independent human review.'])] };
}
export function sharedRequirementsFor(brief) {
  const text = Object.values(brief).join(' ');
  const requirements = [];
  const patterns = [
    ['opening hours', /opening\s+hours?/i],
    ['approved product references', /(approved\s+product\s+references?|approved\s+photographs?|product\s+photographs?)/i],
    ['schedule', /\bschedule\b|event\s+date|confirmed\s+date/i],
    ['pricing', /\bpricing?\b|\bprice(?:s|d)?\b|\bcost\b/i],
    ['tournament rules', /tournament\s+rules?|rules\s+and\s+structure/i],
    ['player demographics', /player\s+demographics?|audience\s+demographics?/i],
    ['availability', /\bavailability\b|\bin\s+stock\b/i]
  ];
  for (const [label, pattern] of patterns) if (pattern.test(text)) requirements.push({ label, token: `[CONFIRM: ${label}]` });
  for (const token of text.matchAll(/\[CONFIRM:\s*([^\]]+)\]/gi)) {
    const label = token[1].trim().toLowerCase();
    if (!requirements.some(item => item.label === label)) requirements.push({ label, token: `[CONFIRM: ${label}]` });
  }
  return requirements;
}
export function validateOutput(out, role, facts) {
  if (!out || typeof out.summary !== 'string' || !out.summary.trim()) throw new Error('Missing specialist summary.');
  for (const key of ['factsUsed','assumptions','uncertainties','disagreements','deliverables']) if (!Array.isArray(out[key])) throw new Error(`Missing ${key}.`);
  const known = new Set(facts.map(f => f.id));
  if (out.factsUsed.some(id => !known.has(id))) throw new Error('Specialist cited an unknown business fact.');
  if (out.assumptions.some(a => !a || typeof a.statement !== 'string' || !a.statement.trim() || typeof a.basis !== 'string' || !a.basis.trim())) throw new Error('Unlabeled assumption.');
  if (out.uncertainties.some(a => typeof a !== 'string') || out.disagreements.some(a => !a || typeof a.withRole !== 'string' || typeof a.reason !== 'string')) throw new Error('Invalid collaboration record.');
  if (DRAFT_ROLES.includes(role) && !out.deliverables.length) throw new Error('Missing prompt deliverables.');
  for (const d of out.deliverables) {
    if (!d || typeof d.title !== 'string' || typeof d.prompt !== 'string' || d.prompt.trim().length < 80 || !Array.isArray(d.acceptanceCriteria) || !d.acceptanceCriteria.length || d.acceptanceCriteria.some(c => typeof c !== 'string' || !c.trim())) throw new Error('Prompt missing usable instructions or acceptance criteria.');
  }
  if (!out.review || !['not_applicable','pass','request_changes','blocked'].includes(out.review.verdict) || !Array.isArray(out.review.findings) || out.review.findings.some(f => typeof f !== 'string')) throw new Error('Invalid review record.');
  if (role === 'review' && out.review.verdict === 'not_applicable') throw new Error('Reviewer did not return a decision.');
  return out;
}

/**
 * @param {any} run
 * @param {{generate?: (input: any) => Promise<any>, save?: (run: any) => Promise<void>, signal?: AbortSignal}} options
 */
export async function executeRun(run, { generate, save = async () => {}, signal } = {}) {
  let stopped = false;
  const assertRunning = () => { if (stopped || signal?.aborted) throw new Error('Run stopped.'); };
  const record = async (role, status, detail) => {
    assertRunning(); run.events.push({ sequence: run.events.length + 1, at: new Date().toISOString(), role, status, detail }); await save(run);
  };
  const stage = async id => {
    assertRunning();
    const role = SPECIALISTS.find(s => s.id === id);
    await record(id, 'running', run.mode === 'preview' ? 'Rendering a template example; no model call.' : 'Calling configured model.');
    // Snapshot dependencies. Copy and visual receive the same analyst/strategy handoff.
    const prior = Object.fromEntries(Object.entries(run.outputs).filter(([key]) => id === 'review' || ['brief','research','strategy'].includes(key)));
      const rawOut = run.mode === 'preview' ? previewOutput(id, run) : await generate({ role, system: RULES, brief: run.brief, facts: run.facts, prior, platformTargets: run.platformTargets, sharedRequirements: run.sharedRequirements, webSources: run.webResearch?.sources || [], signal });
    const out = enforcePromptContract(rawOut, id, run.sharedRequirements, run.platformTargets);
    assertRunning();
    validateOutput(out, id, run.facts);
    if (id === 'research') validateResearchSources(out, run.webResearch?.sources);
    if (id === 'strategy') validateStrategyPlan(out, run.platformTargets);
    run.outputs[id] = out;
    await record(id, 'completed', run.mode === 'preview' ? 'Template example recorded.' : 'Structured output recorded; factual accuracy is not guaranteed.');
  };
  try {
    run.status = 'running'; await save(run);
    await stage('brief');
    if (run.webResearch?.enabled) {
      run.webResearch = run.mode === 'preview' ? previewResearch(run) : await researchBrief({ brief: run.brief, platformTargets: run.platformTargets, signal });
      await save(run);
      await stage('research');
    }
    await stage('strategy');
    const results = await Promise.allSettled(DRAFT_ROLES.map(stage));
    const failed = results.find(r => r.status === 'rejected');
    if (failed) throw failed.reason;
    validatePlatformDeliverables(run);
    validateSharedRequirements(run);
    run.platformEvaluations = evaluatePlatformOutputs(run);
    if (run.platformEvaluations.some(result => !result.passed)) throw new Error('A platform-specific prompt evaluation failed.');
    await stage('review'); assertRunning();
    const verdict = run.outputs.review.review.verdict;
    const dissent = Object.values(run.outputs).some(o => o.disagreements.some(d => !/no prior handoffs?|no shared strategy provided|no conflict was supplied/i.test(d.reason)));
    run.checks = [
      { name: 'Required specialist outputs present', passed: SPECIALISTS.filter(r => r.id !== 'research' || run.webResearch?.enabled).every(r => run.outputs[r.id]) },
      { name: 'Business fact references recognized', passed: true },
      { name: 'Prompt instructions and acceptance criteria present', passed: true },
      { name: 'Platform target coverage', passed: true },
      { name: 'Platform format guidance present', passed: run.platformEvaluations.every(result => result.passed) },
      { name: 'No unresolved specialist disagreements', passed: !dissent },
      { name: 'Reviewer returned pass', passed: verdict === 'pass' }
    ];
    run.status = run.mode === 'preview' ? 'example_only' : verdict === 'blocked' ? 'blocked' : run.checks.every(c => c.passed) ? 'human_review' : 'changes_requested';
    run.compound = buildCompoundPackage(run);
    await record('studio', run.status, 'No automatic approval or publication.');
  } catch (error) {
    stopped = true;
    run.status = signal?.aborted ? 'cancelled' : 'failed';
    // Provider errors can contain sensitive metadata. Keep them out of exports/UI.
    run.error = signal?.aborted ? 'Stopped or timed out. Partial work is retained.' : 'A specialist failed or returned invalid output. Partial work is retained; no approval was granted.';
    run.events.push({ sequence: run.events.length + 1, at: new Date().toISOString(), role: 'studio', status: run.status, detail: run.error });
  }
  if (!run.compound && Object.keys(run.outputs).length) run.compound = buildCompoundPackage(run);
  run.finishedAt = new Date().toISOString(); await save(run); return run;
}

function validateSharedRequirements(run) {
  for (const requirement of run.sharedRequirements || []) {
    for (const role of DRAFT_ROLES) {
      const output = run.outputs[role];
      const text = output.deliverables.map(d => `${d.prompt}\n${d.acceptanceCriteria.join('\n')}`).join('\n');
      if (!text.includes(requirement.token)) throw new Error(`${role} omitted shared confirmation ${requirement.token}.`);
      // Excluding unconfirmed opening-hours text is correct; excluding the
      // approved product reference itself is not. Keep this deterministic
      // check narrow so valid visual safety language is not rejected.
      if (requirement.label === 'approved product references' && /(?:no|without|exclude|excluding)[^\n]{0,80}product\s+(?:photo(?:graph)?s?|references?)/i.test(text)) {
        throw new Error(`${role} contradicted shared confirmation ${requirement.token}.`);
      }
    }
  }
}

function validateResearchSources(out, sources) {
  if (!out?.sourcesUsed) return;
  const known = new Set((sources || []).map(source => source.id));
  if (out.sourcesUsed.some(id => !known.has(id))) throw new Error('Research specialist cited an unknown web source.');
}

function validateStrategyPlan(out, targets) {
  const plan = out?.platformStrategies;
  if (!Array.isArray(plan) || plan.length !== targets.length) throw new Error(`Strategy returned ${plan?.length || 0} platform plans for ${targets.length} targets.`);
  targets.forEach((target, index) => {
    const item = plan[index];
    if (!item || item.targetId !== target.id || !item.targetName || !item.channelRole || !item.audienceAngle || !item.contentPillars?.length || !item.contentNeeds?.length || !item.cadence || !item.callToAction || !item.measurementHypothesis) throw new Error(`Strategy plan is incomplete for ${target.platformName} / ${target.surfaceName}.`);
    if (item.contentNeeds.some(need => !need.id || !need.type || !need.purpose || !['must_have','useful','optional'].includes(need.priority))) throw new Error(`Strategy content need is incomplete for ${target.platformName} / ${target.surfaceName}.`);
  });
}

function enforcePromptContract(out, role, requirements, platformTargets = []) {
  if (!DRAFT_ROLES.includes(role) || !out?.deliverables) return out;
  const tokens = (requirements || []).map(item => item.token);
  const contract = `\n\nSHARED CONFIRMATION CONTRACT: Preserve these exact tokens before production: ${tokens.join(', ')}. Do not replace them with plain text or invented values.`;
  const deliverables = out.deliverables.map((deliverable, index) => {
    const current = `${deliverable.prompt}\n${deliverable.acceptanceCriteria.join('\n')}`;
    const missing = tokens.filter(token => !current.includes(token));
    const target = platformTargets[index];
    const targetContract = target ? `\n\nTARGET CONTRACT: ${target.platformName} / ${target.surfaceName}. Required format: ${target.format}. Asset types: ${target.assetTypes.join(', ')}. Platform guidance: ${target.guidance}.` : '';
    const targetMissing = target && (!current.includes(target.platformName) || !current.includes(target.format) || !current.toLowerCase().includes(target.guidance.toLowerCase().slice(0, 24)) || !target.assetTypes.some(asset => current.toLowerCase().includes(asset.toLowerCase())));
    if (!missing.length && !targetMissing) return deliverable;
    return {
      ...deliverable,
      prompt: `${deliverable.prompt}${missing.length ? contract : ''}${targetMissing ? targetContract : ''}`,
      acceptanceCriteria: [...deliverable.acceptanceCriteria, ...(missing.length ? [`Exact shared confirmation tokens preserved: ${missing.join(', ')}`] : []), ...(targetMissing ? [`Target format preserved: ${target.platformName} / ${target.surfaceName} · ${target.format}`] : []), ...(target?.acceptanceCriteria || [])]
    };
  });
  return { ...out, deliverables, promptContract: { enforcedTokens: tokens, role, platformTargets } };
}

function validatePlatformDeliverables(run) {
  const expected = run.platformTargets?.length || 1;
  for (const role of DRAFT_ROLES) {
    const actual = run.outputs[role]?.deliverables?.length || 0;
    if (actual !== expected) throw new Error(`${role} returned ${actual} deliverables for ${expected} platform targets.`);
    run.outputs[role].deliverables.forEach((deliverable, index) => {
      const target = run.platformTargets?.[index];
      if (!target) return;
      const text = `${deliverable.title}\n${deliverable.prompt}\n${deliverable.acceptanceCriteria.join('\n')}`;
      if (!text.includes(target.platformName) || !text.includes(target.format)) throw new Error(`${role} omitted platform format guidance for ${target.platformName} / ${target.surfaceName}.`);
    });
  }
}

function previewOutput(id, run) {
  const b = run.brief;
  const base = { summary: '', factsUsed: run.facts.map(f => f.id), assumptions: [{ statement: 'A single coordinated campaign is suitable for this request.', basis: 'Preview template default; requires human confirmation.' }], uncertainties: ['Product appearance, offers, and supporting claims have not been independently verified.'], disagreements: [], deliverables: [], review: { verdict: 'not_applicable', findings: [] } };
  if (id === 'brief') base.summary = `Template intake for ${b.business}: reach ${b.audience}. Objective: ${b.objective}.`;
  if (id === 'research') {
    base.summary = run.webResearch?.status === 'example_only' ? 'Preview research plan only. No web search occurred.' : 'No web evidence was collected.';
    base.sourcesUsed = [];
    base.uncertainties = [...base.uncertainties, ...(run.webResearch?.limitations || ['Web evidence requires human verification.'])];
  }
  if (id === 'strategy') {
    base.summary = `Proposed preview direction: one clear message around ${b.objective}, tailored to ${b.audience}, with a ${b.voice || '[CONFIRM: brand voice]'} voice. Human confirmation required.`;
    base.platformStrategies = (run.platformTargets || []).map(target => ({ targetId: target.id, targetName: `${target.platformName} / ${target.surfaceName}`, channelRole: `Use ${target.platformName} ${target.surfaceName} to introduce the objective without unsupported claims.`, audienceAngle: `Speak to ${b.audience} in the supplied voice.`, contentPillars: ['Core objective', 'Useful context', 'Human-reviewed call to action'], contentNeeds: [
      { id: `${target.id}:primary-prompt`, type: 'primary prompt', purpose: 'Create the main platform-specific instruction.', priority: 'must_have' },
      { id: `${target.id}:visual-or-format`, type: 'visual or format support', purpose: 'Specify the supporting production direction for this target.', priority: 'must_have' },
      { id: `${target.id}:review-checklist`, type: 'review checklist', purpose: 'Check claims, accessibility, format, and confirmation tokens.', priority: 'useful' }
    ], cadence: 'Confirm cadence with the human owner before production.', callToAction: 'Ask for the smallest truthful next step supported by the brief.', measurementHypothesis: 'Human owner defines a measurable signal tied to the objective; no performance is guaranteed.' }));
  }
  if (DRAFT_ROLES.includes(id)) {
    base.summary = `${id === 'copy' ? 'Writing' : id === 'visual' ? 'Visual' : 'Format and channel'} prompt template adapted to the supplied brief. No AI work performed.`;
    const targets = run.platformTargets?.length ? run.platformTargets : [{ platformName: b.platforms, surfaceName: 'Requested format', format: 'Confirm format', guidance: 'Confirm the requested platform format.' }];
    const confirmationText = run.sharedRequirements?.length ? run.sharedRequirements.map(item => item.token).join(', ') : '[CONFIRM: detail]';
    base.deliverables = targets.map(target => ({ title: `${target.platformName} / ${target.surfaceName} · ${id === 'copy' ? 'writing' : id === 'visual' ? 'visual' : 'format'} prompt`, prompt: id === 'copy' ?
      `Act as a professional social copywriter for ${b.business}. Target: ${target.platformName} / ${target.surfaceName}. Format: ${target.format}. Guidance: ${target.guidance}. Business niche: ${b.niche || '[CONFIRM: niche]'}. Audience: ${b.audience}. Objective: ${b.objective}. Brand voice: ${b.voice || '[CONFIRM: voice]'}. User-provided product details: ${b.products || '[CONFIRM: product details]'}. Constraints: ${b.constraints || 'No additional constraints supplied; ask before making material claims.'}. Create three platform-appropriate options with a hook, body, CTA, and assumptions. Do not invent discounts, testimonials, certifications, pricing, affiliations, or results. Mark missing details with these exact shared tokens: ${confirmationText}. List questions before producing publishable content.` :
      id === 'visual' ? `Create a campaign visual concept for ${b.business} targeting ${target.platformName} / ${target.surfaceName}. Required format: ${target.format}. Platform guidance: ${target.guidance}. Audience: ${b.audience}. Objective: ${b.objective}. Brand voice: ${b.voice || '[CONFIRM: visual identity]'}. Product details: ${b.products || '[CONFIRM: product and approved reference]'}. Use a clear focal subject, appropriate composition, lighting, and space for optional copy. These aesthetic choices are suggestions, not brand facts. Constraints: ${b.constraints || 'Ask for brand restrictions.'}. Do not invent packaging, labels, awards, affiliations, endorsements, or misleading before/after claims. Preserve these exact confirmation tokens before production: ${confirmationText}. Return assumptions and exclusions.` :
      `Create a format-production prompt for ${b.business} targeting ${target.platformName} / ${target.surfaceName}. Required format: ${target.format}. Platform guidance: ${target.guidance}. Supported output types: ${target.assetTypes.join(', ')}. Audience: ${b.audience}. Objective: ${b.objective}. Voice: ${b.voice || '[CONFIRM: voice]'}. Ask a future creator to produce the appropriate hook, sequence, title/caption, spoken or on-screen direction, accessibility notes, CTA, and handoff checklist for this target. Do not create final content or invent claims. Preserve these exact confirmation tokens before production: ${confirmationText}.`, acceptanceCriteria: [`Matches ${target.platformName} / ${target.surfaceName} and its format guidance.`, `Carries exact shared confirmation tokens: ${confirmationText}.`, 'Contains no unsupported commercial claims.', 'Human reviews platform formatting, accessibility, and brand suitability.'] }));
  }
  if (id === 'review') {
    base.summary = 'Illustrative review checklist only. No independent AI review occurred.';
    base.review = { verdict: 'request_changes', findings: ['Confirm the proposed campaign direction and missing brand details.', 'Review the writing, visual, and format prompts together before use.', 'Run live mode for actual model specialist calls; live outputs still require human review.'] };
  }
  return base;
}
