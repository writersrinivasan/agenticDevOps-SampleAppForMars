"use client";
import AgentGraph from "./AgentGraph";
import { fmt } from "./util";
import { BOOKING_AGENTS, BOOKING_STAGES, DEVOPS_AGENTS, DEVOPS_STAGES, ASSISTANT_AGENT, LAYER_COLORS } from "@/lib/agentsMeta";
import { MCP_SERVERS } from "@/lib/mcpRegistry";

const HUB = BOOKING_AGENTS[0];

export function OverviewStats({ snap }) {
  const tiles = [
    { k: "Total agents", v: snap.agents.total, e: "🤖", c: "#ff6b6b" },
    { k: "Booking agents", v: snap.agents.booking, e: "🚀", c: "#f06595" },
    { k: "DevOps agents", v: snap.agents.devops, e: "⚙️", c: "#cc5de8" },
    { k: "Assistant", v: snap.agents.assistant, e: "💬", c: "#845ef7" },
    { k: "Agent runs", v: snap.agents.invocations, e: "⚡", c: "#5c7cfa" },
    { k: "MCP tool calls", v: snap.mcp.calls, e: "🔌", c: "#22b8cf" },
    { k: "RAG retrievals", v: snap.rag.queries, e: "📚", c: "#20c997" },
    { k: "LLM calls", v: snap.llm.calls, e: "🧠", c: "#fcc419" },
    { k: "Bookings", v: snap.bookings.count, e: "🎫", c: "#ff922b" },
  ];
  return (
    <div className="tiles">
      {tiles.map((t) => (
        <div key={t.k} className="tile" style={{ "--c": t.c }}>
          <span className="tile-e">{t.e}</span>
          <b>{fmt(t.v)}</b>
          <small>{t.k}</small>
        </div>
      ))}
    </div>
  );
}

