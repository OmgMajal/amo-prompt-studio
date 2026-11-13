import { PLATFORM_REGISTRY_VERSION } from './platforms.mjs';

/**
 * Build a deterministic, export-friendly package from the role outputs.
 * This is a view of saved evidence, not a new model decision.
 */
export function buildCompoundPackage(run) {
  const targets = run.platformTargets || [];
  const find = (list, target, index) => list?.find(item => item.title?.toLowerCase().includes(target.platformName.toLowerCase()) && item.title?.toLowerCase().includes(target.surfaceName.toLowerCase())) || list?.[index] || null;
  return {
    packageVersion: '0.3.0',
    registryVersion: PLATFORM_REGISTRY_VERSION,
    runId: run.id,
    business: run.brief.business,
    objective: run.brief.objective,
    brief: run.brief,
    governance: {
      approvalOwner: run.brief.approvalOwner || null,
      successCriteria: run.brief.successCriteria || null,
      riskNotes: run.brief.riskNotes || null,
      validationPlan: run.brief.validationPlan || null
    },
    status: run.status,
    sharedRequirements: run.sharedRequirements || [],
    webResearch: run.webResearch || { enabled: false, status: 'disabled', sources: [] },
    researchSummary: run.outputs.research?.summary || null,
    platformEvaluations: run.platformEvaluations || [],
    strategy: run.outputs.strategy?.summary || null,
    strategyPlan: run.outputs.strategy?.platformStrategies || [],
    targets: targets.map((target, index) => ({
      target,
      copy: find(run.outputs.copy?.deliverables, target, index),
      visual: find(run.outputs.visual?.deliverables, target, index),
      format: find(run.outputs.format?.deliverables, target, index)
    })),
    reviewer: run.outputs.review?.review || null,
    humanDecisionRequired: true,
    publication: { attempted: false, status: 'disabled' }
  };
}

export function renderCompoundMarkdown(compound) {
  const lines = [
    `# Prompt Studio compound package`,
    ``,
    `- Business: ${compound.business}`,
    `- Objective: ${compound.objective}`,
    `- Run: ${compound.runId}`,
    `- Registry: ${compound.registryVersion}`,
    `- Status: ${compound.status}`,
    `- Human decision required: yes`,
    `- Publication: disabled`,
    ``,
    `## Shared confirmation requirements`,
    ...(compound.sharedRequirements.length ? compound.sharedRequirements.map(item => `- ${item.token}`) : ['- None detected']),
    ``,
    `## Strategy`,
    compound.strategy || 'No strategy output recorded.',
    ``,
    `### Per-platform strategy and content needs`,
    ...(compound.strategyPlan?.length ? compound.strategyPlan.flatMap(plan => [
      `#### ${plan.targetName}`,
      `- Channel role: ${plan.channelRole}`,
      `- Audience angle: ${plan.audienceAngle}`,
      `- Content pillars: ${plan.contentPillars.join('; ')}`,
      `- Cadence: ${plan.cadence}`,
      `- CTA: ${plan.callToAction}`,
      `- Measurement hypothesis: ${plan.measurementHypothesis}`,
      `- Content needs: ${plan.contentNeeds.map(need => `${need.type} (${need.priority}) — ${need.purpose}`).join('; ')}`,
      ``
    ]) : ['No structured platform strategy recorded.']),
    ``,
    `## Optional web research`,
    `- Status: ${compound.webResearch?.status || 'disabled'}`,
    `- Sources are unverified candidates, not business facts.`,
    compound.researchSummary || 'No research synthesis recorded.',
    ...(compound.webResearch?.sources || []).map(source => `- ${source.id}: ${source.title || 'Untitled'} — ${source.url}`),
    ``,
    `## Governance and validation`,
    `- Approval owner: ${compound.governance?.approvalOwner || 'Not supplied'}`,
    `- Success check: ${compound.governance?.successCriteria || 'Not supplied'}`,
    `- Risk notes: ${compound.governance?.riskNotes || 'Not supplied'}`,
    `- Validation plan: ${compound.governance?.validationPlan || 'Human review required; no validation plan supplied.'}`,
    ``
  ];
  for (const item of compound.targets) {
    lines.push(`## ${item.target.platformName} / ${item.target.surfaceName}`, ``, `Format: ${item.target.format}`, ``);
    lines.push(`### Writing prompt`, item.copy?.prompt || 'No writing prompt recorded.', ``, `Acceptance criteria:`, ...(item.copy?.acceptanceCriteria || ['Not recorded.']).map(value => `- ${value}`), ``);
    lines.push(`### Visual prompt`, item.visual?.prompt || 'No visual prompt recorded.', ``, `Acceptance criteria:`, ...(item.visual?.acceptanceCriteria || ['Not recorded.']).map(value => `- ${value}`), ``);
    lines.push(`### Format / channel prompt`, item.format?.prompt || 'No format prompt recorded.', ``, `Acceptance criteria:`, ...(item.format?.acceptanceCriteria || ['Not recorded.']).map(value => `- ${value}`), ``);
  }
  lines.push(`## Reviewer`, compound.reviewer ? `Decision: ${compound.reviewer.verdict}` : 'No reviewer decision recorded.', ...(compound.reviewer?.findings || []).map(value => `- ${value}`));
  return `${lines.join('\n')}\n`;
}
