"use client";

export const fmt = (n) => Number(n || 0).toLocaleString("en-US");

// Reads an NDJSON stream from a POST endpoint and calls onEvent for every line.
export async function streamEvents(url, body, onEvent) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
}

// Folds a stream event into { agentId: {status, ms, summary, mcp, rag, llm} }.
export function reduceAgents(state, e) {
  const cur = state[e.agent] || { mcp: 0, rag: 0, llm: 0 };
  switch (e.type) {
    case "agent_start": return { ...state, [e.agent]: { ...cur, status: "running" } };
    case "agent_end": return { ...state, [e.agent]: { ...cur, status: "done", ms: e.ms, summary: e.summary } };
    case "mcp": return { ...state, [e.agent]: { ...cur, mcp: cur.mcp + 1 } };
    case "rag": return { ...state, [e.agent]: { ...cur, rag: cur.rag + 1 } };
    case "thought": return e.live ? { ...state, [e.agent]: { ...cur, llm: cur.llm + 1 } } : state;
    default: return state;
  }
}

// Minimal markdown: **bold**, _italic_, `code`, bullet lines.
function inline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (/^\*\*.*\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^_.*_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    if (/^`.*`$/.test(p)) return <code key={i}>{p.slice(1, -1)}</code>;
    return p;
  });
}

export function Markdown({ text }) {
  const lines = String(text || "").split("\n");
  return (
    <div className="md">
      {lines.map((l, i) => {
        const t = l.trim();
        if (!t) return <div key={i} className="md-gap" />;
        if (/^[-*•]\s+/.test(t)) return <div key={i} className="md-li">{inline(t.replace(/^[-*•]\s+/, ""))}</div>;
        if (/^#{1,4}\s+/.test(t)) return <div key={i} className="md-h">{inline(t.replace(/^#+\s+/, ""))}</div>;
        return <p key={i}>{inline(t)}</p>;
      })}
    </div>
  );
}
