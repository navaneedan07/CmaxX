import React, { useEffect, useMemo, useState } from "react";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const customers = [
  {
    customerId: "priya",
    name: "Priya Sharma",
    role: "SaaS ops manager",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
    stated_goal: "Automate invoice processing to reduce manual data entry by 80%",
    current_stage: "adoption",
    completed_steps: [
      "Completed account setup",
      "Connected billing software",
      "Processed first 10 invoices manually"
    ],
    blockers: [
      {
        issue: "Manual CSV import failed - file format mismatch",
        resolution: "Not yet resolved",
        date: "2025-04-08"
      },
      {
        issue: "Tried converting file to UTF-8 - still failed",
        resolution: "Not yet resolved",
        date: "2025-04-10"
      }
    ],
    last_contact:
      "Tried two workarounds for file format issue, neither worked. Customer frustrated but still engaged.",
    health_signal: "engaged",
    goal_achieved: false,
    notes:
      "SaaS ops manager, team of 4, very process-oriented, prefers step-by-step guidance"
  },
  {
    customerId: "james",
    name: "James Okafor",
    role: "Startup founder",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80",
    stated_goal: "Get all 8 team members fully onboarded and using the platform daily",
    current_stage: "adoption",
    completed_steps: [
      "Invited all 8 team members",
      "6 out of 8 members completed profile setup",
      "Team completed first training session"
    ],
    blockers: [
      {
        issue: "2 team members stuck on login - SSO error on their devices",
        resolution: "Pending IT check on their end",
        date: "2025-04-09"
      }
    ],
    last_contact:
      "6 of 8 onboarded. SSO issue blocking 2 members. James said he'd follow up with IT.",
    health_signal: "going_quiet",
    goal_achieved: false,
    notes:
      "Startup founder, moves fast, doesn't like long explanations, hasn't replied in 3 days"
  },
  {
    customerId: "lisa",
    name: "Lisa Tran",
    role: "Enterprise support lead",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80",
    stated_goal:
      "Reduce support ticket volume by 30% within 30 days using automated responses",
    current_stage: "adoption",
    completed_steps: [
      "Set up automated response templates",
      "Integrated with Zendesk",
      "Trained the agent on top 20 FAQ topics",
      "Deployed to 40% of incoming tickets"
    ],
    blockers: [],
    last_contact:
      "Ticket deflection is at 22% - 8% away from goal. Very happy with progress. Asked about expanding to more categories.",
    health_signal: "engaged",
    goal_achieved: false,
    notes:
      "Enterprise customer, data-driven, loves metrics, responds well to specific numbers and next steps"
  },
  {
    customerId: "david",
    name: "David Chen",
    role: "Senior developer",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80",
    stated_goal: "Build a full API integration between the platform and internal CRM",
    current_stage: "expansion",
    completed_steps: [
      "Completed onboarding in 2 days",
      "Set up all team permissions",
      "Read through full API documentation",
      "Built proof-of-concept integration locally"
    ],
    blockers: [
      {
        issue: "OAuth authentication failing in production environment",
        resolution: "Not yet resolved",
        date: "2025-04-11"
      }
    ],
    last_contact:
      "POC works locally but OAuth failing in production. Highly technical, investigating independently.",
    health_signal: "engaged",
    goal_achieved: false,
    notes:
      "Senior developer, very technical, prefers code examples over explanations, doesn't need hand-holding"
  }
];

const demoPrompts = {
  priya: "Hi, I'm still having trouble with the invoice import.",
  james: "Hey, checking in.",
  lisa: "How are we doing?",
  david: "Still stuck on the OAuth issue."
};

