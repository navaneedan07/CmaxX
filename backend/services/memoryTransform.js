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
    if (/health signal[:\s]+engaged/i.test(text))        mem.health_signal = 'engaged';
    else if (/health signal[:\s]+going.?quiet/i.test(text)) mem.health_signal = 'going_quiet';
    else if (/(?:health signal[:\s]+at.?risk|churn risk)/i.test(text)) mem.health_signal = 'at_risk';
    else if (/going quiet|hasn't replied|no login/i.test(text)) mem.health_signal = 'going_quiet';
    else if (/at.?risk|thinking about switching/i.test(text)) mem.health_signal = 'at_risk';

    // ── Stage (use context tag first, then keyword fallback) ──────────────────
    if      (ctx.includes('expansion'))    mem.current_stage = 'expansion';
    else if (ctx.includes('value'))        mem.current_stage = 'value_achieved';
    else if (ctx.includes('adoption'))     mem.current_stage = 'adoption';

    // ── Completed steps ───────────────────────────────────────────────────────
    if (/completed|set up|created.*account|connected|imported|integrated|onboarded|processed/i.test(text)
        && !/failed|error|blocker/i.test(text)) {
      const clean = text.split('|')[0].split('.')[0].trim();
      const key   = clean.slice(0, 60).toLowerCase();
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
      const key   = clean.slice(0, 50).toLowerCase();
      if (clean.length > 15 && clean.length < 150 && !seenBlockers.has(key)) {
        seenBlockers.add(key);
        mem.blockers.push({ issue: clean, resolution: 'Not yet resolved', date: '' });
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

  // Cap completed_steps to avoid noise from Hindsight's duplicate facts
  mem.completed_steps = mem.completed_steps.slice(0, 6);

  // ── Apply fresh retainData from this chat turn ────────────────────────────
  if (retainData) {
    if (retainData.stage)         mem.current_stage  = retainData.stage;
    if (retainData.health)        mem.health_signal  = retainData.health.replace(/-/g, '_');
    if (retainData.goalMentioned) mem.stated_goal    = retainData.goalMentioned;
    if (retainData.goalAchieved)  mem.goal_achieved  = true;
    if (retainData.summary)       mem.notes          = retainData.summary;

    if (retainData.newBlocker) {
      const key = retainData.newBlocker.slice(0, 40).toLowerCase();
      const exists = mem.blockers.some(b => b.issue.toLowerCase().includes(key));
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
