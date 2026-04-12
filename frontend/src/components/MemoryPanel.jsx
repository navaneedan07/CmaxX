import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const STAGE_LABELS = {
  onboarding: { label: "Onboarding", color: "#7C6AF7", bg: "rgba(124,106,247,0.12)" },
  adoption: { label: "Adoption", color: "#1D9E75", bg: "rgba(29,158,117,0.12)" },
  value_achieved: { label: "Value Achieved", color: "#E8A020", bg: "rgba(232,160,32,0.12)" },
  expansion: { label: "Expansion", color: "#378ADD", bg: "rgba(55,138,221,0.12)" }
};

const HEALTH_LABELS = {
  engaged: { label: "Engaged", color: "#1D9E75", icon: "●" },
  going_quiet: { label: "Going Quiet", color: "#E8A020", icon: "●" },
  at_risk: { label: "At Risk", color: "#E24B4A", icon: "●" }
};

function MemoryField({ label, value }) {
  return (
    <motion.div
      className="memory-field"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="field-label">{label}</div>
      <div className="field-value">{value}</div>
    </motion.div>
  );
}

export default function MemoryPanel({ memory, useMemory }) {
  if (!useMemory) {
    return (
      <div className="memory-panel">
        <div className="memory-header">
          <span className="memory-title">Agent Memory</span>
          <span className="memory-badge off">OFF</span>
        </div>
        <div className="memory-disabled">
          <div className="disabled-icon">🚫</div>
          <p>Memory is disabled.</p>
          <p className="disabled-sub">The agent has no context about this customer — every message starts from zero.</p>
        </div>
      </div>
    );
  }

  if (!memory) {
    return (
      <div className="memory-panel">
        <div className="memory-header">
          <span className="memory-title">Agent Memory</span>
          <span className="memory-badge on">LIVE</span>
        </div>
        <div className="memory-empty">Loading memory...</div>
      </div>
    );
  }

  const stage = STAGE_LABELS[memory.current_stage] || { label: memory.current_stage, color: "#888", bg: "rgba(136,136,136,0.1)" };
  const health = HEALTH_LABELS[memory.health_signal] || { label: memory.health_signal, color: "#888", icon: "●" };

  return (
    <div className="memory-panel">
      <div className="memory-header">
        <span className="memory-title">Agent Memory</span>
        <span className="memory-badge on">LIVE</span>
      </div>

      <div className="memory-body">
        <div className="memory-meta">
          <div className="meta-pill" style={{ color: stage.color, background: stage.bg }}>
            {stage.label}
          </div>
          <div className="meta-pill health" style={{ color: health.color, background: "transparent", border: `1px solid ${health.color}40` }}>
            <span style={{ color: health.color, fontSize: "8px", marginRight: "5px" }}>{health.icon}</span>
            {health.label}
          </div>
        </div>

        <MemoryField label="Stated Goal" value={memory.stated_goal} />

        {memory.completed_steps && memory.completed_steps.length > 0 && (
          <div className="memory-section">
            <div className="section-label">Completed Steps</div>
            <div className="steps-list">
              {memory.completed_steps.map((step, i) => (
                <div key={i} className="step-item">
                  <span className="step-check">✓</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {memory.blockers && memory.blockers.length > 0 && (
          <div className="memory-section">
            <div className="section-label">Known Blockers</div>
            {memory.blockers.map((b, i) => (
              <div key={i} className="blocker-item">
                <div className="blocker-issue">{b.issue}</div>
                <div className="blocker-meta">
                  <span className={`blocker-status ${b.resolution === "Not yet resolved" ? "unresolved" : "resolved"}`}>
                    {b.resolution}
                  </span>
                  <span className="blocker-date">{b.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {memory.last_contact && (
          <MemoryField label="Last Contact" value={memory.last_contact} />
        )}

        {memory.notes && (
          <MemoryField label="Notes" value={memory.notes} />
        )}

        {memory.goal_achieved && (
          <div className="goal-achieved">
            🎉 Goal Achieved!
          </div>
        )}
      </div>
    </div>
  );
}
