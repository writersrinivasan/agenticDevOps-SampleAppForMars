import { chat } from "@/lib/groq";
import { contextBlock } from "@/lib/rag";
import { createRun } from "@/lib/runtime";
import { getSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

const ALL_VISUALS = ["overview", "architecture", "orchestration", "mcp", "rag", "devops"];

function detectVisuals(q) {
  if (/status|overview|dashboard|health|everything|show (me )?all|how (is|are) (it|things|the system)|progress/.test(q)) return ALL_VISUALS;
  const v = new Set();
  if (/agent|orchestrat|how many|workflow|dag/.test(q)) v.add("overview").add("orchestration");
  if (/mcp|tool|server|protocol|json-?rpc/.test(q)) v.add("mcp");
  if (/rag|retriev|knowledge|vector|embedding|context|tf-?idf/.test(q)) v.add("rag");
  if (/devops|pipeline|deploy|ci\/?cd|release|canary|incident/.test(q)) v.add("devops");
  if (/architect|layer|how does .* work|stack/.test(q)) v.add("architecture");
  if (/booking|trip|ticket|reservation/.test(q)) v.add("bookings");
  return [...v];
}

export async function POST(req) {
  const { messages = [] } = await req.json().catch(() => ({}));
  const question = messages.filter((m) => m.role === "user").at(-1)?.content || "status";
  const q = question.toLowerCase();
  const run = createRun("assistant", () => {}, { question, history: messages.length });
  run.start("aria", 0);

  const steps = [];
  const visuals = detectVisuals(q);
  steps.push({ layer: "Router", label: "Intent routing", detail: visuals.length ? `visuals → ${visuals.join(", ")}` : "conversational answer" });

  // RAG
  const rag = run.rag("aria", question, 3);
  steps.push({ layer: "RAG", label: "Retrieved context", detail: `${rag.hits.length} chunks in ${rag.ms} ms · top "${rag.hits[0]?.title || "—"}"` });

  // MCP tool calls chosen by simple tool-routing rules
  const toolPlan = [];
  if (/launch|window|when can|depart|ship/.test(q)) toolPlan.push(["get_launch_windows", { after: "2026-10" }]);
  if (/weather|dust|storm/.test(q)) toolPlan.push(["get_dust_forecast", { region: "Jezero Crater" }]);
  if (visuals.includes("devops") || visuals === ALL_VISUALS || /health|uptime|latency/.test(q)) toolPlan.push(["get_cluster_health", {}]);
  const mcpCalls = await Promise.all(
    toolPlan.map(async ([t, a]) => {
      await run.mcp("aria", t, a);
      return run.trace.events.findLast((e) => e.type === "mcp" && e.entry.tool === t).entry;
    })
  );
  steps.push({ layer: "MCP", label: "Tool calls", detail: mcpCalls.length ? mcpCalls.map((c) => `${c.serverName}.${c.tool}`).join(", ") : "none needed" });

  const snapshot = getSnapshot();
  const compact = {
    agents: snapshot.agents,
    bookings: snapshot.bookings.count,
    lastBooking: snapshot.lastBooking && { runId: snapshot.lastBooking.runId, ms: snapshot.lastBooking.ms, agentsRun: Object.keys(snapshot.lastBooking.agents).length },
    lastDevops: snapshot.lastDevops && { version: snapshot.lastDevops.version, healed: snapshot.lastDevops.healed },
    mcp: { servers: snapshot.mcp.servers, tools: snapshot.mcp.tools, calls: snapshot.mcp.calls },
    rag: { chunks: snapshot.rag.chunks, queries: snapshot.rag.queries },
    llm: { model: snapshot.llm.model, calls: snapshot.llm.calls },
  };

  const fallback = [
    `**System status** — ${compact.agents.total} agents registered (${compact.agents.booking} booking, ${compact.agents.devops} DevOps, 1 assistant), ${compact.agents.invocations} agent invocations so far.`,
    `- 🔌 MCP: ${compact.mcp.servers} servers exposing ${compact.mcp.tools} tools, ${compact.mcp.calls} tool calls served`,
    `- 📚 RAG: ${compact.rag.chunks} knowledge chunks indexed, ${compact.rag.queries} retrievals`,
    `- 🎫 Bookings confirmed: ${compact.bookings}${compact.lastBooking ? ` (last run ${compact.lastBooking.runId} took ${(compact.lastBooking.ms / 1000).toFixed(1)}s)` : ""}`,
    `- ⚙️ DevOps: ${compact.lastDevops ? `${compact.lastDevops.version} deployed${compact.lastDevops.healed ? " with one auto-healed incident" : ""}` : "no pipeline run yet"}`,
    rag.hits[0] ? `\nFrom the knowledge base: _${rag.hits[0].text}_` : "",
    `\n_(Offline mode — add GROQ_API_KEY to .env.local for live LLM answers.)_`,
  ].join("\n");

  const llm = await chat(
    [
      { role: "system", content: `You are ARIA, the cheerful AI assistant of Red Horizon Interplanetary, a Mars travel booking platform built as an agentic AI demo (Next.js + multi-agent orchestration + RAG + MCP + Groq LLM + agentic DevOps). Answer in under 140 words using short markdown bullets and emojis. Ground answers in the RETRIEVED CONTEXT, MCP TOOL RESULTS and LIVE SYSTEM SNAPSHOT; never invent numbers. If visuals are being shown (${visuals.join(", ") || "none"}), briefly refer to them ("see the panels below").` },
      ...messages.slice(-6, -1).map((m) => ({ role: m.role, content: String(m.content).slice(0, 800) })),
      { role: "user", content: `${question}\n\nRETRIEVED CONTEXT:\n${contextBlock(rag.hits)}\n\nMCP TOOL RESULTS:\n${JSON.stringify(mcpCalls.map((c) => ({ tool: c.tool, result: c.result })))}\n\nLIVE SYSTEM SNAPSHOT:\n${JSON.stringify(compact)}` },
    ],
    { max_tokens: 380, temperature: 0.5, fallback, parentRun: run.agentRun("aria"), traceName: "🤖 ARIA · answer" }
  );
  steps.push({ layer: "LLM", label: llm.live ? `Groq ${snapshot.llm.model}` : "Offline template", detail: llm.live ? `${llm.ms} ms` : llm.error ? `fallback (${llm.error.slice(0, 60)})` : "no API key yet" });

  run.end("aria", llm.live ? "answered (live)" : "answered (offline)", { visuals });
  const traceUrl = await run.closeTrace({ reply: llm.text, visuals });
  if (traceUrl) steps.push({ layer: "Trace", label: "LangSmith", detail: "full trace recorded" });

  return Response.json({
    reply: llm.text,
    traceUrl,
    live: llm.live,
    visuals,
    steps,
    rag: { query: question, tokens: rag.tokens, hits: rag.hits, ms: rag.ms, chunks: rag.chunks, allScores: rag.allScores },
    mcpCalls,
    snapshot: getSnapshot(),
  });
}
