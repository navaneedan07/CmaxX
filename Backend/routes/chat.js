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
  const { customerId, message, history = [] } = req.body;

  // ── Validate ────────────────────────────────────────────────────────────────
  if (!customerId || typeof customerId !== 'string') {
    return res.status(400).json({ error: 'customerId is required (string)' });
  }
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required (string)' });
  }

  try {
    // ── Step 1: Recall ─────────────────────────────────────────────────────────
    console.log(`[Chat] Recalling memory for customer: ${customerId}`);
    const memories = await recallCustomer(customerId, message);
    console.log(`[Chat] Recalled ${memories.length} memory items`);

    // ── Step 2 + 3: Build prompt → call Groq ──────────────────────────────────
    const { reply, retainData } = await askGroq(memories, history, message, customerId);

    // ── Step 4: Retain ─────────────────────────────────────────────────────────
    if (retainData) {
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
        stage: retainData.stage,
        health: retainData.health,
        goalAchieved: retainData.goalAchieved,
      });
    }

    // ── Step 5: Fetch updated memory for the UI panel ─────────────────────────
    const updatedMemory = await listCustomerMemories(customerId);

    return res.json({
      reply,
      memory: updatedMemory,
      retainData: retainData ?? null,
      customerId,
    });
  } catch (err) {
    console.error('[Chat] Error:', err.message);
    return res.status(500).json({
      error: 'Something went wrong processing your message.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});
