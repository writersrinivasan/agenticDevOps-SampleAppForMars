"use client";
import { useEffect, useState } from "react";

export default function McpPanel() {
  const [data, setData] = useState({ servers: [], log: [], calls: 0 });
  const [sel, setSel] = useState(null);
  const [args, setArgs] = useState("{}");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => fetch("/api/mcp").then((r) => r.json()).then(setData).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  function pick(server, tool) {
    setSel({ server, tool });
    setArgs(JSON.stringify(tool.example, null, 2));
    setResult(null);
  }

  async function invoke() {
    setBusy(true);
    let parsed = {};
    try { parsed = JSON.parse(args || "{}"); } catch { parsed = {}; }
    const r = await fetch("/api/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool: sel.tool.name, args: parsed }) }).then((x) => x.json());
    setResult(r);
    setBusy(false);
    load();
  }

  return (
    <div className="panel-grid">
      <div className="card wide">
        <h2>🔌 MCP layer — Model Context Protocol <span className="count">{data.servers.length} servers · {data.servers.reduce((n, s) => n + s.tools.length, 0)} tools · {data.calls} calls</span></h2>
        <p className="lead">Agents never talk to backend systems directly. They act as <b>MCP hosts</b>: discover tools with <code>tools/list</code> and invoke them with <code>tools/call</code> over JSON-RPC 2.0. Swap a simulated server for a real one and no agent code changes.</p>
        <div className="mcp-flow">
          <div className="mf" style={{ "--c": "#ff6b6b" }}>🤖 Agent<small>MCP host</small></div><i>⇄</i>
          <div className="mf" style={{ "--c": "#cc5de8" }}>🧩 MCP client<small>session + capability negotiation</small></div><i>⇄</i>
          <div className="mf" style={{ "--c": "#22b8cf" }}>📜 JSON-RPC 2.0<small>stdio / streamable-http</small></div><i>⇄</i>
          <div className="mf" style={{ "--c": "#20c997" }}>🗄️ MCP servers<small>launch · habitat · payments…</small></div>
        </div>
        <div className="srv-grid">
          {data.servers.map((s) => (
            <div key={s.id} className="srv" style={{ "--c": s.color }}>
              <div className="srv-h"><span>{s.icon}</span><b>{s.name}</b><small>{s.transport}</small></div>
              {s.tools.map((t) => (
                <button key={t.name} className={`tool ${sel?.tool.name === t.name ? "on" : ""}`} onClick={() => pick(s, t)} title={t.description}>
                  <code>{t.name}</code><small>{t.description}</small>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>🧪 MCP Inspector</h2>
        {!sel && <div className="muted">Click any tool above to call it live.</div>}
        {sel && (
          <>
            <div className="sub-h">{sel.server.icon} {sel.server.name} › <code>{sel.tool.name}</code></div>
            <label>arguments (JSON)<textarea className="mono" rows={5} value={args} onChange={(e) => setArgs(e.target.value)} /></label>
            <button className="cta small" onClick={invoke} disabled={busy}>{busy ? "Calling…" : "▶ tools/call"}</button>
            {result && (
              <div className="rpc">
                <div><div className="sub-h">➡️ Request</div><pre>{JSON.stringify(result.request, null, 2)}</pre></div>
                <div><div className="sub-h">⬅️ Response · {result.ms} ms</div><pre>{JSON.stringify({ ...result.response, result: { ...result.response?.result, content: [{ type: "text", json: result.result }] } }, null, 2)}</pre></div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h2>📜 Live JSON-RPC traffic</h2>
        <div className="log">
          {!data.log.length && <div className="muted">No calls yet. Book a trip or run the DevOps pipeline.</div>}
          {data.log.map((c) => (
            <div key={c.id} className="log-line" style={{ "--c": c.color }}>
              <span className="ms">#{c.id}</span> {c.icon} <b>{c.serverName}</b> <code>{c.tool}</code> <em>← {c.caller}</em> <span className="ms">{c.ms}ms</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
