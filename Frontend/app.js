// ─── Config ─────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3001';

// ─── State ──────────────────────────────────────────────────────────────────
let currentCustomerId = 'customer-sarah';
let useMemory = true;
let conversationHistory = []; // [{ role, content }]
let memoryState = createEmptyMemory();
let thinkingEl = null;

function createEmptyMemory() {
  return {
    stated_goal: '',
    current_stage: 'onboarding',
    completed_steps: [],
    blockers: [],
    last_contact: '',
    health_signal: 'engaged',
    goal_achieved: false,
    notes: '',
    raw_memories: [],
  };
}

// ─── DOM refs ────────────────────────────────────────────────────────────────
const chatMessages   = document.getElementById('chatMessages');
const messageInput   = document.getElementById('messageInput');
const sendBtn        = document.getElementById('sendBtn');
const customerSelect = document.getElementById('customerSelect');
const customIdInput  = document.getElementById('customIdInput');
const memoryToggle   = document.getElementById('memoryToggle');
const memoryBadge    = document.getElementById('memoryBadge');
const memoryOffMsg   = document.getElementById('memoryOffOverlay');

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  syncMemoryToggleUI();
  await loadCustomer(currentCustomerId);
});

// ─── Event Listeners ─────────────────────────────────────────────────────────
function setupEventListeners() {
  // Send on button click
  sendBtn.addEventListener('click', sendMessage);

  // Send on Enter (Shift+Enter = newline)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Customer selector dropdown
  customerSelect.addEventListener('change', () => {
    const val = customerSelect.value;
    if (val === 'custom') {
      customIdInput.style.display = 'block';
      customIdInput.focus();
    } else {
      customIdInput.style.display = 'none';
      switchCustomer(val);
    }
  });

  // Custom ID input — switch on Enter
  customIdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const id = customIdInput.value.trim();
      if (id) switchCustomer(id);
    }
  });

  // Memory toggle
  memoryToggle.addEventListener('change', () => {
    useMemory = memoryToggle.checked;
    syncMemoryToggleUI();
    addSystemMessage(
      useMemory
        ? 'Memory ON — agent will recall and retain context.'
        : 'Memory OFF — agent is now stateless (no history).',
    );
  });
}

// ─── Customer switching ───────────────────────────────────────────────────────
async function switchCustomer(id) {
  if (id === currentCustomerId) return;
  currentCustomerId = id;
  conversationHistory = [];
  memoryState = createEmptyMemory();

  clearChat();
  addSystemMessage(`Switched to customer: ${id}`);
  await loadCustomer(id);
}