export function Architecture({ snap }) {
  return (
    <div className="arch">
      <div className="arch-row"><div className="arch-box ui">🖥️ Next.js UI · Booking · DevOps · ARIA chat</div></div>
      <div className="arch-arrow" />
      <div className="arch-row two">
        <div className="arch-box orch">🛰️ Mission Control Orchestrator <small>plans DAG · fan-out / fan-in</small></div>
        <div className="arch-box orch alt">🤖 ARIA Assistant <small>router → RAG → MCP → LLM</small></div>
      </div>
      <div className="arch-arrow" />
      <div className="arch-row">
        <div className="arch-box agents">
          <div className="arch-title">{snap?.agents.total ?? 19} specialist agents</div>
          <div className="chips">
            {[...BOOKING_AGENTS.slice(1), ...DEVOPS_AGENTS].map((a) => (
              <span key={a.id} className="chip" style={{ "--c": a.color }}>{a.emoji} {a.name}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="arch-arrow" />
      <div className="arch-row three">
        <div className="arch-box layer" style={{ "--c": LAYER_COLORS.RAG }}>📚 <b>RAG layer</b><small>TF-IDF vectors · cosine top-k · {snap?.rag.chunks ?? 15} chunks</small></div>
        <div className="arch-box layer" style={{ "--c": LAYER_COLORS.MCP }}>🔌 <b>MCP layer</b><small>JSON-RPC 2.0 · {snap?.mcp.servers ?? 7} servers · {snap?.mcp.tools ?? 15} tools</small></div>
        <div className="arch-box layer" style={{ "--c": LAYER_COLORS.LLM }}>🧠 <b>LLM layer</b><small>Groq · {snap?.llm.model}{snap?.llm.connected ? " · live" : " · offline sim"}</small></div>
      </div>
    </div>
  );
}

export function OrchestrationView({ snap, showDevops = true }) {
  const b = snap.lastBooking?.agents || {};
  const d = snap.lastDevops?.agents || {};
  return (
    <div className="stack">
      <div className="sub-h">🚀 Booking orchestration {snap.lastBooking ? <em>· last run {snap.lastBooking.runId} in {(snap.lastBooking.ms / 1000).toFixed(1)}s</em> : <em>· no run yet — book a trip!</em>}</div>
      <AgentGraph agents={BOOKING_AGENTS} stages={BOOKING_STAGES} state={b} hub={HUB} small />
      {showDevops && (
        <>
          <div className="sub-h">⚙️ DevOps pipeline {snap.lastDevops ? <em>· {snap.lastDevops.version}{snap.lastDevops.healed ? " · 1 incident auto-healed" : ""}</em> : <em>· not run yet</em>}</div>
          <AgentGraph agents={DEVOPS_AGENTS} stages={DEVOPS_STAGES} state={d} small />
        </>
      )}
    </div>
  );
}

export function McpMap({ snap, calls }) {
  const max = Math.max(1, ...Object.values(snap.mcp.byServer));
  const recent = calls?.length ? calls : snap.mcp.recent;
  return (
    <div className="mcpmap">
      <div className="mcp-hub">🔌 MCP Client<small>{snap.mcp.servers} servers · {snap.mcp.tools} tools · {fmt(snap.mcp.calls)} calls</small></div>
      <div className="mcp-servers">
        {MCP_SERVERS.map((s) => (
          <div key={s.id} className="mcp-srv" style={{ "--c": s.color }}>
            <div><span>{s.icon}</span> <b>{s.name}</b></div>
            <small>{s.tools.length} tools · {s.transport}</small>
            <div className="bar"><i style={{ width: `${(snap.mcp.byServer[s.id] / max) * 100}%` }} /></div>
            <small>{snap.mcp.byServer[s.id]} calls</small>
          </div>
        ))}
      </div>
      {recent?.length > 0 && (
        <div className="mcp-recent">
          {recent.slice(0, 5).map((c) => (
            <div key={c.id + c.ts} className="mcp-line" style={{ "--c": c.color }}>
              <span>#{c.id}</span> <b>{c.icon} {c.serverName}</b>.<code>{c.tool}</code> <em>← {c.caller}</em> <span className="ms">{c.ms} ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RagView({ rag, snap }) {
  if (!rag) {
    return (
      <div className="ragview">
        <div className="sub-h">📚 {snap.rag.chunks} chunks · {snap.rag.vocab} vocabulary terms · {snap.rag.queries} retrievals</div>
        {snap.rag.recent.map((r, i) => (
          <div key={i} className="rag-line"><code>{r.caller}</code> “{r.query.slice(0, 60)}” → <b>{r.top}</b> <span className="ms">{r.score}</span></div>
        ))}
      </div>
    );
  }
  return (
    <div className="ragview">
      <div className="rag-steps">
        <span>❓ Query</span><i>→</i><span>✂️ {rag.tokens.length} tokens</span><i>→</i><span>📐 TF-IDF vector</span><i>→</i><span>🧮 cosine × {rag.chunks}</span><i>→</i><span>🏆 top-{rag.hits.length}</span><i>→</i><span>🧠 LLM prompt</span>
      </div>
      <div className="tokens">{rag.tokens.map((t, i) => <span key={i}>{t}</span>)}</div>
      {rag.hits.map((h) => (
        <div key={h.id} className="hit">
          <div className="hit-h"><b>{h.title}</b> <small>{h.category}</small><span className="ms">{h.score.toFixed(3)}</span></div>
          <div className="bar"><i style={{ width: `${Math.min(100, (h.score / (rag.hits[0]?.score || 1)) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function DevopsMini({ snap }) {
  return (
    <div className="stack">
      <div className="sub-h">⚙️ Agentic DevOps {snap.lastDevops ? <em>· {snap.lastDevops.version} live in {(snap.lastDevops.ms / 1000).toFixed(1)}s</em> : <em>· run the pipeline in the DevOps tab</em>}</div>
      <AgentGraph agents={DEVOPS_AGENTS} stages={DEVOPS_STAGES} state={snap.lastDevops?.agents || {}} small />
    </div>
  );
}

export function BookingsList({ snap }) {
  if (!snap.bookings.recent.length) return <div className="muted">No bookings yet — head to the 🚀 Book tab.</div>;
  return (
    <div className="stack">
      {snap.bookings.recent.map((b) => (
        <div key={b.id} className="mini-ticket">
          <b>{b.id}</b> · {b.name} · {b.ship} · {b.launch} → {b.habitat} · <span className="gold">{fmt(b.price.total)} MC</span>
        </div>
      ))}
    </div>
  );
}

export function AssistantAgentCard() {
  return (
    <div className="mini-ticket" style={{ "--c": ASSISTANT_AGENT.color }}>
      {ASSISTANT_AGENT.emoji} <b>{ASSISTANT_AGENT.name}</b> — {ASSISTANT_AGENT.role}
    </div>
  );
}

const TITLES = {
  overview: "📊 Agent census",
  architecture: "🏗️ How the layers fit together",
  orchestration: "🧠 AI orchestration",
  mcp: "🔌 MCP layer",
  rag: "📚 RAG layer",
  devops: "⚙️ Agentic DevOps",
  bookings: "🎫 Recent bookings",
};

export default function Visuals({ list, snap, rag, mcpCalls }) {
  if (!snap || !list?.length) return null;
  return (
    <div className="visuals">
      {list.map((v) => (
        <section key={v} className="vis-card">
          <div className="vis-title">{TITLES[v]}</div>
          {v === "overview" && <OverviewStats snap={snap} />}
          {v === "architecture" && <Architecture snap={snap} />}
          {v === "orchestration" && <OrchestrationView snap={snap} showDevops={false} />}
          {v === "mcp" && <McpMap snap={snap} calls={mcpCalls} />}
          {v === "rag" && <RagView rag={rag} snap={snap} />}
          {v === "devops" && <DevopsMini snap={snap} />}
          {v === "bookings" && <BookingsList snap={snap} />}
        </section>
      ))}
    </div>
  );
}
