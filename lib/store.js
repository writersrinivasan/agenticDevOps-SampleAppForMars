// In-memory telemetry store (survives hot reloads via globalThis). No database needed.
const g = globalThis;
if (!g.__marsStore) {
  g.__marsStore = {
    startedAt: Date.now(),
    bookings: [],
    mcpLog: [],
    mcpSeq: 0,
    ragLog: [],
    llmCalls: 0,
    llmTokens: 0,
    llmErrors: 0,
    lastLlmError: null,
    agentInvocations: 0,
    lastBooking: null,
    lastDevops: null,
    devopsRuns: 0,
  };
}
export const store = g.__marsStore;
