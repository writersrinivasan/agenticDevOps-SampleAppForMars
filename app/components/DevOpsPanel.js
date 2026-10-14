"use client";
import { useEffect, useRef, useState } from "react";
import AgentGraph from "./AgentGraph";
import { streamEvents, reduceAgents } from "./util";
import { DEVOPS_AGENTS, DEVOPS_STAGES } from "@/lib/agentsMeta";

const AG = Object.fromEntries(DEVOPS_AGENTS.map((a) => [a.id, a]));

export default function DevOpsPanel({ onDone }) {
  const [agents, setAgents] = useState({});
  const [lines, setLines] = useState([]);
  const [m, setM] = useState({ deploy: 0, p95: 0, errorRate: 0, tests: 0, vulns: 0, coverage: "—" });
  const [lat, setLat] = useState([]);
  const [running, setRunning] = useState(false);
  const [version, setVersion] = useState(null);
  const termRef = useRef(null);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  async function run() {
    setRunning(true);
    setAgents({});
    setLines([]);
    setLat([]);
    setM({ deploy: 0, p95: 0, errorRate: 0, tests: 0, vulns: 0, coverage: "—" });
    await streamEvents("/api/devops", {}, (e) => {
      setAgents((s) => reduceAgents(s, e));
      const a = AG[e.agent];
      if (e.type === "run_start") { setVersion(e.version); setLines((l) => [...l, { level: "sys", text: `$ agentic-pipeline run --release ${e.version}  (${e.agents} agents, LLM ${e.llm ? "Groq live" : "offline sim"})` }]); }
      if (e.type === "log") setLines((l) => [...l, { level: e.level, a, text: e.text }]);
      if (e.type === "thought") setLines((l) => [...l, { level: "think", a, text: `💭 ${e.text}` }]);
      if (e.type === "mcp") setLines((l) => [...l, { level: "mcp", a, text: `🔌 mcp ${e.entry.serverName}.${e.entry.tool}(${JSON.stringify(e.entry.request.params.arguments)}) · ${e.entry.ms}ms` }]);
      if (e.type === "rag") setLines((l) => [...l, { level: "rag", a, text: `📚 rag "${e.query}" → ${e.hits.map((h) => h.title).join(", ")}` }]);
      if (e.type === "metric") {
        setM((p) => ({ ...p, ...Object.fromEntries(Object.entries(e).filter(([k]) => !["type", "ts"].includes(k))) }));
        if (e.p95) setLat((l) => [...l, e.p95]);
      }
      if (e.type === "done") setLines((l) => [...l, { level: "ok", text: `🎉 ${e.version} released in ${(e.ms / 1000).toFixed(1)}s${e.healed ? " — 1 incident auto-healed, zero human pages" : ""}` }]);
    });
    setRunning(false);
    onDone?.();
  }

  const done = Object.values(agents).filter((a) => a.status === "done").length;
  const tiles = [
    { k: "Canary traffic", v: `${m.deploy}%`, c: "#22b8cf" },
    { k: "p95 latency", v: m.p95 ? `${m.p95} ms` : "—", c: m.p95 > 800 ? "#ff6b6b" : "#20c997" },
    { k: "Error rate", v: `${m.errorRate}%`, c: m.errorRate > 1 ? "#ff922b" : "#51cf66" },
    { k: "Tests passed", v: m.tests || "—", c: "#cc5de8" },
    { k: "Critical vulns", v: m.vulns, c: "#845ef7" },
    { k: "Coverage", v: m.coverage, c: "#fcc419" },
  ];

  return (
    <div className="panel-grid">
      <div className="card wide">
        <h2>⚙️ Agentic DevOps — self-driving CI/CD <span className="count">{DEVOPS_AGENTS.length} agents · {done} done</span></h2>
        <p className="lead">Each pipeline stage is owned by an AI agent acting through the <b>DevOps MCP server</b>. Runbooks live in the <b>RAG</b> index, so when the SRE agent spots an SLO breach mid-rollout, the Self-Healing agent retrieves the right runbook and fixes it — no human paged. Fully simulated: nothing to install.</p>
        <button className="cta" onClick={run} disabled={running}>{running ? `🤖 Pipeline running ${version || ""}…` : "▶ Ship a release with agents"}</button>
        <div className="tiles six">
          {tiles.map((t) => <div key={t.k} className="tile" style={{ "--c": t.c }}><b>{t.v}</b><small>{t.k}</small></div>)}
        </div>
        <AgentGraph agents={DEVOPS_AGENTS} stages={DEVOPS_STAGES} state={agents} />
      </div>
      <div className="card">
        <h2>🖥️ Pipeline terminal</h2>
        <div className="term" ref={termRef}>
          {!lines.length && <div className="muted">Waiting for a run…</div>}
          {lines.map((l, i) => (
            <div key={i} className={`tl ${l.level}`}>{l.a && <span style={{ color: l.a.color }}>[{l.a.emoji} {l.a.name}] </span>}{l.text}</div>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>📈 Latency during rollout</h2>
        <div className="spark">
          {lat.map((v, i) => <div key={i} className="sbar" style={{ height: `${Math.min(100, v / 10)}%`, "--c": v > 800 ? "#ff6b6b" : "#20c997" }}><span>{v}</span></div>)}
          <div className="slo">SLO 800 ms</div>
        </div>
        <div className="muted">Red bar = SLO breach detected by 📈 SRE agent → healed by 🚑 Self-Healing agent.</div>
      </div>
    </div>
  );
}
