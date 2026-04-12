/**
 * routes/customer.js
 * GET /customer/:id
 *
 * Returns the full memory panel data for a given customer.
 * Used by the frontend to populate the "What I Remember" side panel.
 */

import { Router } from 'express';
import { listCustomerMemories, recallCustomer } from '../services/hindsight.js';

export const customerRouter = Router();

customerRouter.get('/:id', async (req, res) => {
  const { id: customerId } = req.params;

  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required' });
  }

  try {
    // Get both raw stored memories AND a recall query for "overall summary"
    const [memories, recalledSummary] = await Promise.all([
      listCustomerMemories(customerId),
      recallCustomer(customerId, 'customer goal stage health blockers progress'),
    ]);

    return res.json({
      customerId,
      memories,        // Raw fact list for the memory panel
      summary: recalledSummary, // Recalled/synthesised view for the agent
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[Customer] Error fetching memory for ${customerId}:`, err.message);
    return res.status(500).json({
      error: 'Failed to retrieve customer memory.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});
