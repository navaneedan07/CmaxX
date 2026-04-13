const ALLOWED_STAGES = new Set(['onboarding', 'adoption', 'value_achieved', 'expansion']);
const ALLOWED_HEALTH = new Set(['engaged', 'going_quiet', 'at_risk']);

function asNullableString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStage(value) {
  const normalized = asNullableString(value)?.toLowerCase().replace(/-/g, '_');
  return normalized && ALLOWED_STAGES.has(normalized) ? normalized : null;
}

function normalizeHealth(value) {
  const normalized = asNullableString(value)?.toLowerCase().replace(/-/g, '_');
  return normalized && ALLOWED_HEALTH.has(normalized) ? normalized : null;
}

export function normalizeRetainData(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, data: null, reason: 'not_object' };
  }

  const summary = asNullableString(input.summary);
  if (!summary) {
    return { valid: false, data: null, reason: 'missing_summary' };
  }

  const stage = normalizeStage(input.stage);
  const health = normalizeHealth(input.health);

  const normalized = {
    summary,
    stage: stage ?? 'adoption',
    health: health ?? 'engaged',
    newBlocker: asNullableString(input.newBlocker),
    blockerResolved: asNullableString(input.blockerResolved),
    goalMentioned: asNullableString(input.goalMentioned),
    goalAchieved: Boolean(input.goalAchieved),
  };

  return { valid: true, data: normalized, reason: null };
}
