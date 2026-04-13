import React, { useEffect, useMemo, useRef, useState } from "react";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const SESSION_KEY = "cmaxx_operator";
const MEMORY_TOGGLE_KEY = "cmaxx_use_memory";

function chatStorageKey(customerId) {
  return `cmaxx_chat_${customerId}`;
}

export default function App() {
  const [screen, setScreen] = useState("login");
  const [operator, setOperator] = useState({
    name: "",
    email: "",
    team: "Customer Success"
  });
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState([]);
  const [memory, setMemory] = useState(emptyMemory());
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [useMemory, setUseMemory] = useState(() => {
    const saved = localStorage.getItem(MEMORY_TOGGLE_KEY);
    return saved == null ? true : saved === "true";
  });
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [flowNotice, setFlowNotice] = useState("");
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [sessionGoalAchieved, setSessionGoalAchieved] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [customerForm, setCustomerForm] = useState({
    name: "",
    role: "",
    company: "",
    email: "",
  });

  const customer = useMemo(() => customers.find((item) => item.customerId === customerId) ?? null, [customers, customerId]);
  const successPlan = useMemo(() => buildSuccessPlan(memory), [memory]);
  const latestAgentReply = useMemo(
    () => [...messages].reverse().find((m) => m.role === "agent")?.text || "",
    [messages]
  );
  const safeBlockers = Array.isArray(memory.blockers) ? memory.blockers : [];
  const safeCompleted = Array.isArray(memory.completed_steps) ? memory.completed_steps : [];
  const hasActiveCustomer = Boolean(customerId && customer);
  const unresolvedBlockers = useMemo(
    () => safeBlockers.filter((b) => !String(b.resolution || "").toLowerCase().includes("resolved") && !String(b.resolution || "").toLowerCase().includes("fixed") && String(b.resolution || "").toLowerCase() !== "done"),
    [safeBlockers]
  );
  const journey = useMemo(() => buildJourneyState(memory, safeCompleted, unresolvedBlockers, messages), [memory, safeCompleted, unresolvedBlockers, messages]);
  const messagesEndRef = useRef(null);

  const getApiUrl = (path) => `${apiBase}${path}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed?.name && parsed?.email) {
        setOperator(parsed);
        setScreen("workspace");
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (!hasActiveCustomer) {
      setMemory(emptyMemory());
      setMessages([]);
      setSessionGoalAchieved(false);
      return;
    }

    setSessionGoalAchieved(false);

    setDraft("");

    const savedChat = localStorage.getItem(chatStorageKey(customerId));
    if (savedChat) {
      try {
        const parsed = JSON.parse(savedChat);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        } else {
          setMessages([defaultGreeting(customer?.name || customerId)]);
        }
      } catch {
        setMessages([defaultGreeting(customer?.name || customerId)]);
      }
    } else {
      setMessages([defaultGreeting(customer?.name || customerId)]);
    }

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
          setMemory({ ...emptyMemory(), ...data });

          if (data.profile?.customerId) {
            setCustomers((items) =>
              items.map((item) =>
                item.customerId === data.profile.customerId
                  ? {
                      ...item,
                      name: data.profile.name || item.name,
                      role: data.profile.role || item.role,
                      company: data.profile.company || item.company,
                      email: data.profile.email || item.email,
                    }
                  : item
              )
            );
          }
        }
      })
      .catch(() => {
        setMemory(emptyMemory());
      });

    return () => controller.abort();
  }, [customerId, hasActiveCustomer]);

  useEffect(() => {
    localStorage.setItem(MEMORY_TOGGLE_KEY, String(useMemory));
  }, [useMemory]);

  useEffect(() => {
    if (!customerId) return;
    localStorage.setItem(chatStorageKey(customerId), JSON.stringify(messages));
  }, [customerId, messages]);

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const response = await fetch(getApiUrl("/customers"));
        if (!response.ok) throw new Error("Failed to fetch customers");
        const data = await response.json();
        const nextCustomers = Array.isArray(data.customers) ? data.customers : [];
        setCustomers(nextCustomers);

        if (!customerId && nextCustomers.length > 0) {
          setCustomerId(nextCustomers[0].customerId);
        }

        if (nextCustomers.length === 0) {
          setShowCreateCustomer(true);
        }
      } catch {
        setCustomers([]);
        setShowCreateCustomer(true);
      }
    }

    fetchCustomers();
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchStatus() {
      try {
        const response = await fetch(getApiUrl("/status"));
        const data = await response.json();
        if (active) setStatus(data);
      } catch {
        if (active) {
          setStatus({
            mode: "demo_fallback",
            integrations: { hindsight: "unknown", groq: "unknown" },
            persistence: "unknown"
          });
        }
      }
    }

    fetchStatus();
    const timer = setInterval(fetchStatus, 30_000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (sessionGoalAchieved && screen === "workspace") {
      setScreen("complete");
    }
  }, [sessionGoalAchieved, screen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending || !customerId) return;

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
        setMemory({ ...emptyMemory(), ...data.memory });
      }

      if (Boolean(data?.retainData?.goalAchieved)) {
        setSessionGoalAchieved(true);
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

  function handleLoginSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();

    if (!name || !email) return;

    setOperator({
      name,
      email,
      team: String(form.get("team") || "Customer Success")
    });
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        name,
        email,
        team: String(form.get("team") || "Customer Success")
      })
    );
    setScreen("workspace");
  }

  function loadStarterPrompt() {
    if (memory.stated_goal) {
      setDraft(`Quick update on ${memory.stated_goal}. Here is what we tried and where we are blocked.`);
      return;
    }

    setDraft("Hi, I need help setting a clear 30-day success goal and next actions.");
  }

  function clearConversation() {
    setDraft("");
    const next = [defaultGreeting(customer?.name || customerId || "there")];
    setMessages(next);
    if (customerId) {
      localStorage.setItem(chatStorageKey(customerId), JSON.stringify(next));
    }
  }

  function completeJourney() {
    if (!journey.canComplete) {
      setFlowNotice("Milestone is not ready yet. Resolve active blockers or capture more completed steps.");
      return;
    }
    setFlowNotice("");
    setSessionGoalAchieved(true);
    setScreen("complete");
  }

  function restartJourney() {
    setScreen("workspace");
    setFlowNotice("");
    setSessionGoalAchieved(false);
    clearConversation();
  }

  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    setOperator({ name: "", email: "", team: "Customer Success" });
    setScreen("login");
    setFlowNotice("");
    setSessionGoalAchieved(false);
  }

  async function saveCustomer(event) {
    event.preventDefault();
    if (isCreatingCustomer) return;

    const name = String(customerForm.name || "").trim();
    const role = String(customerForm.role || "").trim();
    const company = String(customerForm.company || "").trim();
    const email = String(customerForm.email || "").trim();

    if (!name) return;

    setIsCreatingCustomer(true);
    try {
      const method = formMode === "edit" && customerId ? "PATCH" : "POST";
      const endpoint = method === "PATCH"
        ? getApiUrl(`/customers/${encodeURIComponent(customerId)}`)
        : getApiUrl("/customers");

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, company, email })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create customer");

      const created = data.customer;
      setCustomers((items) =>
        [...items.filter((c) => c.customerId !== created.customerId), created].sort((a, b) =>
          String(a.name || a.customerId).localeCompare(String(b.name || b.customerId))
        )
      );
      setCustomerId(created.customerId);
      setShowCreateCustomer(false);
      setFormMode("create");
      setCustomerForm({ name: "", role: "", company: "", email: "" });
      setFlowNotice("");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      setFlowNotice(`Could not save customer (${reason}).`);
    } finally {
      setIsCreatingCustomer(false);
    }
  }

  function startCreateCustomer() {
    setFormMode("create");
    setCustomerForm({ name: "", role: "", company: "", email: "" });
    setShowCreateCustomer(true);
    setFlowNotice("");
  }

  function startEditCustomer() {
    if (!customer) return;
    setFormMode("edit");
    setCustomerForm({
      name: customer.name || "",
      role: customer.role || "",
      company: customer.company || "",
      email: customer.email || "",
    });
    setShowCreateCustomer(true);
    setFlowNotice("");
  }

  async function deleteCurrentCustomer() {
    if (!customerId) return;
    const confirmed = window.confirm("Delete this customer from registry? Their memory bank may still exist in Hindsight.");
    if (!confirmed) return;

    try {
      const response = await fetch(getApiUrl(`/customers/${encodeURIComponent(customerId)}`), {
        method: "DELETE",
      });

      if (!response.ok && response.status !== 404) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Delete failed");
      }

      setCustomers((items) => {
        const next = items.filter((c) => c.customerId !== customerId);
        setCustomerId(next[0]?.customerId || "");
        return next;
      });
      setShowCreateCustomer(false);
      setFormMode("create");
      setCustomerForm({ name: "", role: "", company: "", email: "" });
      setFlowNotice("");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      setFlowNotice(`Could not delete customer (${reason}).`);
    }
  }

  if (screen === "login") {
    return (
      <main className="screen login-screen">
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <section className="clay-card login-card">
          <p className="eyebrow">CmaxX Memory OS</p>
          <h1>Ship customer outcomes, not just conversations.</h1>
          <p className="subtle">
            This workspace keeps context across conversations, avoids repeated failed fixes,
            and guides each account to first value.
          </p>

          <form onSubmit={handleLoginSubmit} className="grid-form">
            <label>
              Operator Name
              <input name="name" placeholder="Ariana Patel" required />
            </label>
            <label>
              Work Email
              <input name="email" type="email" placeholder="ariana@cmaxx.ai" required />
            </label>
            <label>
              Team
              <select name="team" defaultValue="Customer Success">
                <option>Customer Success</option>
                <option>Support Ops</option>
                <option>Onboarding</option>
                <option>Growth</option>
              </select>
            </label>
            <label>
              Workspace Password
              <input name="password" type="password" placeholder="Enter secure passphrase" required />
            </label>

            <button type="submit" className="button-hero">Enter Workspace</button>
          </form>
          <div className="status-row">
            <span className="pill">Claymorphism UI</span>
            <span className="pill">Live memory aware</span>
            <span className="pill">Ready on mobile</span>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "complete") {
    return (
      <main className="screen complete-screen">
        <section className="clay-card complete-card">
          <p className="eyebrow">Journey Complete</p>
          <h1>Milestone reached for {customer?.name || customerId || "this customer"}.</h1>
          <p className="subtle">Context, success plan, and latest response are stored and ready for the next touchpoint.</p>

          <div className="summary-grid">
            <div>
              <h3>Goal</h3>
              <p>{memory.stated_goal || "No goal captured"}</p>
            </div>
            <div>
              <h3>Current Stage</h3>
              <p>{String(memory.current_stage || "onboarding").replace("_", " ")}</p>
            </div>
            <div>
              <h3>Health</h3>
              <p>{String(memory.health_signal || "engaged").replace("_", " ")}</p>
            </div>
            <div>
              <h3>Latest Agent Response</h3>
              <p>{latestAgentReply || "No reply generated yet"}</p>
            </div>
          </div>

          <div className="action-row">
            <button type="button" onClick={restartJourney}>Back to Workspace</button>
            <button type="button" className="button-ghost" onClick={signOut}>Sign out</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="screen workspace-screen">
      <header className="workspace-top">
        <div>
          <p className="eyebrow">Operator</p>
          <h2>{operator.name || "Guest"} - {operator.team}</h2>
        </div>
        <div className="status-row">
          <span className="pill">{operator.email || "No email"}</span>
          {status && (
            <span className="pill">
              {status.mode === "real_integrations" ? "Live integrations" : "Demo fallback"}
            </span>
          )}
          <span className="pill">Journey {journey.progress}%</span>
          <button type="button" className="button-ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className="app-shell">
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
          <label className="memory-toggle">
            <input
              type="checkbox"
              checked={useMemory}
              onChange={(event) => setUseMemory(event.target.checked)}
            />
            <span>{useMemory ? "Memory on" : "Memory off"}</span>
          </label>
          <div className="progress-wrap" aria-label="Journey progress">
            <div className="progress-label">Milestone Progress</div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${journey.progress}%` }} />
            </div>
          </div>
        </header>

        <div className="customer-strip">
          <label>
            Customer
            <select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              disabled={customers.length === 0}
            >
              {customers.length === 0 ? (
                <option value="">No customers yet</option>
              ) : customers.map((item) => (
                <option value={item.customerId} key={item.customerId}>
                  {item.name || item.customerId}
                </option>
              ))}
            </select>
          </label>
          <div className="customer-actions">
            <button
              className="secondary"
              type="button"
              onClick={() => {
                if (showCreateCustomer) {
                  setShowCreateCustomer(false);
                } else {
                  startCreateCustomer();
                }
              }}
            >
              {showCreateCustomer ? "Close form" : "Add customer"}
            </button>
            <button className="quiet" type="button" onClick={startEditCustomer} disabled={!hasActiveCustomer}>
              Edit customer
            </button>
            <button className="danger" type="button" onClick={deleteCurrentCustomer} disabled={!hasActiveCustomer}>
              Delete customer
            </button>
            <button className="quiet" type="button" onClick={loadStarterPrompt} disabled={!customerId}>
              Load starter line
            </button>
            <button className="quiet" type="button" onClick={clearConversation} disabled={!customerId}>
              Reset chat
            </button>
          </div>
        </div>

        {showCreateCustomer && (
          <form className="create-customer" onSubmit={saveCustomer}>
            <div className="create-customer-head">
              <strong>{formMode === "edit" ? "Edit customer" : "Create customer"}</strong>
              <button type="button" className="quiet" onClick={() => setShowCreateCustomer(false)}>Close</button>
            </div>
            <label>
              Name
              <input
                name="name"
                required
                placeholder="Priya Sharma"
                value={customerForm.name}
                onChange={(event) => setCustomerForm((f) => ({ ...f, name: event.target.value }))}
              />
            </label>
            <label>
              Role
              <input
                name="role"
                placeholder="Operations Manager"
                value={customerForm.role}
                onChange={(event) => setCustomerForm((f) => ({ ...f, role: event.target.value }))}
              />
            </label>
            <label>
              Company
              <input
                name="company"
                placeholder="Acme Inc"
                value={customerForm.company}
                onChange={(event) => setCustomerForm((f) => ({ ...f, company: event.target.value }))}
              />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                placeholder="priya@acme.com"
                value={customerForm.email}
                onChange={(event) => setCustomerForm((f) => ({ ...f, email: event.target.value }))}
              />
            </label>
            <button type="submit" disabled={isCreatingCustomer}>
              {isCreatingCustomer
                ? (formMode === "edit" ? "Saving..." : "Creating...")
                : (formMode === "edit" ? "Save customer" : "Create customer")}
            </button>
            {formMode === "create" && (
              <button type="button" className="quiet" onClick={startCreateCustomer}>
                Clear form
              </button>
            )}
          </form>
        )}

        {hasActiveCustomer ? (
          <>
            <div className="customer-hero">
              <img src={avatarForCustomer(customer?.customerId || "") } alt="" />
              <div>
                <strong>{customer?.name || customerId}</strong>
                <span>{customer?.role || "Role not set"}</span>
              </div>
            </div>

            <div className="messages" aria-live="polite">
              {messages.map((message, index) => (
                <div className={`bubble ${message.role}`} key={`${message.role}-${index}`}>
                  {message.text}
                </div>
              ))}
              {isSending && <div className="bubble agent">Thinking with the customer history...</div>}
              <div ref={messagesEndRef} />
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

            <div className="journey-footer">
              <button type="button" className="secondary" onClick={completeJourney} disabled={!journey.canComplete && !memory.goal_achieved}>
                Mark Milestone Complete
              </button>
              {flowNotice && <p className="flow-notice">{flowNotice}</p>}
            </div>
          </>
        ) : (
          <div className="empty-chat-state">
            <h3>No customer selected</h3>
            <p>Create your first customer above to start a real memory-backed conversation flow.</p>
          </div>
        )}
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
            Memory is off for this session. Replies will not use recall or retention.
          </div>
        )}
        <MemoryBlock title="Goal">{memory.stated_goal || "No goal captured yet"}</MemoryBlock>
        <MemoryBlock title="Stage">{String(memory.current_stage || "onboarding").replace("_", " ")}</MemoryBlock>
        <MemoryBlock title="Milestone Rules">
          <ul>
            <li>Goal present: {memory.stated_goal ? "Yes" : "No"}</li>
            <li>Completed steps: {safeCompleted.length}</li>
            <li>Open blockers: {unresolvedBlockers.length}</li>
            <li>Ready to complete: {journey.canComplete ? "Yes" : "No"}</li>
          </ul>
        </MemoryBlock>
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
          {safeCompleted.length ? (
            <ul>
              {safeCompleted.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          ) : (
            "No completed milestones yet."
          )}
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
        <MemoryBlock title="Last Contact">{memory.last_contact || "Not available yet"}</MemoryBlock>
        <MemoryBlock title="Notes">{memory.notes || "No notes yet"}</MemoryBlock>
      </aside>
      </section>
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
  const unresolved = blockers.filter((b) => !String(b.resolution || "").toLowerCase().includes("resolved") && !String(b.resolution || "").toLowerCase().includes("fixed"));
  const blockerText = unresolved.map((blocker) => blocker.issue).join(" ").toLowerCase();
  const goal = (memory.stated_goal || "").toLowerCase();
  const health = (memory.health_signal || "engaged").replace("_", " ");

  if (!goal) {
    return {
      health,
      timeToValue: "Goal not captured yet",
      nextBestAction: "Capture a specific 30-day success target"
    };
  }

  if (unresolved.length > 2) {
    return {
      health,
      timeToValue: "Risky path due to multiple blockers",
      nextBestAction: "Prioritize top blocker and defer lower-priority tasks"
    };
  }

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

function emptyMemory() {
  return {
    stated_goal: "",
    current_stage: "onboarding",
    completed_steps: [],
    blockers: [],
    last_contact: "",
    health_signal: "engaged",
    goal_achieved: false,
    notes: "",
  };
}

function avatarForCustomer(seed) {
  const code = Math.abs(
    Array.from(String(seed || 'customer')).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  );
  const id = (code % 70) + 1;
  return `https://i.pravatar.cc/160?img=${id}`;
}

function MemoryBlock({ title, children }) {
  return (
    <section className="memory-block">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function buildJourneyState(memory, completedSteps, unresolvedBlockers, messages) {
  const stage = String(memory.current_stage || "onboarding");
  const baseByStage = {
    onboarding: 20,
    adoption: 50,
    value_achieved: 82,
    expansion: 95
  };

  let progress = baseByStage[stage] ?? 20;
  progress += Math.min(completedSteps.length * 6, 18);
  progress -= Math.min(unresolvedBlockers.length * 9, 24);
  if (memory.goal_achieved) progress = 100;

  progress = Math.max(0, Math.min(100, progress));

  const hasGoal = Boolean(memory.stated_goal);
  const hasConversationDepth = messages.filter((m) => m.role === "agent").length >= 2;
  const hasEnoughSteps = completedSteps.length >= 2;
  const blockersManaged = unresolvedBlockers.length <= 1;

  const canComplete = Boolean(memory.goal_achieved) || (hasGoal && hasConversationDepth && hasEnoughSteps && blockersManaged && progress >= 70);

  return { progress, canComplete };
}

function defaultGreeting(name) {
  return {
    role: "agent",
    text: `Hi ${String(name || "there").split(" ")[0]} - I am your Customer Success Agent. Tell me your 30-day goal and the blocker you want to solve first.`
  };
}

