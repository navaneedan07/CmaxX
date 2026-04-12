/**
 * routes/customer.js
 * GET /customer/:id
 *
 * Returns the full memory panel data for a given customer.
 * Used by the frontend to populate the "What I Remember" side panel.
 */

import { Router } from 'express';
import { listCustomerMemories, recallCustomer } from '../services/hindsight.js';
import { buildStructuredMemory } from '../services/memoryTransform.js';

export const customerRouter = Router();

customerRouter.get('/:id', async (req, res) => {
  const { id: customerId } = req.params;

  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required' });
  }

  try {
    const memories = await listCustomerMemories(customerId);
    const structured = buildStructuredMemory(memories);
    return res.json(structured);
  } catch (err) {
    console.error(`[Customer] Error fetching memory for ${customerId}:`, err.message);
    return res.status(500).json({
      error: 'Failed to retrieve customer memory.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});
