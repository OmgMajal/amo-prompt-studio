/**
 * Deterministic platform checks. These checks validate prompt instructions,
 * not the final media or the platform's current policy enforcement.
 */
export function evaluatePlatformTarget(target, role, deliverable) {
  const text = `${deliverable?.title || ''}\n${deliverable?.prompt || ''}\n${deliverable?.acceptanceCriteria?.join('\n') || ''}`;
  const checks = [
    { name: 'target named', passed: text.toLowerCase().includes(target.platformName.toLowerCase()) && text.toLowerCase().includes(target.surfaceName.toLowerCase()) },
    { name: 'format guidance present', passed: text.includes(target.format) },
    { name: 'asset guidance present', passed: target.assetTypes.some(asset => text.toLowerCase().includes(asset.toLowerCase())) },
    { name: 'platform guidance present', passed: text.toLowerCase().includes(target.guidance.toLowerCase().slice(0, 24)) }
  ];
  if (target.platform === 'tiktok' || target.platform === 'instagram' || target.platform === 'youtube') {
    checks.push({ name: 'vertical format stated', passed: target.format.includes('9:16') ? text.includes('9:16') : true });
  }
  if (target.platform === 'twitch') checks.push({ name: 'live interaction guidance stated', passed: /chat|moderation|segment|stream/i.test(text) });
  if (target.platform === 'discord') checks.push({ name: 'community action guidance stated', passed: /announcement|channel|moderation|community/i.test(text) });
  return { role, targetId: target.id, checks, passed: checks.every(check => check.passed) };
}

export function evaluatePlatformOutputs(run) {
  return (run.platformTargets || []).flatMap((target, index) => ['copy', 'visual', 'format'].map(role => evaluatePlatformTarget(target, role, run.outputs[role]?.deliverables?.[index])));
}
