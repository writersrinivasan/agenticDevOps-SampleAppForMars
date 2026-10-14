// Shared (client + server) catalogue of every agent in the system.

export const BOOKING_AGENTS = [
  { id: "orchestrator", name: "Mission Control", role: "Orchestrator: plans the DAG and routes work", emoji: "🛰️", color: "#ff6b6b", layers: ["LLM"] },
  { id: "intent", name: "Intent Agent", role: "Understands the traveler's request", emoji: "🧠", color: "#f06595", layers: ["LLM"] },
  { id: "knowledge", name: "Knowledge Agent", role: "Retrieves travel policies", emoji: "📚", color: "#cc5de8", layers: ["RAG", "LLM"] },
  { id: "launch", name: "Launch Window Agent", role: "Finds Earth→Mars launch windows", emoji: "🚀", color: "#845ef7", layers: ["MCP", "LLM"] },
  { id: "habitat", name: "Habitat Agent", role: "Books a Martian habitat", emoji: "🏕️", color: "#5c7cfa", layers: ["MCP", "LLM"] },
  { id: "medical", name: "Medical Agent", role: "Checks fitness & radiation rules", emoji: "🩺", color: "#339af0", layers: ["MCP", "RAG", "LLM"] },
  { id: "weather", name: "Weather Risk Agent", role: "Checks the dust-storm forecast", emoji: "🌪️", color: "#22b8cf", layers: ["MCP", "LLM"] },
  { id: "pricing", name: "Pricing Agent", role: "Builds the quote", emoji: "💰", color: "#20c997", layers: ["MCP", "LLM"] },
  { id: "payment", name: "Payment Agent", role: "Charges in MarsCredits", emoji: "💳", color: "#51cf66", layers: ["MCP", "LLM"] },
  { id: "itinerary", name: "Itinerary Agent", role: "Writes the day-by-day plan", emoji: "🗺️", color: "#fcc419", layers: ["LLM", "RAG"] },
  { id: "notify", name: "Comms Agent", role: "Sends confirmation over deep-space relay", emoji: "📡", color: "#ff922b", layers: ["MCP"] },
];

// Execution DAG (the orchestrator wraps the whole run).
export const BOOKING_STAGES = [
  ["intent"],
  ["knowledge"],
  ["launch", "habitat", "medical", "weather"],
  ["pricing"],
  ["payment"],
  ["itinerary"],
  ["notify"],
];

export const DEVOPS_AGENTS = [
  { id: "review", name: "Code Review Agent", role: "Reviews the diff with an LLM", emoji: "🔍", color: "#f06595", layers: ["MCP", "LLM"] },
  { id: "test", name: "Test Agent", role: "Runs unit + agent eval suites", emoji: "🧪", color: "#cc5de8", layers: ["MCP"] },
  { id: "security", name: "Security Agent", role: "SAST, secrets & dependency scan", emoji: "🛡️", color: "#845ef7", layers: ["MCP", "RAG"] },
  { id: "build", name: "Build Agent", role: "Builds & signs the release bundle", emoji: "📦", color: "#5c7cfa", layers: ["MCP"] },
  { id: "deploy", name: "Deploy Agent", role: "Progressive canary rollout", emoji: "🚢", color: "#22b8cf", layers: ["MCP", "LLM"] },
  { id: "sre", name: "SRE Monitor Agent", role: "Watches SLOs during rollout", emoji: "📈", color: "#20c997", layers: ["MCP", "LLM"] },
  { id: "incident", name: "Self-Healing Agent", role: "Auto-remediates anomalies", emoji: "🚑", color: "#ff922b", layers: ["MCP", "RAG", "LLM"] },
];

export const DEVOPS_STAGES = [["review"], ["test", "security"], ["build"], ["deploy"], ["sre", "incident"]];

export const ASSISTANT_AGENT = { id: "aria", name: "ARIA Assistant", role: "Conversational guide over RAG + MCP + live telemetry", emoji: "🤖", color: "#ff8787", layers: ["RAG", "MCP", "LLM"] };

export const ALL_AGENTS = [...BOOKING_AGENTS, ...DEVOPS_AGENTS, ASSISTANT_AGENT];

export const LAYER_COLORS = { LLM: "#fcc419", RAG: "#cc5de8", MCP: "#22b8cf" };
