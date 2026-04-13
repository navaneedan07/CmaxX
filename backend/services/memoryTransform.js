/**
 * memoryTransform.js
 * Converts raw Hindsight memory items → the structured object
 * that the React MemoryPanel component expects.
 *
 * Schema:
 * {
 *   stated_goal, current_stage, completed_steps, blockers,
 *   last_contact, health_signal, goal_achieved, notes
 * }
 */

export function buildStructuredMemory(rawMemories = [], retainData = null) {
  const mem = {
    stated_goal:     '',
    current_stage:   'onboarding',
    completed_steps: [],
    blockers:        [],
    last_contact:    '',
    health_signal:   'engaged',
    goal_achieved:   false,
    notes:           '',
  };

  const stageSignals = new Set(['onboarding']);
  const healthSignals = [];

  // Track seen text to avoid duplicates from Hindsight's observation+world pairs
  const seenSteps    = new Set();
  const seenBlockers = new Set();

  for (const m of rawMemories) {
    const text = typeof m === 'string' ? m : (m.text ?? m.content ?? '');
    const ctx  = m.context ?? '';
    if (!text) continue;

    // ── Goal ──────────────────────────────────────────────────────────────────
    if (!mem.stated_goal) {
      const g = text.match(/(?:30-day goal|stated goal|goal is)[:\s]+(.+?)(?:\.|$)/i);
      if (g) mem.stated_goal = g[1].trim();
    }

    // ── Health signal ─────────────────────────────────────────────────────────
    if (/health signal[:\s]+engaged/i.test(text)) healthSignals.push('engaged');
    else if (/health signal[:\s]+going.?quiet/i.test(text)) healthSignals.push('going_quiet');
    else if (/(?:health signal[:\s]+at.?risk|churn risk)/i.test(text)) healthSignals.push('at_risk');
    else if (/going quiet|hasn't replied|no login/i.test(text)) healthSignals.push('going_quiet');
    else if (/at.?risk|thinking about switching/i.test(text)) healthSignals.push('at_risk');

    // ── Stage (use context tag first, then keyword fallback) ──────────────────
    if (ctx.includes('expansion')) stageSignals.add('expansion');
    else if (ctx.includes('value')) stageSignals.add('value_achieved');
    else if (ctx.includes('adoption')) stageSignals.add('adoption');

    if (/expansion|upsell|seat increase|additional team/i.test(text)) stageSignals.add('expansion');
    else if (/value achieved|milestone reached|goal achieved/i.test(text)) stageSignals.add('value_achieved');
    else if (/adoption|onboarded|active usage/i.test(text)) stageSignals.add('adoption');

    // ── Completed steps ───────────────────────────────────────────────────────
    if (/completed|set up|created.*account|connected|imported|integrated|onboarded|processed/i.test(text)
        && !/failed|error|blocker/i.test(text)) {
      const clean = text.split('|')[0].split('.')[0].trim();
      const key = normalizeText(clean);
      if (clean.length > 15 && clean.length < 130 && !seenSteps.has(key)) {
        seenSteps.add(key);
        mem.completed_steps.push(clean);
      }
    }

    // ── Blockers ──────────────────────────────────────────────────────────────
    const isBlocker  = /failed|error|stuck|not.*work|didn't work|blocker|unresolved/i.test(text);
    const isResolved = /resolved|fixed|worked|success/i.test(text);

    if (isBlocker && !isResolved) {
      const clean = text.split('|')[0].split('.')[0].trim();
      const key = normalizeText(clean);
      if (clean.length > 15 && clean.length < 150 && !seenBlockers.has(key)) {
        seenBlockers.add(key);
        mem.blockers.push({ issue: clean, resolution: 'Not yet resolved', date: extractDate(m) });
      }
    }

    // Mark resolved blockers
    if (isResolved && mem.blockers.length > 0) {
      const resolved = text.split('|')[0].split('.')[0].trim();
      const open = mem.blockers.find(b => b.resolution === 'Not yet resolved');
      if (open) open.resolution = resolved;
    }

    // ── Goal achieved ─────────────────────────────────────────────────────────
    if (/goal achieved|achieved.*goal/i.test(text)) mem.goal_achieved = true;
  }

  mem.health_signal = resolveHealth(healthSignals);
  mem.current_stage = resolveStage(stageSignals);

  // Cap completed_steps to avoid noise from Hindsight's duplicate facts
  mem.completed_steps = mem.completed_steps.slice(0, 6);

  // ── Apply fresh retainData from this chat turn ────────────────────────────
  if (retainData) {
    const confidence = estimateRetainConfidence(retainData);

    if (retainData.stage) {
      mem.current_stage = applyStageTransition(mem.current_stage, retainData.stage, confidence, retainData.goalAchieved);
    }

    if (retainData.health && confidence >= 0.5) {
      mem.health_signal = retainData.health.replace(/-/g, '_');
    }

    if (retainData.goalMentioned) mem.stated_goal    = retainData.goalMentioned;
    if (retainData.goalAchieved)  mem.goal_achieved  = true;
    if (retainData.summary)       mem.notes          = retainData.summary;

    if (retainData.newBlocker && confidence >= 0.45) {
      const key = normalizeText(retainData.newBlocker);
      const exists = mem.blockers.some((b) => normalizeText(b.issue).includes(key) || key.includes(normalizeText(b.issue)));
      if (!exists) {
        mem.blockers.push({
          issue:      retainData.newBlocker,
          resolution: 'Not yet resolved',
          date:       today(),
        });
      }
    }

    if (retainData.blockerResolved) {
      const open = mem.blockers.find(b => b.resolution === 'Not yet resolved');
      if (open) open.resolution = retainData.blockerResolved;
    }
  }

  mem.last_contact = today();
  return mem;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDate(memoryItem) {
  const candidate = memoryItem?.createdAt || memoryItem?.timestamp || memoryItem?.date || null;
  if (!candidate) return '';
  const d = new Date(candidate);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}

function resolveHealth(signals) {
  if (!signals.length) return 'engaged';
  if (signals.includes('at_risk')) return 'at_risk';
  if (signals.includes('going_quiet')) return 'going_quiet';
  return 'engaged';
}

function resolveStage(stageSignals) {
  const ranked = ['onboarding', 'adoption', 'value_achieved', 'expansion'];
  for (let i = ranked.length - 1; i >= 0; i--) {
    if (stageSignals.has(ranked[i])) return ranked[i];
  }
  return 'onboarding';
}

function estimateRetainConfidence(retainData) {
  let score = 0;
  if (retainData.summary) score += 0.3;
  if (retainData.goalMentioned) score += 0.25;
  if (retainData.newBlocker || retainData.blockerResolved) score += 0.2;
  if (retainData.stage) score += 0.15;
  if (retainData.health) score += 0.1;
  return Math.min(score, 1);
}

function applyStageTransition(currentStage, proposedStage, confidence, goalAchieved) {
  const order = ['onboarding', 'adoption', 'value_achieved', 'expansion'];
  const currentIndex = order.indexOf(currentStage);
  const proposedIndex = order.indexOf(proposedStage);

  if (proposedIndex < 0 || currentIndex < 0) return currentStage;
  if (proposedIndex <= currentIndex) return proposedStage;

  const jump = proposedIndex - currentIndex;
  if (goalAchieved) {
    return proposedStage;
  }

  if (jump === 1 && confidence >= 0.45) {
    return proposedStage;
  }

  if (jump > 1 && confidence >= 0.8) {
    return proposedStage;
  }

  return currentStage;
}
