import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chatRouter } from './routes/chat.js';
import { customerRouter } from './routes/customer.js';
import { customersRouter } from './routes/customers.js';
import { ensureBankExists, isHindsightConfigured } from './services/hindsight.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const frontendDistPath = join(__dirname, '../frontend/dist');

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Request logging (simple, no deps)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/chat', chatRouter);
app.use('/customer', customerRouter);
app.use('/customers', customersRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Integration status for frontend diagnostics.
app.get('/status', (_req, res) => {
  const hindsightConfigured = Boolean(process.env.HINDSIGHT_API_KEY && process.env.HINDSIGHT_BASE_URL);
  const groqConfigured = Boolean(process.env.GROQ_API_KEY);
  const usingRealIntegrations = hindsightConfigured && groqConfigured;

  res.json({
    mode: usingRealIntegrations ? 'real_integrations' : 'demo_fallback',
    integrations: {
      hindsight: hindsightConfigured ? 'configured' : 'missing_key',
      groq: groqConfigured ? 'configured' : 'missing_key',
    },
    persistence: hindsightConfigured ? 'hindsight_cloud' : 'unknown',
  });
});

// ─── Static frontend (production) ──────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(frontendDistPath));

  app.get('*', (_req, res) => {
    res.sendFile(join(frontendDistPath, 'index.html'));
  });
}

// ─── Startup ─────────────────────────────────────────────────────────────────
async function start() {
  if (isHindsightConfigured()) {
    // Validate connectivity when Hindsight keys exist.
    try {
      await ensureBankExists();
      console.log('✅ Hindsight memory bank ready');
    } catch (err) {
      console.warn('⚠️ Hindsight unavailable, running in demo fallback mode:', err.message);
    }
  } else {
    console.warn('⚠️ HINDSIGHT keys missing, running in demo fallback mode.');
  }

  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠️ GROQ_API_KEY missing, using local fallback responses.');
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 Customer Success Agent backend running on http://localhost:${PORT}`);
    console.log(`   POST /chat            — send a customer message`);
    console.log(`   GET  /customer/:id    — fetch a customer's memory\n`);
  });
}

start();
