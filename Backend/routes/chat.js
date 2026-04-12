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

    // ── Step 4: Retain (skipped when memory toggle is OFF) ─────────────────────
    if (useMemory && retainData) {
      const retainContent = [
        retainData.summary,
        retainData.goalMentioned ? `Customer's goal: ${retainData.goalMentioned}` : null,
        retainData.newBlocker ? `New blocker: ${retainData.newBlocker}` : null,
        retainData.blockerResolved ? `Resolved blocker: ${retainData.blockerResolved}` : null,
        retainData.goalAchieved ? `Customer achieved their goal!` : null,
      ]
        .filter(Boolean)
        .join('. ');

      console.log(`[Chat] Retaining for ${customerId}: ${retainContent}`);
      await retainForCustomer(customerId, retainContent, {
        stage:        String(retainData.stage       ?? ''),
        health:       String(retainData.health      ?? ''),
        goalAchieved: String(retainData.goalAchieved ?? 'false'),
      });
    }

    // ── Step 5: Fetch updated memory for the UI panel ─────────────────────────
    const updatedMemory = useMemory ? await listCustomerMemories(customerId) : [];

    return res.json({
      reply,
      memory: updatedMemory,
      retainData: retainData ?? null,
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
