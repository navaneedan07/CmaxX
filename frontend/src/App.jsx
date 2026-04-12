import React, { useState, useEffect } from "react";
import Chat from "./components/Chat";
import MemoryPanel from "./components/MemoryPanel";
import CustomerCarousel from "./components/CustomerCarousel";

const API_URL = "http://localhost:3001";

const MOCK_MEMORIES = {
  priya: {
    stated_goal: "Automate invoice processing to reduce manual data entry by 80%",
    current_stage: "adoption",
    completed_steps: ["Completed account setup", "Connected billing software", "Processed first 10 invoices manually"],
    blockers: [
      { issue: "Manual CSV import failed — file format mismatch", resolution: "Not yet resolved", date: "2025-04-08" },
      { issue: "Tried converting file to UTF-8 — still failed", resolution: "Not yet resolved", date: "2025-04-10" }
    ],
    last_contact: "Tried two workarounds for file format issue, neither worked. Customer frustrated but still engaged.",
    health_signal: "engaged",
    goal_achieved: false,
    notes: "SaaS ops manager, team of 4, very process-oriented, prefers step-by-step guidance"
  },
  james: {
    stated_goal: "Get all 8 team members fully onboarded and using the platform daily",
    current_stage: "adoption",
    completed_steps: ["Invited all 8 team members", "6 out of 8 members completed profile setup", "Team completed first training session"],
    blockers: [
      { issue: "2 team members stuck on login — SSO error on their devices", resolution: "Pending IT check on their end", date: "2025-04-09" }
    ],
    last_contact: "6 of 8 onboarded. SSO issue blocking 2 members. James said he'd follow up with IT.",
    health_signal: "going_quiet",
    goal_achieved: false,
    notes: "Startup founder, moves fast, doesn't like long explanations, hasn't replied in 3 days"
  },
  lisa: {
    stated_goal: "Reduce support ticket volume by 30% within 30 days using automated responses",
    current_stage: "adoption",
    completed_steps: ["Set up automated response templates", "Integrated with Zendesk", "Trained the agent on top 20 FAQ topics", "Deployed to 40% of incoming tickets"],
    blockers: [],
    last_contact: "Ticket deflection is at 22% — 8% away from goal. Very happy with progress. Asked about expanding to more categories.",
    health_signal: "engaged",
    goal_achieved: false,
    notes: "Enterprise customer, data-driven, loves metrics, responds well to specific numbers and next steps"
  },
  david: {
    stated_goal: "Build a full API integration between the platform and internal CRM",
    current_stage: "expansion",
    completed_steps: ["Completed onboarding in 2 days", "Set up all team permissions", "Read through full API documentation", "Built proof-of-concept integration locally"],
    blockers: [
      { issue: "OAuth authentication failing in production environment", resolution: "Not yet resolved", date: "2025-04-11" }
    ],
    last_contact: "POC works locally but OAuth failing in production. Highly technical, investigating independently.",
    health_signal: "engaged",
    goal_achieved: false,
    notes: "Senior developer, very technical, prefers code examples over explanations, doesn't need hand-holding"
  },
  "customer-sarah": {
    stated_goal: "Get all 5 team members active and process the first 50 support tickets",
    current_stage: "adoption",
    completed_steps: ["Created account and set up workspace", "Connected Zendesk via API — 847 tickets imported", "Onboarded 3 of 5 team members"],
    blockers: [
      { issue: "CSV import failed — Windows-1252 encoding", resolution: "Resolved via Zendesk API integration", date: "2026-03-22" }
    ],
    last_contact: "31 of 50 tickets processed (62%). Tom & Priya on holiday, invites pending.",
    health_signal: "engaged",
    goal_achieved: false,
    notes: "Prefers async communication. Technically proficient, no hand-holding needed."
  },
  "customer-raj": {
    stated_goal: "Automate email routing to the right department with no manual sorting",
    current_stage: "onboarding",
    completed_steps: [],
    blockers: [
      { issue: "Rules Engine not firing — emails going to default inbox", resolution: "Not yet resolved", date: "2026-03-19" },
      { issue: "Tried correcting AND/OR logic — still not working", resolution: "Not yet resolved", date: "2026-03-20" }
    ],
    last_contact: "No login in 8 days. Mentioned thinking about switching to a simpler tool.",
    health_signal: "at_risk",
    goal_achieved: false,
    notes: "Developer — prefers API/webhook approach over UI tools. Offer webhook-based routing alternative."
  }
};

export default function App() {
  const [customerId, setCustomerId] = useState("priya");
  const [memory, setMemory] = useState(MOCK_MEMORIES["priya"]);
  const [messages, setMessages] = useState([]);
  const [useMemory, setUseMemory] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/customer/${customerId}`, { signal: AbortSignal.timeout(2000) })
      .then(res => res.json())
      .then(data => {
        setMemory(data);
        setMessages([]);
        setBackendOnline(true);
      })
      .catch(() => {
        setMemory(MOCK_MEMORIES[customerId]);
        setMessages([]);
        setBackendOnline(false);
      });
  }, [customerId]);

  const sendMessage = async (msg) => {
    const newMessages = [...messages, { role: "user", text: msg }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, message: msg, useMemory }),
        signal: AbortSignal.timeout(15000)
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "bot", text: data.reply }]);
      if (data.memory) setMemory(data.memory);
    } catch (err) {
      setMessages([...newMessages, {
        role: "bot",
        text: backendOnline === false
          ? "⚡ Backend not connected — running in demo mode. Start your Flask/Node server at localhost:5000 to enable live AI responses."
          : "Connection error. Please check that your backend server is running."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerSwitch = (id) => {
    setCustomerId(id);
    // Show mock as placeholder; useEffect replaces with live backend data
    setMemory(MOCK_MEMORIES[id] ?? null);
    setMessages([]);
  };

  return (
    <div className="app">
      <header className="navbar">
        <div className="brand">
          <span className="brand-logo">CX</span>
          <div>
            <h1 className="brand-name">CmaxX</h1>
            <span className="brand-tagline">Customer Success Agent</span>
          </div>
        </div>
        <div className="controls">
          <CustomerCarousel currentId={customerId} setCustomerId={handleCustomerSwitch} />
          <button
            className={`memory-toggle ${useMemory ? "on" : "off"}`}
            onClick={() => setUseMemory(!useMemory)}
          >
            <span className="toggle-dot" />
            Memory {useMemory ? "ON" : "OFF"}
          </button>
        </div>
        {backendOnline === false && (
          <div className="demo-badge">DEMO MODE — no backend</div>
        )}
      </header>

      <div className="layout">
        <Chat messages={messages} sendMessage={sendMessage} isLoading={isLoading} customerId={customerId} />
        <MemoryPanel memory={memory} useMemory={useMemory} />
      </div>
    </div>
  );
}
