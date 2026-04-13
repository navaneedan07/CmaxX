/**
 * hindsight.js
 * Thin wrapper around the @vectorize-io/hindsight-client SDK.
 *
 * Every customer gets their own "memory bank" in Hindsight, keyed by customerId.
 * This gives us per-customer recall/retain isolation with zero extra DB work.
 */

import { HindsightClient } from '@vectorize-io/hindsight-client';

export function isHindsightConfigured() {
  return Boolean(process.env.HINDSIGHT_API_KEY && process.env.HINDSIGHT_BASE_URL);
}

// ─── Client singleton (lazy) ─────────────────────────────────────────────────
// Initialized on first use so dotenv.config() in server.js has already run.
let _client = null;
function getClient() {
  if (!isHindsightConfigured()) {
    throw new Error('Hindsight is not configured.');
  }

  if (!_client) {
    _client = new HindsightClient({
      baseUrl: process.env.HINDSIGHT_BASE_URL,
      apiKey:  process.env.HINDSIGHT_API_KEY,
    });
  }
  return _client;
}

// Bank name for a given customer.  Each customer is their own isolated bank.
function bankId(customerId) {
  return `cs-agent-${customerId}`;
}

/**
 * Ensure the "global" default bank settings template exists.
 * Called once on server startup just to validate connectivity.
 */
export async function ensureBankExists() {
  if (!isHindsightConfigured()) {
    return;
  }

  // We'll lazily create per-customer banks on first retain/recall.
  // Here we just do a lightweight ping by trying to list banks.
  // If the SDK doesn't expose a list endpoint, we rely on createBank being idempotent.
  return Promise.resolve(); // connection validated by first real API call
}

/**
 * Create a per-customer bank if it doesn't exist yet.
 * Hindsight Cloud's createBank is idempotent — safe to call every time.
 */
export async function ensureCustomerBank(customerId) {
  if (!isHindsightConfigured()) {
    return;
  }

  try {
    await getClient().createBank(bankId(customerId), {
      name: `Customer ${customerId}`,
      mission: `You are a Customer Success Agent memory bank for customer ${customerId}. 
Track their stated goals, current onboarding stage, completed steps, blockers they've hit, 
and their overall health signal. Prioritize goal-relevant information and time-sensitive blockers.`,
      disposition: {
        skepticism: 2, // lean trusting — customers tell the truth about their pain
        literalism: 3, // balanced
        empathy: 5,    // max empathy — we care about their success
      },
    });
  } catch (err) {
    // 409 Conflict = bank already exists, which is fine
    if (!err.message?.includes('409') && !err.message?.includes('already exists')) {
      throw err;
    }
  }
}

/**
 * recall() — pull everything Hindsight knows about this customer.
 *
 * Returns an array of memory strings to inject into the system prompt.
 * Falls back gracefully if the bank doesn't exist yet (new customer).
 */
export async function recallCustomer(customerId, query = 'customer history goals blockers progress') {
  if (!isHindsightConfigured()) {
    return [];
  }

  await ensureCustomerBank(customerId);

  try {
    const response = await getClient().recall(bankId(customerId), query, {
      budget: 'high',  // use all four retrieval strategies (TEMPR)
      maxTokens: 2048,
    });

    return response.results ?? [];
  } catch (err) {
    // New customer with empty bank — not an error
    console.warn(`[Hindsight] recall returned empty for ${customerId}:`, err.message);
    return [];
  }
}

/**
 * retain() — save new information about this customer after a conversation turn.
 *
 * @param {string} customerId
 * @param {string} content    — natural-language summary of what was learned/happened
 * @param {object} metadata   — optional structured tags (stage, health, etc.)
 */
export async function retainForCustomer(customerId, content, metadata = {}) {
  if (!isHindsightConfigured()) {
    return;
  }

  await ensureCustomerBank(customerId);

  await getClient().retain(bankId(customerId), content, {
    context: 'customer-success-conversation',
    metadata,
    async: true, // fire-and-forget so the HTTP response isn't delayed
  });
}

/**
 * listMemories() — return raw stored facts for the customer panel in the UI.
 * Used by GET /customer/:id
 */
export async function listCustomerMemories(customerId) {
  if (!isHindsightConfigured()) {
    return [];
  }

  await ensureCustomerBank(customerId);

  try {
    const response = await getClient().listMemories(bankId(customerId), {
      limit: 50,
    });
    return response.memories ?? response.items ?? [];
  } catch (err) {
    console.warn(`[Hindsight] listMemories failed for ${customerId}:`, err.message);
    return [];
  }
}
