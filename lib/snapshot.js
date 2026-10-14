import { store } from "./store";
import { hasGroq, MODEL } from "./groq";
import { KB, VOCAB_SIZE } from "./rag";
import { MCP_SERVERS, MCP_TOOL_COUNT } from "./mcpRegistry";
import { BOOKING_AGENTS, DEVOPS_AGENTS, ALL_AGENTS } from "./agentsMeta";

// One JSON picture of the whole system — used by the header, the MCP tab and ARIA's visuals.
export function getSnapshot() {
  const byServer = Object.fromEntries(MCP_SERVERS.map((s) => [s.id, 0]));
  store.mcpLog.forEach((e) => (byServer[e.server] = (byServer[e.server] || 0) + 1));
  return {
    llm: { provider: "Groq", model: MODEL, connected: hasGroq(), calls: store.llmCalls, tokens: store.llmTokens, errors: store.llmErrors, lastError: store.lastLlmError },
    agents: { booking: BOOKING_AGENTS.length, devops: DEVOPS_AGENTS.length, assistant: 1, total: ALL_AGENTS.length, invocations: store.agentInvocations },
    bookings: { count: store.bookings.length, recent: store.bookings.slice(0, 5) },
    mcp: { servers: MCP_SERVERS.length, tools: MCP_TOOL_COUNT, calls: store.mcpSeq, byServer, recent: store.mcpLog.slice(0, 10) },
    rag: { chunks: KB.length, vocab: VOCAB_SIZE, queries: store.ragLog.length, recent: store.ragLog.slice(0, 6) },
    lastBooking: store.lastBooking,
    lastDevops: store.lastDevops,
    uptimeSec: Math.round((Date.now() - store.startedAt) / 1000),
  };
}