export default function App() {
  const [customerId, setCustomerId] = useState("priya");
  const [memory, setMemory] = useState(customers[0]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [useMemory, setUseMemory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState(null);

  const customer = useMemo(
    () => customers.find((item) => item.customerId === customerId) || customers[0],
    [customerId]
  );
  const successPlan = useMemo(() => buildSuccessPlan(memory), [memory]);
  const safeBlockers = Array.isArray(memory.blockers) ? memory.blockers : [];
  const safeCompleted = Array.isArray(memory.completed_steps) ? memory.completed_steps : [];

  const getApiUrl = (path) => `${apiBase}${path}`;

  useEffect(() => {
    setMemory(customer);
    setDraft("");
    setMessages([
      {
        role: "agent",
        text: `Hi ${customer.name.split(" ")[0]} - I am your Customer Success Agent. Tell me your 30-day goal and the blocker you want to solve first.`
      }
    ]);

    const controller = new AbortController();
    fetch(getApiUrl(`/customer/${encodeURIComponent(customerId)}`), {
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Backend returned ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setMemory({ ...customer, ...data });
        }
      })
      .catch(() => {
        setMemory(customer);
      });

    return () => controller.abort();
  }, [customer, customerId]);

  useEffect(() => {
    fetch(getApiUrl("/status"))
      .then((response) => response.json())
      .then(setStatus)
      .catch(() =>
        setStatus({
          mode: "demo_fallback",
          integrations: { hindsight: "unknown", groq: "unknown" },
          persistence: "unknown"
        })
      );
  }, []);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;

    const previousMessages = messages;
    setMessages((items) => [...items, { role: "customer", text }]);
    setDraft("");
    setIsSending(true);

    try {
      const response = await fetch(getApiUrl("/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          message: text,
          useMemory,
          history: toGroqHistory(previousMessages)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chat failed");

      setMessages((items) => [...items, { role: "agent", text: data.reply }]);
      if (data.memory && Object.keys(data.memory).length > 0) {
        setMemory({ ...customer, ...data.memory });
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Request failed";
      setMessages((items) => [
        ...items,
        {
          role: "agent",
          text: `I hit a temporary issue talking to the backend (${reason}). Please retry, and I will continue from your latest context.`
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function loadDemoPrompt() {
    setDraft(demoPrompts[customerId] || "");
  }

  function clearConversation() {
    setDraft("");
    setMessages([
      {
        role: "agent",
        text: `Hi ${customer.name.split(" ")[0]} - I am your Customer Success Agent. Tell me your 30-day goal and the blocker you want to solve first.`
      }
    ]);
  }

  return (
    <main className="app-shell">
      <section className="chat-pane">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">CS</span>
            <div>
              <h1>Customer Success Agent</h1>
              <p>A support agent that never forgets your customers.</p>
            </div>
          </div>
          {status && (
            <span className={`mode-pill ${status.mode}`}>
              {status.mode === "real_integrations" ? "Hindsight + Groq live" : "Demo fallback"}
            </span>
          )}
          <label className="memory-switch">
            <span>{useMemory ? "With memory" : "Without memory"}</span>
            <input
              type="checkbox"
              checked={useMemory}
              onChange={(event) => setUseMemory(event.target.checked)}
            />
          </label>
        </header>

        <div className="customer-strip">
          <label>
            Customer
            <select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              {customers.map((item) => (
                <option value={item.customerId} key={item.customerId}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary" type="button" onClick={loadDemoPrompt}>
            Load demo line
          </button>
          <button className="quiet" type="button" onClick={clearConversation}>
            Reset chat
          </button>
        </div>

        <div className="customer-hero">
          <img src={customer.avatar} alt="" />
          <div>
            <strong>{customer.name}</strong>
            <span>{customer.role}</span>
          </div>
        </div>

        <div className="messages" aria-live="polite">
          {messages.map((message, index) => (
            <div className={`bubble ${message.role}`} key={`${message.role}-${index}`}>
              {message.text}
            </div>
          ))}
          {isSending && <div className="bubble agent">Thinking with the customer history...</div>}
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a customer message..."
            aria-label="Customer message"
          />
          <button type="submit" disabled={isSending}>
            Send
          </button>
        </form>
      </section>

      <aside className="memory-pane">
        <div className="memory-head">
          <p>Live Memory</p>
          <span className={`health ${memory.health_signal}`}>{memory.health_signal}</span>
        </div>
        {status && (
          <div className="integration-note">
            Memory: {status.persistence === "hindsight_cloud" ? "Hindsight Cloud" : "local demo"}
            <br />
            AI: {status.integrations?.groq === "configured" ? "Groq configured" : "local fallback"}
          </div>
        )}
        {!useMemory && (
          <div className="memory-off-note">
            Memory is off for the next reply. The agent will not call Hindsight recall or retain.
          </div>
        )}

        <MemoryBlock title="Goal">{memory.stated_goal}</MemoryBlock>
        <MemoryBlock title="Stage">{memory.current_stage.replace("_", " ")}</MemoryBlock>
        <MemoryBlock title="Success Plan">
          <div className="plan-grid">
            <span>Health</span>
            <strong>{successPlan.health}</strong>
            <span>Time to value</span>
            <strong>{successPlan.timeToValue}</strong>
            <span>Next best action</span>
            <strong>{successPlan.nextBestAction}</strong>
          </div>
        </MemoryBlock>
        <MemoryBlock title="Completed">
          <ul>
            {safeCompleted.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </MemoryBlock>
        <MemoryBlock title="Past Blockers">
          {safeBlockers.length ? (
            <ul>
              {safeBlockers.map((blocker) => (
                <li key={`${blocker.date}-${blocker.issue}`}>
                  <strong>{blocker.date}</strong> {blocker.issue}
                  <span>{blocker.resolution}</span>
                </li>
              ))}
            </ul>
          ) : (
            "No blockers recorded."
          )}
        </MemoryBlock>
        <MemoryBlock title="Last Contact">{memory.last_contact}</MemoryBlock>
        <MemoryBlock title="Notes">{memory.notes}</MemoryBlock>
      </aside>
    </main>
  );
}

function toGroqHistory(messages) {
  return messages
    .filter((message) => message.role === "customer" || message.role === "agent")
    .slice(-6)
    .map((message) => ({
      role: message.role === "customer" ? "user" : "assistant",
      content: message.text
    }));
}

function buildSuccessPlan(memory) {
  const blockers = Array.isArray(memory.blockers) ? memory.blockers : [];
  const blockerText = blockers.map((blocker) => blocker.issue).join(" ").toLowerCase();
  const goal = (memory.stated_goal || "").toLowerCase();
  const health = (memory.health_signal || "engaged").replace("_", " ");

  if (blockerText.includes("invoice") || blockerText.includes("csv")) {
    return {
      health,
      timeToValue: "Blocked until import path works",
      nextBestAction: "Bypass CSV with direct API push"
    };
  }

  if (blockerText.includes("sso") || goal.includes("team")) {
    return {
      health,
      timeToValue: "2 seats away from team activation",
      nextBestAction: "Resolve SSO for the remaining members"
    };
  }

  if (goal.includes("ticket")) {
    return {
      health,
      timeToValue: "8 points away from 30% deflection",
      nextBestAction: "Expand automation to billing and returns"
    };
  }

  if (blockerText.includes("oauth") || goal.includes("api")) {
    return {
      health,
      timeToValue: "Production auth is the last blocker",
      nextBestAction: "Compare OAuth scopes and callback URLs"
    };
  }

  return {
    health,
    timeToValue: "Needs first milestone",
    nextBestAction: "Confirm the customer's 30-day goal"
  };
}

function MemoryBlock({ title, children }) {
  return (
    <section className="memory-block">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

