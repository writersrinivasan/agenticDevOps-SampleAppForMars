"use client";
import { useCallback, useEffect, useState } from "react";
import BookingPanel from "./components/BookingPanel";
import RagPanel from "./components/RagPanel";
import McpPanel from "./components/McpPanel";
import DevOpsPanel from "./components/DevOpsPanel";
import Assistant from "./components/Assistant";
import { OverviewStats, Architecture, OrchestrationView } from "./components/Visuals";
import { AgentNode } from "./components/AgentGraph";
import { BOOKING_AGENTS, DEVOPS_AGENTS, ASSISTANT_AGENT } from "@/lib/agentsMeta";

const TABS = [
  { id: "book", label: "🚀 Book a Trip" },
  { id: "orch", label: "🧠 Orchestration" },
  { id: "rag", label: "📚 RAG Layer" },
  { id: "mcp", label: "🔌 MCP Layer" },
  { id: "devops", label: "⚙️ Agentic DevOps" },
  { id: "aria", label: "🤖 ARIA Assistant" },
];

function OrchestrationTab({ snap }) {
  if (!snap) return null;
  const groups = [
    { t: "🚀 Booking swarm", list: BOOKING_AGENTS },
    { t: "⚙️ DevOps crew", list: DEVOPS_AGENTS },
    { t: "💬 Assistant", list: [ASSISTANT_AGENT] },
  ];
  return (
    <div className="panel-grid">
      <div className="card wide"><h2>📊 Agent census</h2><OverviewStats snap={snap} /></div>
      <div className="card wide"><h2>🏗️ Architecture</h2><Architecture snap={snap} /></div>
      <div className="card wide"><h2>🧠 Live orchestration state</h2><OrchestrationView snap={snap} /></div>
      <div className="card wide">
        <h2>🧬 Every agent in the system <span className="count">{snap.agents.total} agents</span></h2>
        {groups.map((g) => (
          <div key={g.t}>
            <div className="sub-h">{g.t} · {g.list.length}</div>
            <div className="catalog">{g.list.map((a) => <AgentNode key={a.id} agent={a} st={null} />)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState("book");
  const [snap, setSnap] = useState(null);
  const [ask, setAsk] = useState(null);

  // deep links for the demo, e.g. /?tab=aria&ask=status
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (TABS.some((t) => t.id === p.get("tab"))) setTab(p.get("tab"));
    if (p.get("ask")) setAsk(p.get("ask"));
  }, []);

  const refresh = useCallback(() => fetch("/api/status").then((r) => r.json()).then(setSnap).catch(() => {}), []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <main>
      <div className="stars" /><div className="stars s2" />
      <div className="planet" />
      <header className="hero">
        <div>
          <div className="brand">🔴 RED HORIZON <span>INTERPLANETARY</span></div>
          <h1>Book your trip to <span className="grad">Mars</span> with an <span className="grad2">AI agent swarm</span></h1>
          <p>Multi-agent orchestration · RAG · MCP · Groq LLM · Agentic DevOps — all live in one Next.js app.</p>
        </div>
        <div className="hero-side">
          {snap && (
            <div className={`llm-badge ${snap.llm.connected ? "on" : "off"}`}>
              {snap.llm.connected ? `⚡ Groq live · ${snap.llm.model}` : "🌙 Offline simulation · add GROQ_API_KEY"}
            </div>
          )}
          {snap?.tracing.enabled && (
            <a className="llm-badge trace" href="https://smith.langchain.com/" target="_blank" rel="noreferrer">🔭 LangSmith tracing · {snap.tracing.project}</a>
          )}
          {snap && (
            <div className="kpis">
              <div><b>{snap.agents.total}</b><small>agents</small></div>
              <div><b>{snap.mcp.servers}</b><small>MCP servers</small></div>
              <div><b>{snap.rag.chunks}</b><small>RAG chunks</small></div>
              <div><b>{snap.bookings.count}</b><small>bookings</small></div>
            </div>
          )}
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </nav>

      {/* keep stateful panels mounted so a running stream isn't lost when switching tabs */}
      <div hidden={tab !== "book"}><BookingPanel onDone={refresh} /></div>
      {tab === "orch" && <OrchestrationTab snap={snap} />}
      <div hidden={tab !== "rag"}><RagPanel /></div>
      {tab === "mcp" && <McpPanel />}
      <div hidden={tab !== "devops"}><DevOpsPanel onDone={refresh} /></div>
      <div hidden={tab !== "aria"}><Assistant ask={ask} /></div>

      {tab !== "aria" && <button className="fab" onClick={() => setTab("aria")} title="Ask ARIA">🤖<span>Ask ARIA</span></button>}
      <footer>Demo build · everything runs in-process (no Docker, no database) · {snap ? `${snap.agents.invocations} agent invocations · ${snap.mcp.calls} MCP calls · ${snap.llm.calls} LLM calls` : ""}</footer>
    </main>
  );
}
