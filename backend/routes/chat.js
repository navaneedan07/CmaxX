/**
 * routes/chat.js
 * POST /chat
 *
 * Body:  { customerId: string, message: string, history?: [{role, content}] }
 * Reply: { reply: string, memory: object[], retainData: object }
 *
 * Flow:
 *   1. recall(customerId)          → pull everything Hindsight knows
 *   2. buildSystemPrompt(memories) → inject history into context
 *   3. callGroq(...)               → get agent reply + structured retain block
 *   4. retain(customerId, summary) → save what happened
 *   5. return reply + memory
 */

import { Router } from 'express';
import { recallCustomer, retainForCustomer, listCustomerMemories } from '../services/hindsight.js';
import { askGroq } from '../services/groq.js';
import { buildStructuredMemory } from '../services/memoryTransform.js';
import { normalizeRetainData } from '../services/retainSchema.js';
import { touchCustomer } from '../services/customerRegistry.js';

export const chatRouter = Router();

chatRouter.post('/', async (req, res) => {
  // useMemory defaults to true — set false to run stateless (demo toggle)
  const { customerId, message, history = [], useMemory = true } = req.body;

  // ── Validate ────────────────────────────────────────────────────────────────
  if (!customerId || typeof customerId !== 'string') {
    return res.status(400).json({ error: 'customerId is required (string)' });
  }
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required (string)' });
  }

  try {
    await touchCustomer(customerId);

    // ── Step 1: Recall (skipped when memory toggle is OFF) ─────────────────────
    let memories = [];
    if (useMemory) {
      console.log(`[Chat] Recalling memory for customer: ${customerId}`);
      memories = await recallCustomer(customerId, message);
      console.log(`[Chat] Recalled ${memories.length} memory items`);
    } else {
      console.log(`[Chat] Memory OFF — skipping recall for ${customerId}`);
    }

    // ── Step 2 + 3: Build prompt → call Groq ──────────────────────────────────
    const { reply, retainData } = await askGroq(memories, history, message, customerId, useMemory);
    const normalizedRetain = retainData ? normalizeRetainData(retainData) : { valid: false, data: null };
    const safeRetainData = normalizedRetain.valid ? normalizedRetain.data : null;

    // ── Step 4: Retain (skipped when memory toggle is OFF) ─────────────────────
    if (useMemory && safeRetainData) {
      const retainContent = [
        safeRetainData.summary,
        safeRetainData.goalMentioned ? `Customer's goal: ${safeRetainData.goalMentioned}` : null,
        safeRetainData.newBlocker ? `New blocker: ${safeRetainData.newBlocker}` : null,
        safeRetainData.blockerResolved ? `Resolved blocker: ${safeRetainData.blockerResolved}` : null,
        safeRetainData.goalAchieved ? `Customer achieved their goal!` : null,
      ]
        .filter(Boolean)
        .join('. ');

      console.log(`[Chat] Retaining for ${customerId}: ${retainContent}`);
      await retainForCustomer(customerId, retainContent, {
        stage:        String(safeRetainData.stage       ?? ''),
        health:       String(safeRetainData.health      ?? ''),
        goalAchieved: String(safeRetainData.goalAchieved ?? 'false'),
      });
    }

    // ── Step 5: Build structured memory for the UI panel ─────────────────────
    const rawMemories = useMemory ? await listCustomerMemories(customerId) : [];
    const memory = buildStructuredMemory(rawMemories, useMemory ? safeRetainData : null);

    return res.json({
      reply,
      memory,
      retainData: safeRetainData ?? null,
      customerId,
      memoryEnabled: useMemory,
    });
  } catch (err) {
    console.error('[Chat] Error:', err.message);
    return res.status(500).json({
      error: 'Something went wrong processing your message.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});
