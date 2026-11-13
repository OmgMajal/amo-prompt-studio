import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, executeRun, normalizeBrief, sharedRequirementsFor } from '../studio/engine.mjs';
import { normalizePlatformTargets } from '../studio/platforms.mjs';

const brief = { business: 'Fictional Bakery', audience: 'Neighbors', objective: 'Weekend visits', platforms: 'Instagram', products: 'Bread', voice: 'Warm' };
const output = (role, verdict='pass') => ({ summary: `${role} handoff`, factsUsed: ['business'], assumptions: [], uncertainties: [], disagreements: [], sourcesUsed: [], platformStrategies: role === 'strategy' ? [{ targetId: 'instagram:feed', targetName: 'Instagram / Feed post', channelRole: 'Introduce the objective.', audienceAngle: 'Speak clearly to the supplied audience.', contentPillars: ['Objective'], contentNeeds: [{ id: 'primary', type: 'prompt', purpose: 'Main instruction', priority: 'must_have' }], cadence: 'Confirm with owner.', callToAction: 'Use a truthful next step.', measurementHypothesis: 'Owner defines a signal.' }] : [], deliverables: ['copy','visual','format'].includes(role) ? [{ title: role, prompt: 'Write a reusable prompt for the supplied business and audience, with constraints, a clear task, and an explicit output format.', acceptanceCriteria: ['Use only supplied facts.'] }] : [], review: {verdict: role === 'review' ? verdict : 'not_applicable', findings: []} });

