import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CUSTOMER_NAMES = {
  priya: "Priya Sharma",
  james: "James Okafor",
  lisa: "Lisa Tran",
  david: "David Chen"
};

const AVATARS = {
  priya: "PS",
  james: "JO",
  lisa: "LT",
  david: "DC"
};

const AVATAR_COLORS = {
  priya: "#7C6AF7",
  james: "#1D9E75",
  lisa: "#D85A30",
  david: "#378ADD"
};

export default function Chat({ messages, sendMessage, isLoading, customerId }) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const name = CUSTOMER_NAMES[customerId] || customerId;
  const initials = AVATARS[customerId] || "??";
  const color = AVATAR_COLORS[customerId] || "#888";

  return (
    <div className="chat">
      <div className="chat-header">
        <div className="chat-avatar" style={{ background: color }}>{initials}</div>
        <div>
          <div className="chat-customer-name">{name}</div>
          <div className="chat-status">
            <span className="status-dot" />
            Active session
          </div>
        </div>
      </div>

      <div className="messages">
        <AnimatePresence initial={false}>
          {messages.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="empty-state"
            >
              <div className="empty-icon">⚡</div>
              <p>Start a conversation with {name.split(" ")[0]}</p>
            </motion.div>
          )}

          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`bubble-row ${m.role}`}
            >
              {m.role === "bot" && (
                <div className="bot-avatar">AI</div>
              )}
              <div className={`bubble ${m.role}`}>
                {m.text}
              </div>
              {m.role === "user" && (
                <div className="user-avatar" style={{ background: color }}>{initials}</div>
              )}
            </motion.div>
          ))}

          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bubble-row bot"
            >
              <div className="bot-avatar">AI</div>
              <div className="bubble bot loading-bubble">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={`Message ${name.split(" ")[0]}...`}
          disabled={isLoading}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