async function loadCustomer(customerId) {
  try {
    const res = await fetch(`${API_BASE}/customer/${encodeURIComponent(customerId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Populate raw memories
    memoryState.raw_memories = data.memories ?? [];

    // Extract structured fields from raw memory text/metadata
    extractStructuredFromMemories(data.memories ?? []);
    renderMemoryPanel();

    if (data.memories && data.memories.length > 0) {
      addSystemMessage(`Loaded ${data.memories.length} memory items for ${customerId}.`);
    } else {
      addSystemMessage(`No prior memory for ${customerId} — fresh start.`);
    }
  } catch (err) {
    console.warn('[loadCustomer] Could not fetch memory:', err.message);
    renderMemoryPanel();
    addSystemMessage(`Memory load failed for ${customerId}. Starting fresh.`);
  }
}

// ─── Send message ─────────────────────────────────────────────────────────────
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || sendBtn.disabled) return;

  messageInput.value = '';
  addBubble('user', text);
  setLoading(true);

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: currentCustomerId,
        message: text,
        history: conversationHistory.slice(-6), // last 3 turns for in-session context
        useMemory,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    // Add agent reply
    addBubble('agent', data.reply);

    // Maintain in-session history
    conversationHistory.push(
      { role: 'user',      content: text       },
      { role: 'assistant', content: data.reply },
    );

    // Update memory state from this turn
    if (data.retainData) updateMemoryFromRetain(data.retainData);
    if (data.memory && data.memory.length > 0) {
      memoryState.raw_memories = data.memory;
    }

    renderMemoryPanel();
  } catch (err) {
    removeThinking();
    addSystemMessage(`Error: ${err.message}`, true);
  } finally {
    setLoading(false);
  }
}

// ─── Memory state helpers ─────────────────────────────────────────────────────
function updateMemoryFromRetain(r) {
  if (r.stage)            memoryState.current_stage  = r.stage;
  if (r.health)           memoryState.health_signal  = r.health;
  if (r.goalMentioned)    memoryState.stated_goal     = r.goalMentioned;
  if (r.goalAchieved)     memoryState.goal_achieved   = true;
  if (r.summary)          memoryState.notes           = r.summary;

  memoryState.last_contact = todayStr();

  if (r.newBlocker) {
    // Avoid duplicate blockers
    const exists = memoryState.blockers.some((b) =>
      b.issue.toLowerCase().includes(r.newBlocker.toLowerCase().slice(0, 20)),
    );
    if (!exists) {
      memoryState.blockers.push({ issue: r.newBlocker, resolution: '', date: todayStr() });
    }
  }

  if (r.blockerResolved) {
    // Mark the most recent unresolved blocker as resolved
    const open = memoryState.blockers.find((b) => !b.resolution);
    if (open) open.resolution = r.blockerResolved;
  }
}

function extractStructuredFromMemories(memories) {
  for (const m of memories) {
    const text  = m.content ?? m.text ?? (typeof m === 'string' ? m : '');
    const meta  = m.metadata ?? {};

    if (!text) continue;

    // Goal
    if (!memoryState.stated_goal) {
      const g = text.match(/(?:30-day goal|stated goal)[:\s]+(.+?)(?:\.|$)/i);
      if (g) memoryState.stated_goal = g[1].trim();
    }

    // Stage (prefer metadata)
    if (meta.stage) memoryState.current_stage = meta.stage;

    // Health (prefer metadata)
    if (meta.health) {
      // normalise "at_risk" vs "at-risk"
      memoryState.health_signal = meta.health.replace(/-/g, '_');
    }

    // Blockers from metadata
    if (meta.blocker) {
      const alreadyHave = memoryState.blockers.some((b) =>
        b.issue.toLowerCase().includes(meta.blocker.toLowerCase()),
      );
      if (!alreadyHave) {
        memoryState.blockers.push({
          issue: meta.blocker,
          resolution: meta.blockerResolved ?? '',
          date: meta.date ?? '',
        });
      }
    }

    // Resolved blocker
    if (meta.blockerResolved) {
      const b = memoryState.blockers.find(
        (x) => x.issue.toLowerCase().includes(meta.blockerResolved.toLowerCase().slice(0, 20)),
      );
      if (b && !b.resolution) b.resolution = meta.blockerResolved;
    }
  }
}

// ─── Render memory panel ─────────────────────────────────────────────────────
function renderMemoryPanel() {
  // Goal
  setMemText('mem-goal', memoryState.stated_goal || 'Not stated yet');

  // Stage badge
  const stageEl = document.getElementById('mem-stage');
  const stageKey = (memoryState.current_stage || 'onboarding').replace(/\s/g, '_');
  stageEl.textContent = stageKey.replace(/_/g, ' ');
  stageEl.className = `badge stage-${stageKey}`;

  // Health badge
  const healthEl = document.getElementById('mem-health');
  const healthKey = (memoryState.health_signal || 'engaged').replace(/-/g, '_');
  healthEl.textContent = healthKey.replace(/_/g, ' ');
  healthEl.className = `badge health-${healthKey}`;

  // Goal achieved badge
  const goalEl = document.getElementById('mem-goal-achieved');
  goalEl.textContent = memoryState.goal_achieved ? 'Yes ✓' : 'Not yet';
  goalEl.className = `badge ${memoryState.goal_achieved ? 'goal-yes' : 'goal-no'}`;

  // Last contact
  setMemText('mem-last-contact', memoryState.last_contact || '—');

  // Latest note / summary
  setMemText('mem-notes', memoryState.notes || '—');

  // Blockers
  const blockersEl = document.getElementById('mem-blockers');
  if (memoryState.blockers.length === 0) {
    blockersEl.innerHTML = '<span class="mem-value empty">None recorded</span>';
  } else {
    blockersEl.innerHTML = '<div class="blocker-list">' +
      memoryState.blockers.map((b) => `
        <div class="blocker-item ${b.resolution ? 'resolved' : 'active'}">
          <span class="blocker-issue">${escHtml(b.issue)}</span>
          ${b.resolution ? `<span class="blocker-resolution">✓ ${escHtml(b.resolution)}</span>` : ''}
          ${b.date      ? `<span class="blocker-date">${escHtml(b.date)}</span>` : ''}
        </div>`).join('') +
      '</div>';
  }

  // Raw memories
  const rawEl = document.getElementById('mem-raw');
  if (memoryState.raw_memories.length === 0) {
    rawEl.innerHTML = '<span class="mem-value empty">No memories yet — start chatting.</span>';
  } else {
    rawEl.innerHTML = '<div class="memory-items">' +
      memoryState.raw_memories
        .slice(0, 12) // cap to keep panel readable
        .map((m) => {
          const txt = m.content ?? m.text ?? JSON.stringify(m);
          return `<div class="memory-item">${escHtml(String(txt))}</div>`;
        }).join('') +
      '</div>';
  }
}

// ─── Chat rendering ───────────────────────────────────────────────────────────
function addBubble(role, text) {
  removeThinking();

  const wrap = document.createElement('div');
  wrap.className = `msg ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.textContent = role === 'user' ? 'You' : `Agent · ${timeStr()}`;

  wrap.appendChild(bubble);
  wrap.appendChild(meta);
  chatMessages.appendChild(wrap);
  scrollToBottom();
}

function addSystemMessage(text, isError = false) {
  const wrap = document.createElement('div');
  wrap.className = 'msg system';

  const bubble = document.createElement('div');
  bubble.className = `msg-bubble${isError ? ' error' : ''}`;
  bubble.textContent = text;

  wrap.appendChild(bubble);
  chatMessages.appendChild(wrap);
  scrollToBottom();
}

function showThinking() {
  removeThinking();
  const wrap = document.createElement('div');
  wrap.className = 'msg agent';
  wrap.id = 'thinkingMsg';

  const thinking = document.createElement('div');
  thinking.className = 'thinking';
  thinking.innerHTML = '<span></span><span></span><span></span>';

  wrap.appendChild(thinking);
  chatMessages.appendChild(wrap);
  thinkingEl = wrap;
  scrollToBottom();
}

function removeThinking() {
  if (thinkingEl) {
    thinkingEl.remove();
    thinkingEl = null;
  }
}

function clearChat() {
  chatMessages.innerHTML = '';
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function setLoading(on) {
  sendBtn.disabled = on;
  messageInput.disabled = on;
  if (on) showThinking();
  else removeThinking();
}

function syncMemoryToggleUI() {
  if (useMemory) {
    memoryBadge.textContent = 'Memory ON';
    memoryBadge.className = 'on';
    memoryOffMsg.style.display = 'none';
  } else {
    memoryBadge.textContent = 'Memory OFF';
    memoryBadge.className = 'off';
    memoryOffMsg.style.display = 'block';
  }
}

function setMemText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = text && text !== '—' && text !== 'Not stated yet' && text !== 'Not yet'
    ? 'mem-value'
    : 'mem-value empty';
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function timeStr() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
