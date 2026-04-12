# Customer Success Agent — Backend

> **Hindsight Hackathon** · Member 1 (Backend + Hindsight Integration)

An AI agent that guides customers from signup to success — and gets smarter with every conversation because it actually remembers everything.

---

## Quick Start (5 minutes)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Fill in your keys (see below)
```

Required keys in `.env`:
| Variable | Where to get it |
|---|---|
| `HINDSIGHT_API_KEY` | [ui.hindsight.vectorize.io](https://ui.hindsight.vectorize.io) — use promo **MEMHACK409** for $50 free credits |
| `HINDSIGHT_BASE_URL` | `https://api.hindsight.vectorize.io` (default for Cloud) |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) — free tier |

### 3. Seed demo personas (optional but recommended for the demo)
```bash
node seed.js
```
This creates 3 pre-populated customer histories in Hindsight:
- **customer-sarah** — mid-journey, engaged, 62% to goal, CSV blocker already resolved
- **customer-raj** — at-risk, stuck on rules engine, going quiet
- **any new ID** — stateless new customer (demonstrates the "before" state)

### 4. Start the server
```bash
npm start
# or for hot-reload during development:
npm run dev
```

Server runs at `http://localhost:3001`

---

## API Reference

### `POST /chat`

The core endpoint. Implements the full memory loop.

**Request:**
```json
{
  "customerId": "customer-sarah",
  "message": "Hi, I need some help",
  "history": [
    { "role": "user", "content": "previous message" },
    { "role": "assistant", "content": "previous reply" }
  ]
}
```
`history` is optional — pass the last few turns for conversational context within a session.

**Response:**
```json
{
  "reply": "Hi Sarah! Last time we spoke, you were working on getting Tom and Priya onboarded...",
  "memory": [ /* raw Hindsight memory items for the UI panel */ ],
  "retainData": {
    "summary": "Sarah checked in on team onboarding status",
    "stage": "adoption",
    "health": "engaged",
    "newBlocker": null,
    "blockerResolved": null,
    "goalMentioned": null,
    "goalAchieved": false
  },
  "customerId": "customer-sarah"
}
```

---

### `GET /customer/:id`

Returns the customer's full memory for the frontend side panel.

**Response:**
```json
{
  "customerId": "customer-sarah",
  "memories": [ /* raw stored facts */ ],
  "summary": [ /* recalled/synthesised view */ ],
  "timestamp": "2026-04-12T10:00:00.000Z"
}
```

---

### `GET /health`

```json
{ "status": "ok", "timestamp": "..." }
```

---

## Architecture

```
POST /chat
│
├── 1. recallCustomer(customerId)
│       └── HindsightClient.recall(bankId, query, { budget: 'high' })
│           → 4-strategy TEMPR search: semantic + keyword + graph + temporal
│
├── 2. buildSystemPrompt(memories)
│       └── Inject recalled memories into agent context
│
├── 3. callGroq(systemPrompt, history, userMessage)
│       └── qwen/qwen3-32b via Groq API
│           → Returns: reply (visible) + <retain> JSON block (hidden)
│
├── 4. retainForCustomer(customerId, summary, metadata)
│       └── HindsightClient.retain(bankId, content, { async: true })
│           → Fires and forgets so response isn't delayed
│
└── 5. Return { reply, memory, retainData }
```

### Per-customer memory banks

Each customer gets their **own isolated Hindsight memory bank** (`cs-agent-{customerId}`). This means:
- No cross-customer data leakage
- Recall queries are scoped per customer automatically
- No separate database needed — Hindsight handles all persistence

### The `<retain>` pattern

The Groq model is prompted to append a structured JSON block at the end of every response:
```
<retain>
{
  "summary": "...",
  "stage": "onboarding | adoption | value_achieved | expansion",
  "health": "engaged | going_quiet | at_risk",
  "newBlocker": "...",
  "blockerResolved": "...",
  "goalMentioned": "...",
  "goalAchieved": false
}
</retain>
```
This block is stripped before sending the reply to the user, then saved to Hindsight with structured metadata tags. Future `recall()` calls can filter by these metadata fields.

---

## File Structure

```
customer-success-agent/
├── server.js                  # Express app entry point
├── package.json
├── .env.example               # Copy to .env and fill in keys
├── seed.js                    # Seed demo personas for judges
├── routes/
│   ├── chat.js                # POST /chat — core memory loop
│   └── customer.js            # GET /customer/:id — memory panel
└── services/
    ├── hindsight.js           # recall(), retain(), listMemories() wrappers
    └── groq.js                # Groq API client with retry logic
```

---

## Demo Script for Judges

1. **New customer** (no memory): `POST /chat` with `customerId: "customer-new-demo"` → agent asks for their goal
2. **Sarah** (engaged): `POST /chat` with `customerId: "customer-sarah"` → agent immediately references her 3/5 team members and 31/50 tickets, skips the CSV import (already failed), suggests completing Tom & Priya's onboarding
3. **Raj** (at-risk): `POST /chat` with `customerId: "customer-raj"` → agent acknowledges the 8-day silence, skips the Rules Engine suggestion (already failed twice), offers the Webhook API alternative instead

The **before/after** moment: same customer question, same intent — but with memory the agent knows exactly where they are and what not to suggest.

---

## Notes

- **Groq model**: `qwen/qwen3-32b` — free tier, very fast. Thinking mode is disabled for speed.
- **Hindsight Cloud**: uses async retain so the HTTP response isn't held up waiting for memory consolidation.
- **Error handling**: Groq calls retry once on failure. Hindsight calls fall back gracefully for new customers with empty banks.
- **No database needed**: Hindsight stores all customer state. This backend is stateless between requests.
