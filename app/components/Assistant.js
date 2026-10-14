"use client";
import { useEffect, useRef, useState } from "react";
import Visuals from "./Visuals";
import { Markdown } from "./util";
import { LAYER_COLORS } from "@/lib/agentsMeta";

const SUGGESTIONS = ["What's the status?", "How many agents were created?", "Show me the MCP layer", "How does RAG work here?", "Show the DevOps pipeline", "When is the next launch window?", "Is there a dust storm risk?"];
const STEP_COLORS = { Router: "#ff6b6b", ...LAYER_COLORS };

export default function Assistant({ ask }) {
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Hi, I'm **ARIA** 🤖 — your Red Horizon assistant. Ask me anything about Mars trips, or type **status** to see the whole AI orchestration, MCP and RAG layers live." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  useEffect(() => {
    if (ask) send(ask);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  async function send(text = input) {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }) }).then((x) => x.json());
      setMsgs([...next, { role: "assistant", content: r.reply, extra: r }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: `⚠️ ${e.message}` }]);
    }
    setBusy(false);
  }

  return (
    <div className="card wide chat">
      <h2>🤖 ARIA — AI assistant <span className="count">RAG + MCP + LLM</span></h2>
      <div className="msgs">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="avatar">{m.role === "user" ? "🧑‍🚀" : "🤖"}</div>
            <div className="bubble">
              {m.extra?.steps && (
                <div className="aria-steps">
                  {m.extra.steps.map((s, j) => (
                    <span key={j} className="astep" style={{ "--c": STEP_COLORS[s.layer] }} title={s.detail}>
                      <b>{s.layer}</b> {s.label}<small>{s.detail}</small>
                    </span>
                  ))}
                </div>
              )}
              <Markdown text={m.content} />
              {m.extra && <Visuals list={m.extra.visuals} snap={m.extra.snapshot} rag={m.extra.rag?.hits?.length ? m.extra.rag : null} mcpCalls={m.extra.mcpCalls} />}
            </div>
          </div>
        ))}
        {busy && <div className="msg assistant"><div className="avatar">🤖</div><div className="bubble typing"><span /><span /><span /></div></div>}
        <div ref={endRef} />
      </div>
      <div className="chips">{SUGGESTIONS.map((s) => <button key={s} className="chip btn" onClick={() => send(s)}>{s}</button>)}</div>
      <form className="searchbar" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder='Try "status" or "how many agents?"' />
        <button className="cta small" disabled={busy}>Send ✨</button>
      </form>
    </div>
  );
}
