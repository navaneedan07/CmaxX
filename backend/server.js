import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chatRouter } from './routes/chat.js';
import { customerRouter } from './routes/customer.js';
import { ensureBankExists } from './services/hindsight.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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

// ─── Static frontend ────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, '../Frontend')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Startup ─────────────────────────────────────────────────────────────────
async function start() {
  // Validate required env vars
  const required = ['HINDSIGHT_API_KEY', 'HINDSIGHT_BASE_URL', 'GROQ_API_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('   Copy .env.example → .env and fill in your keys.');
    process.exit(1);
  }

  // Pre-create the global customer-success bank in Hindsight if it doesn't exist
  try {
    await ensureBankExists();
    console.log('✅ Hindsight memory bank ready');
  } catch (err) {
    console.error('❌ Could not connect to Hindsight:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 Customer Success Agent backend running on http://localhost:${PORT}`);
    console.log(`   POST /chat            — send a customer message`);
    console.log(`   GET  /customer/:id    — fetch a customer's memory\n`);
  });
}

start();
