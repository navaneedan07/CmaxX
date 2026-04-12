import React from "react";
import { motion } from "framer-motion";

const customers = [
  { id: "priya",           name: "Priya",  role: "Ops Manager", color: "#7C6AF7", initials: "PS" },
  { id: "james",           name: "James",  role: "Founder",     color: "#1D9E75", initials: "JO" },
  { id: "lisa",            name: "Lisa",   role: "Enterprise",  color: "#D85A30", initials: "LT" },
  { id: "david",           name: "David",  role: "Developer",   color: "#378ADD", initials: "DC" },
  { id: "customer-sarah",  name: "Sarah",  role: "Team Lead",   color: "#E8A020", initials: "SM" },
  { id: "customer-raj",    name: "Raj",    role: "CTO",         color: "#E24B4A", initials: "RP" },
];

export default function CustomerCarousel({ currentId, setCustomerId }) {
  return (
    <div className="carousel">
      {customers.map((c) => (
        <motion.button
          key={c.id}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className={`customer-card ${currentId === c.id ? "active" : ""}`}
          style={currentId === c.id ? { borderColor: c.color, background: `${c.color}15` } : {}}
          onClick={() => setCustomerId(c.id)}
        >
          <div className="customer-avatar" style={{ background: c.color }}>{c.initials}</div>
          <div className="customer-info">
            <span className="customer-name">{c.name}</span>
            <span className="customer-role">{c.role}</span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
