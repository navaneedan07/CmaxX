import { describe, expect, it } from 'vitest';
import { buildStructuredMemory } from '../services/memoryTransform.js';
import { askGroq } from '../services/groq.js';

describe('memory transform quality gates', () => {
  it('prevents low-confidence stage jump from onboarding to expansion', () => {
    const memory = buildStructuredMemory([], {
      summary: 'quick ping',
      stage: 'expansion',
      health: 'engaged',
      newBlocker: null,
      blockerResolved: null,
      goalMentioned: null,
      goalAchieved: false,
    });

    expect(memory.current_stage).toBe('onboarding');
  });

  it('allows stage jump when goal is achieved', () => {
    const memory = buildStructuredMemory([], {
      summary: 'goal reached and expansion requested',
      stage: 'expansion',
      health: 'engaged',
      newBlocker: null,
      blockerResolved: null,
      goalMentioned: 'Scale usage',
      goalAchieved: true,
    });

    expect(memory.current_stage).toBe('expansion');
  });
});

describe('groq fallback behavior', () => {
  it('returns a visible non-empty fallback reply when Groq key is not configured', async () => {
    const originalKey = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;

    try {
      const result = await askGroq([], [], 'hello', 'priya', true);
      expect(result.reply).toBeTruthy();
      expect(result.reply.length).toBeGreaterThan(10);
    } finally {
      if (originalKey) process.env.GROQ_API_KEY = originalKey;
    }
  });
});
