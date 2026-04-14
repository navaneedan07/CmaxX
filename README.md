# Customer Success Memory Agent

An AI-powered Customer Success agent that helps customers reach their first value milestone faster. It uses Hindsight for persistent customer memory and Groq for fast LLM responses.

## What It Solves

Customer success teams waste time rebuilding context before every conversation. Customers repeat goals, blockers, and failed fixes. This app remembers that history, recalls it before every reply, and stores what changed after every conversation.

Core demo line:

> A support agent that never forgets your customers, and gets smarter every conversation.

## Run Locally

From repo root (full app in one command):

```bash
npm install
npm run install:all
npm run app:dev
```

The UI opens automatically in your browser at startup.

Open:

```text
http://localhost:5173/
```

Backend status:

```text
http://localhost:3001/status
```

Or run each service separately:

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev:clean
```

Open:

```text
http://localhost:5173/
```

Backend status:

```text
http://localhost:3001/status
```

## Environment

Create `backend/.env`:

```env
HINDSIGHT_API_KEY=your_hindsight_key
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
GROQ_API_KEY=your_groq_key
PORT=3001
NODE_ENV=development
```

`backend/.env` is ignored by git. Do not commit real keys.

## Production Setup

From repo root (build frontend + serve everything from backend):

```bash
npm install
npm run install:all
npm run app:prod
```

This starts a single backend process that serves both API and built frontend.
`app:prod` runs backend with `NODE_ENV=production`.

Docker production run:

```bash
npm run docker:build
npm run docker:run
```

Make sure Docker Desktop (daemon) is running before these commands.

Or with Compose:

```bash
npm run docker:up
```

App URL:

```text
http://localhost:3001/
```

1. Build frontend assets:

```bash
cd frontend
npm ci
npm run build
```

2. Configure backend env (copy from `backend/.env.example`):

```env
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-frontend-domain.example
HINDSIGHT_API_KEY=...
GROQ_API_KEY=...
```

3. Start backend (serves API and `frontend/dist` when present):

```bash
cd backend
npm ci
npm start
```

The backend now includes security headers, rate limiting, request body limits, and graceful shutdown hooks for production deployments.

## CI and Release Safety

This repo includes a GitHub Actions workflow at `.github/workflows/ci.yml` that runs on push and pull request:

- frontend lint
- frontend production build
- backend syntax validation
- backend `/health` smoke test

Use this as a release gate before deploying.

## Demo

1. Select Priya.
2. Turn memory off and send: `Hi, I'm still having trouble with the invoice import.`
3. Show the generic stateless response.
4. Turn memory on and send the same line.
5. Show the memory-powered response: the agent remembers CSV import and UTF-8 both failed, skips both, and suggests direct API push.
6. Point to Live Memory: goal, health, blocker, success plan, and last contact.

## API

`GET /status`

Shows whether the app is using real integrations or fallback mode.

`GET /customer/:id`

Returns the structured customer memory used by the Live Memory panel.

`POST /chat`

```json
{
  "customerId": "priya",
  "message": "Hi, I'm still having trouble with the invoice import.",
  "useMemory": true,
  "history": []
}
```

Returns the agent reply, structured memory, raw Hindsight memories, retain data, and diagnostics.