test('missing critical brief information and invalid types are rejected', () => {
  assert.throws(()=>normalizeBrief({...brief, audience:' '}), /audience/);
  assert.throws(()=>normalizeBrief({...brief, objective:42}), /objective/);
  assert.throws(()=>newRun(brief,'silent-live'), /mode/);
});
test('shared confirmation requirements are extracted for dependent modalities', () => {
  const requirements = sharedRequirementsFor({...brief, products:'Bread. No opening hours or approved product photographs supplied.'});
  assert.deepEqual(requirements.map(r=>r.token), ['[CONFIRM: opening hours]','[CONFIRM: approved product references]']);
});
test('platform targets expand into registry-backed surfaces', () => {
  const targets = normalizePlatformTargets('Instagram Reels, TikTok, YouTube Shorts');
  assert.deepEqual(targets.map(t=>t.id), ['instagram:reel','tiktok:video','youtube:short']);
  assert.equal(targets[0].format, '9:16 vertical video');
});
test('one platform can expand into multiple selected surfaces', () => {
  const targets = normalizePlatformTargets('Instagram Feed and Stories');
  assert.deepEqual(targets.map(t=>t.id), ['instagram:feed','instagram:story']);
  assert.ok(targets.every(t=>t.acceptanceCriteria.length >= 3));
});
test('web research is explicit and preview records a plan without contacting the web', async () => {
  const run = await executeRun(newRun({...brief, platforms:'YouTube Shorts'}, 'preview', {webResearch:true}), {generate:()=>{throw Error('Preview must not call a model');}});
  assert.equal(run.webResearch.status, 'example_only');
  assert.equal(run.outputs.research.sourcesUsed.length, 0);
  assert.ok(run.outputs.strategy);
  assert.equal(run.status, 'example_only');
});
test('generalized missing details become shared confirmation tokens', () => {
  const requirements = sharedRequirementsFor({...brief, products:'Clinic. No pricing, schedule, tournament rules, or player demographics supplied.'});
  assert.deepEqual(requirements.map(r=>r.token), ['[CONFIRM: schedule]','[CONFIRM: pricing]','[CONFIRM: tournament rules]','[CONFIRM: player demographics]']);
});
test('offline preview never calls a model or receives an approval status', async () => {
  const run=await executeRun(newRun(brief), {generate:()=>{throw Error('Must not call');}});
  assert.equal(run.status,'example_only');
  assert.equal(Object.keys(run.outputs).length,6);
  assert.equal(run.outputs.review.review.verdict,'request_changes');
  assert.match(run.limitations.join(' '),/no AI specialists/);
});
test('dependent handoffs are sequential; copy and visual genuinely overlap', async () => {
  const seen = new Set(); let parallel=0, maxParallel=0;
  const run=await executeRun(newRun(brief,'live'),{generate:async ({role,prior})=>{
    if(role.id==='strategy') assert.ok(seen.has('brief'));
    if(['copy','visual','format'].includes(role.id)) {
      assert.deepEqual(Object.keys(prior),['brief','strategy']);
      parallel++; maxParallel=Math.max(maxParallel,parallel);
      await new Promise(r=>setTimeout(r,20)); parallel--;
    }
    if(role.id==='review') {assert.ok(seen.has('copy'));assert.ok(seen.has('visual'));assert.ok(seen.has('format'));assert.ok(prior.copy);assert.ok(prior.visual);assert.ok(prior.format);}
    seen.add(role.id); return output(role.id);
  }});
  assert.equal(maxParallel,3); assert.equal(run.status,'human_review');
  assert.deepEqual(run.events.map(e=>e.sequence),run.events.map((_,i)=>i+1));
});
test('invented fact references stop a run without advancing to review',async()=>{
  const run=await executeRun(newRun(brief,'live'),{generate:async({role})=>({...output(role.id),factsUsed:['invented_certificate']})});
  assert.equal(run.status,'failed'); assert.equal(run.outputs.review,undefined);
});
test('dissent cannot be overridden by a passing reviewer',async()=>{
  const run=await executeRun(newRun(brief,'live'),{generate:async({role})=>({...output(role.id),disagreements:role.id==='visual' ? [{withRole:'strategy',reason:'The requested angle needs an unprovided product reference.'}] : []})});
  assert.equal(run.status,'changes_requested'); assert.equal(run.outputs.visual.disagreements.length,1);
});
test('procedural empty-handoff notes do not count as substantive dissent',async()=>{
  const run=await executeRun(newRun(brief,'live'),{generate:async({role})=>({...output(role.id),disagreements:role.id==='visual' ? [{withRole:'Amo Prompt Studio',reason:'No prior handoffs to analyze; no conflict was supplied.'}] : []})});
  assert.equal(run.status,'human_review');
});
test('shared confirmation contract is enforced when a specialist omits tokens',async()=>{
  const contractBrief = {...brief, products:'Clinic. No schedule or pricing supplied.'};
  const run=await executeRun(newRun(contractBrief,'live'),{generate:async({role})=>output(role.id)});
  assert.equal(run.status,'human_review');
  assert.match(run.outputs.visual.deliverables[0].prompt,/\[CONFIRM: schedule\]/);
  assert.match(run.outputs.copy.deliverables[0].prompt,/\[CONFIRM: pricing\]/);
});
test('reviewer can block a package or request changes',async()=>{
  for(const verdict of ['blocked','request_changes']) {
    const run=await executeRun(newRun(brief,'live'),{generate:async({role})=>output(role.id,verdict)});
    assert.equal(run.status,verdict==='blocked'?'blocked':'changes_requested');
  }
});
test('partial work survives failure and provider secrets never appear in error evidence',async()=>{
  const run=await executeRun(newRun(brief,'live'),{generate:async({role})=>{if(role.id==='visual') throw Error('SECRET_EXAMPLE_TOKEN');return output(role.id);}});
  assert.equal(run.status,'failed'); assert.ok(run.outputs.copy); assert.equal(run.outputs.review,undefined);
  assert.ok(!JSON.stringify(run).includes('SECRET_EXAMPLE_TOKEN'));
});
test('cancelled work cannot become completed or approved',async()=>{
  const controller=new AbortController();
  const run=await executeRun(newRun(brief,'live'),{signal:controller.signal,generate:async({role})=>{controller.abort();return output(role.id);}});
  assert.equal(run.status,'cancelled');assert.equal(run.outputs.brief,undefined);assert.ok(run.finishedAt);
});
test('missing actual prompt deliverables fail the run',async()=>{
  const run=await executeRun(newRun(brief,'live'),{generate:async({role})=>({...output(role.id),deliverables:[]})});
  assert.equal(run.status,'failed');assert.equal(run.outputs.review,undefined);
});
