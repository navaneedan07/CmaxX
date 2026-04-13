import { normalizeRetainData } from './retainSchema.js';

/**
 * groq.js
 * Wrapper around the Groq API using the openai-compatible endpoint.
 * Model: qwen/qwen3-32b (free tier, very fast)
 *
 * Handles:
 *  - System prompt injection with recalled memories
 *  - Graceful retry if the model returns a malformed response
 *  - Timeout (15s) so the endpoint never hangs
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'qwen/qwen3-32b';
const TIMEOUT_MS = 15_000;

function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

function buildFallbackReply(userMessage, useMemory) {
  const opener = useMemory
    ? 'Thanks for the update. I reviewed your context and can help with a concrete next step.'
    : 'Thanks for the update. Since memory is off, I will treat this as a fresh conversation.';

  return `${opener} Based on what you shared: "${userMessage}". Let's break this into one immediate action, one validation step, and one follow-up checkpoint so you can make progress today.`;
}

function buildFallbackRetainData(userMessage) {
  return {
    summary: `Customer message received: ${userMessage}`,
    stage: 'adoption',
    health: 'engaged',
    newBlocker: null,
    blockerResolved: null,
    goalMentioned: null,
    goalAchieved: false,
  };
}

/**
 * Build the Customer Success Agent system prompt.
 * Injects Hindsight-recalled memories so the agent is context-aware.
 *
 * @param {Array}  memories   — results from hindsight.recallCustomer()
 * @param {string} customerId
 */
function buildSystemPrompt(memories, customerId, useMemory = true) {
  let memorySection;

  if (!useMemory) {
    memorySection = `## Memory Status\nMemory is DISABLED. You have no knowledge of this customer's history. Treat every message as a first-time interaction.`;
  } else if (memories.length > 0) {
    memorySection = `## What You Remember About This Customer\n${memories.map((m) => `- ${m.text ?? m}`).join('\n')}`;
  } else {
    memorySection = `## Customer History\nThis is a new customer. No prior history exists yet.`;
  }

  return `You are a proactive Customer Success Agent. Your job is NOT to react to problems — it is to guide customers to their first success milestone before they know they need help.

## Your Behaviour Rules
1. **Reference past context explicitly.** If you know something, say so. "Last time you mentioned..." or "Since you've already completed X, let's move to Y..."
2. **Never repeat a failed solution.** If a blocker was recorded, skip it and offer the next best approach.
3. **Celebrate milestones specifically.** When a customer hits their stated goal, name it back to them exactly.
4. **Ask for the goal in the first conversation.** If no stated_goal is in memory, ask: "What does success look like for you in 30 days?"
5. **Be human, warm, and brief.** No corporate speak. No walls of text.
6. **Track the customer's stage:** onboarding → adoption → value_achieved → expansion.

## Customer ID
${customerId}

${memorySection}

## After Every Response
At the END of your reply (hidden from the user), add a JSON block wrapped in <retain> tags. Format:
<retain>
{
  "summary": "One-sentence summary of what happened in this turn",
  "stage": "onboarding | adoption | value_achieved | expansion",
  "health": "engaged | going_quiet | at_risk",
  "newBlocker": "description if a new blocker was mentioned, else null",
  "blockerResolved": "description if a blocker was resolved, else null",
  "goalMentioned": "the customer's stated goal if they mentioned one, else null",
  "goalAchieved": true or false
}
</retain>`;
}

/**
 * Call Groq and return { reply, retainData }
 *
 * @param {string} systemPrompt
 * @param {Array}  conversationHistory — [{ role, content }, ...]
 * @param {string} userMessage
 */
async function callGroq(systemPrompt, conversationHistory, userMessage) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let rawText;
  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Groq API error ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    rawText = data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }

  return parseGroqResponse(rawText);
}

/**
 * Split the model's output into:
 *  - reply  (what the user sees — everything BEFORE <retain>)
 *  - retainData (parsed JSON from inside <retain>...</retain>)
 */
function parseGroqResponse(rawText) {
  const retainMatch = rawText.match(/<retain>([\s\S]*?)<\/retain>/i);
  let reply = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')   // strip qwen3 reasoning chain
    .replace(/<retain>[\s\S]*?<\/retain>/gi, '')  // strip retain block
    .trim();

  let retainData = null;
  if (retainMatch) {
    try {
      const parsed = JSON.parse(retainMatch[1].trim());
      const normalized = normalizeRetainData(parsed);
      if (normalized.valid) {
        retainData = normalized.data;
      } else {
        console.warn(`[Groq] Dropping invalid <retain> payload (${normalized.reason})`);
      }
    } catch {
      console.warn('[Groq] Could not parse <retain> JSON block — skipping memory mutation');
    }
  }

  if (!reply) {
    reply = retainData?.summary
      ? `Thanks for the update. ${retainData.summary}`
      : "Thanks for the update. Let's take the next step together.";
  }

  return { reply, retainData };
}

/**
 * Main export — called by the /chat route.
 * Retries once on transient Groq errors before giving up.
 */
export async function askGroq(memories, conversationHistory, userMessage, customerId, useMemory = true) {
  if (!isGroqConfigured()) {
    return {
      reply: buildFallbackReply(userMessage, useMemory),
      retainData: buildFallbackRetainData(userMessage),
    };
  }

  const systemPrompt = buildSystemPrompt(memories, customerId, useMemory);

  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await callGroq(systemPrompt, conversationHistory, userMessage);
    } catch (err) {
      lastErr = err;
      if (attempt === 1) {
        console.warn(`[Groq] Attempt ${attempt} failed: ${err.message} — retrying...`);
        await new Promise((r) => setTimeout(r, 800)); // brief back-off
      }
    }
  }

  throw new Error(`Groq call failed after 2 attempts: ${lastErr.message}`);
}
