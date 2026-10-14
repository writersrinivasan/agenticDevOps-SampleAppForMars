import { chat, hasGroq } from "./groq";
import { callTool } from "./mcp";
import { retrieve } from "./rag";
import { store } from "./store";
import { ALL_AGENTS } from "./agentsMeta";
import { startRun, endRun, finishTrace, traceStep, tracingEnabled } from "./tracing";

const AGENT_META = Object.fromEntries(ALL_AGENTS.map((a) => [a.id, a]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PREFIX = { booking: "RH", devops: "CI", assistant: "AR" };
const TRACE_NAMES = { booking: "🚀 Mars Booking Orchestration", devops: "⚙️ Agentic DevOps Pipeline", assistant: "🤖 ARIA Assistant" };

// A tiny agent runtime: tracks agent lifecycle, and gives agents three capabilities —
// think (LLM via Groq), rag (retrieval) and mcp (tool calls). Every step is streamed as an event
// and traced to LangSmith as a tree: run → agent (chain) → llm / tool / retriever.
export function createRun(kind, emit, inputs = {}) {
  const trace = { runId: `${PREFIX[kind] || "RUN"}-${Date.now().toString(36).toUpperCase()}`, kind, startedAt: Date.now(), llm: hasGroq(), tracing: tracingEnabled(), agents: {}, events: [] };
  const root = startRun(null, { name: TRACE_NAMES[kind] || kind, run_type: "chain", inputs, tags: [kind, "multi-agent", "mars-demo"], metadata: { runId: trace.runId, llm_live: trace.llm } });
  const agentRun = (id) => trace.agents[id]?.ls || root;

  const record = (e) => {
    const ev = { ...e, ts: Date.now() };
    trace.events.push(ev);
    emit(ev);
  };

  const run = {
    trace,
    record,
    agentRun,
    start(id, stage) {
      const meta = AGENT_META[id] || {};
      trace.agents[id] = { status: "running", stage, t0: Date.now(), mcp: 0, rag: 0, llm: 0 };
      trace.agents[id].ls = startRun(root, { name: meta.name ? `${meta.emoji} ${meta.name}` : id, run_type: "chain", inputs: { stage }, tags: ["agent", ...(meta.layers || [])], metadata: { agent_id: id, role: meta.role } });
      store.agentInvocations++;
      record({ type: "agent_start", agent: id, stage });
    },
    end(id, summary, data) {
      const a = trace.agents[id];
      Object.assign(a, { status: "done", ms: Date.now() - a.t0, summary });
      endRun(a.ls, { summary, data });
      record({ type: "agent_end", agent: id, ms: a.ms, summary, data });
    },
    log(agent, level, text) {
      record({ type: "log", agent, level, text });
    },
    async mcp(agent, tool, args) {
      const entry = await callTool(tool, args, agent);
      if (trace.agents[agent]) trace.agents[agent].mcp++;
      traceStep(agentRun(agent), { name: `MCP ${entry.serverName}.${tool}`, run_type: "tool", inputs: args, tags: ["mcp", entry.server], metadata: { mcp_server: entry.server, jsonrpc_id: entry.id, latency_ms: entry.ms } }, entry.result);
      record({ type: "mcp", agent, entry });
      return entry.result;
    },
    rag(agent, query, k = 3) {
      const r = retrieve(query, k, agent);
      if (trace.agents[agent]) trace.agents[agent].rag++;
      traceStep(agentRun(agent), { name: "RAG tfidf-retriever", run_type: "retriever", inputs: { query, k }, tags: ["rag"], metadata: { chunks: r.chunks, latency_ms: r.ms } },
        { documents: r.hits.map((h) => ({ page_content: h.text, type: "Document", metadata: { id: h.id, title: h.title, category: h.category, score: h.score } })) });
      record({ type: "rag", agent, query, tokens: r.tokens, ms: r.ms, chunks: r.chunks, hits: r.hits.map(({ id, title, category, score, text }) => ({ id, title, category, score, text })) });
      return r;
    },
    async think(agent, persona, task, context, fallback, opts = {}) {
      const r = await chat(
        [
          { role: "system", content: `You are ${persona.name}, an AI agent in a multi-agent system for Red Horizon Interplanetary (Mars travel). Your job: ${persona.role}. ${opts.system || "Reply with ONE vivid sentence (max 28 words) stating your reasoning and decision. No preamble."}` },
          { role: "user", content: `Task: ${task}\nContext: ${JSON.stringify(context).slice(0, 2500)}` },
        ],
        { max_tokens: opts.max_tokens || 90, temperature: 0.7, json: opts.json, fallback, parentRun: agentRun(agent), traceName: `${persona.name} · think` }
      );
      if (!r.live) await sleep(300 + Math.random() * 450); // keep the animation readable in offline mode
      if (r.live && trace.agents[agent]) trace.agents[agent].llm++;
      if (!opts.silent) record({ type: "thought", agent, text: r.text, live: r.live, ms: r.ms });
      return r;
    },
    finish() {
      trace.ms = Date.now() - trace.startedAt;
      // keep the trace light for the snapshot API
      const agents = Object.fromEntries(Object.entries(trace.agents).map(([k, { ls, ...v }]) => [k, v]));
      return { runId: trace.runId, kind, ms: trace.ms, llm: trace.llm, agents };
    },
    // Closes the LangSmith root run and emits a link to the trace.
    async closeTrace(outputs) {
      if (!trace.tracing) return null;
      await Promise.all(Object.values(trace.agents).map((a) => a.ls));
      await endRun(root, outputs);
      const url = await finishTrace(root);
      record({ type: "trace", url });
      return url;
    },
  };
  return run;
}
