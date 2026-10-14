import { chat, hasGroq } from "./groq";
import { callTool } from "./mcp";
import { retrieve } from "./rag";
import { store } from "./store";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A tiny agent runtime: tracks agent lifecycle, and gives agents three capabilities —
// think (LLM via Groq), rag (retrieval) and mcp (tool calls). Every step is streamed as an event.
export function createRun(kind, emit) {
  const trace = { runId: `${kind === "booking" ? "RH" : "CI"}-${Date.now().toString(36).toUpperCase()}`, kind, startedAt: Date.now(), llm: hasGroq(), agents: {}, events: [] };

  const record = (e) => {
    const ev = { ...e, ts: Date.now() };
    trace.events.push(ev);
    emit(ev);
  };

  const run = {
    trace,
    record,
    start(id, stage) {
      trace.agents[id] = { status: "running", stage, t0: Date.now(), mcp: 0, rag: 0, llm: 0 };
      store.agentInvocations++;
      record({ type: "agent_start", agent: id, stage });
    },
    end(id, summary, data) {
      const a = trace.agents[id];
      Object.assign(a, { status: "done", ms: Date.now() - a.t0, summary });
      record({ type: "agent_end", agent: id, ms: a.ms, summary, data });
    },
    log(agent, level, text) {
      record({ type: "log", agent, level, text });
    },
    async mcp(agent, tool, args) {
      const entry = await callTool(tool, args, agent);
      if (trace.agents[agent]) trace.agents[agent].mcp++;
      record({ type: "mcp", agent, entry });
      return entry.result;
    },
    rag(agent, query, k = 3) {
      const r = retrieve(query, k, agent);
      if (trace.agents[agent]) trace.agents[agent].rag++;
      record({ type: "rag", agent, query, tokens: r.tokens, ms: r.ms, chunks: r.chunks, hits: r.hits.map(({ id, title, category, score, text }) => ({ id, title, category, score, text })) });
      return r;
    },
    async think(agent, persona, task, context, fallback, opts = {}) {
      const r = await chat(
        [
          { role: "system", content: `You are ${persona.name}, an AI agent in a multi-agent system for Red Horizon Interplanetary (Mars travel). Your job: ${persona.role}. ${opts.system || "Reply with ONE vivid sentence (max 28 words) stating your reasoning and decision. No preamble."}` },
          { role: "user", content: `Task: ${task}\nContext: ${JSON.stringify(context).slice(0, 2500)}` },
        ],
        { max_tokens: opts.max_tokens || 90, temperature: 0.7, json: opts.json, fallback }
      );
      if (!r.live) await sleep(300 + Math.random() * 450); // keep the animation readable in offline mode
      if (r.live && trace.agents[agent]) trace.agents[agent].llm++;
      if (!opts.silent) record({ type: "thought", agent, text: r.text, live: r.live, ms: r.ms });
      return r;
    },
    finish() {
      trace.ms = Date.now() - trace.startedAt;
      // keep the trace light for the snapshot API
      return { runId: trace.runId, kind, ms: trace.ms, llm: trace.llm, agents: trace.agents };
    },
  };
  return run;
}
