import { store } from "./store";
import { serverForTool } from "./mcpRegistry";

// Simulated MCP servers. Each call is logged as a JSON-RPC 2.0 `tools/call` exchange,
// exactly the wire format a real MCP client/server pair would use.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (str) => [...String(str)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const CABINS = { "Economy Pod": 450000, "Explorer Suite": 1200000, "Olympus First": 3500000 };

const WINDOWS = [
  { window_id: "W-2026-12", launch: "2026-12-18", arrival: "2027-07-02", ship: "Ares Clipper I", transit_days: 196 },
  { window_id: "W-2029-01", launch: "2029-01-24", arrival: "2029-08-05", ship: "Olympus Express", transit_days: 193 },
  { window_id: "W-2031-03", launch: "2031-03-11", arrival: "2031-09-20", ship: "Crimson Voyager", transit_days: 193 },
];

const HABITATS = [
  { id: "jezero", name: "Jezero Dome Resort", region: "Jezero Crater", nightly: 9000, vibe: "river-delta views & rover tours" },
  { id: "olympus", name: "Olympus Mons Base Camp", region: "Tharsis", nightly: 12000, vibe: "summit treks on the tallest volcano" },
  { id: "valles", name: "Valles Marineris Canyon Lodge", region: "Valles Marineris", nightly: 15000, vibe: "cliffside suites in a 7 km deep canyon" },
  { id: "gale", name: "Gale Crater Science Habitat", region: "Gale Crater", nightly: 6000, vibe: "work alongside researchers" },
  { id: "phobos", name: "Phobos Orbital Hotel", region: "Phobos orbit", nightly: 20000, vibe: "Mars-rise every 7.6 hours" },
];

const handlers = {
  get_launch_windows: ({ after = "2026-10" }) => ({
    windows: WINDOWS.filter((w) => w.launch >= after).map((w) => ({ ...w, seats_left: 3 + (hash(w.window_id + after) % 40) })),
  }),
  reserve_seat: ({ window_id, cabin, travelers = 1 }) => {
    const deck = cabin === "Olympus First" ? "A" : cabin === "Explorer Suite" ? "B" : "C";
    return {
      hold_id: `HOLD-${(hash(window_id + cabin) % 99999).toString().padStart(5, "0")}`,
      window_id, cabin,
      seats: Array.from({ length: travelers }, (_, i) => `${deck}${12 + i}`),
      expires_in: "72h",
    };
  },
  search_habitats: ({ preference = "" }) => {
    const p = preference.toLowerCase();
    const ranked = [...HABITATS].sort((a, b) => (b.name.toLowerCase().includes(p) || b.id === p) - (a.name.toLowerCase().includes(p) || a.id === p));
    return { results: ranked.map((h) => ({ ...h, available: true })) };
  },
  book_habitat: ({ habitat_id, nights = 14, travelers = 1 }) => {
    const h = HABITATS.find((x) => x.id === habitat_id) || HABITATS[0];
    return { confirmation: `HAB-${hash(habitat_id + nights) % 100000}`, habitat: h.name, module: `M-${(hash(h.id) % 40) + 1}`, nights, travelers };
  },
  get_dust_forecast: ({ region = "Jezero Crater" }) => {
    const v = hash(region) % 100;
    const level = v > 80 ? "HIGH" : v > 45 ? "MODERATE" : "LOW";
    return { region, risk: level, opacity_tau: +(0.3 + (v / 100) * 2).toFixed(2), temp_c: -60 + (v % 30), advisory: level === "HIGH" ? "Reschedule EVA days" : "Clear skies for excursions" };
  },
  check_fitness: ({ age = 30, conditions = "none" }) => {
    const ok = age >= 18 && age <= 70;
    const waiver = /heart|cardiac/i.test(conditions);
    return { cleared: ok && !waiver, requires_waiver: waiver, radiation_budget_msv: 600, training_weeks: 6, notes: !ok ? "Age outside 18–70 range" : waiver ? "Cardiologist waiver required" : "Cleared for flight" };
  },
  quote_price: ({ cabin = "Explorer Suite", travelers = 1, nightly = 9000, nights = 14 }) => {
    const fare = (CABINS[cabin] || CABINS["Explorer Suite"]) * travelers;
    const habitat = nightly * nights * travelers;
    const insurance = Math.round(fare * 0.04);
    const taxes = Math.round((fare + habitat) * 0.02);
    const total = fare + habitat + insurance + taxes;
    return { currency: "MC", fare, habitat, insurance, taxes, total, deposit: Math.round(total * 0.1) };
  },
  charge_payment: ({ amount, payer }) => ({ status: "APPROVED", txn_id: `IPN-${hash(payer + amount).toString(16).toUpperCase()}`, amount, currency: "MC", network: "Interplanetary Payment Network" }),
  send_notification: ({ to, message }) => ({ delivered: true, relay: "DSN Goldstone → Mars Relay Orbiter", one_way_delay_min: 4 + (hash(to) % 20), to, preview: String(message).slice(0, 80) }),

  // DevOps control plane
  get_git_diff: () => ({ branch: "feat/phobos-daytrip-upsell", files_changed: 6, additions: 214, deletions: 37, files: ["lib/agents/pricing.js", "lib/agents/itinerary.js", "lib/rag/kb.json", "app/api/book/route.js", "tests/pricing.spec.js", "tests/evals/itinerary.eval.js"] }),
  run_test_suite: ({ suite = "all" }) => ({ suite, passed: 148, failed: 0, skipped: 2, agent_evals: { hallucination_rate: "0.8%", tool_call_accuracy: "98.6%" }, coverage: "91.4%" }),
  scan_vulnerabilities: () => ({ critical: 0, high: 0, medium: 2, low: 5, secrets_found: 0, sbom: "attached" }),
  build_release: ({ version = "v2.4.0" }) => ({ version, artifact: `mars-travel-${version}.tgz`, digest: `sha256:${hash(version).toString(16)}e9a1c0ffee`, signed: true, size_mb: 48.2 }),
  rollout_canary: ({ percent }) => ({ percent, healthy_replicas: Math.max(1, Math.round(percent / 10)), region: "earth-us-east + mars-jezero-edge" }),
  get_cluster_health: () => ({ p95_ms: 180 + (Date.now() % 90), error_rate: "0.2%", agents_online: 19, rag_index: "warm", mcp_servers_up: 7, uptime: "99.97%" }),
  auto_remediate: ({ action }) => ({ action, applied: true, workers_before: 4, workers_after: 8, cache: "RAG index pre-warmed" }),
};

export async function callTool(tool, args = {}, caller = "client") {
  const server = serverForTool(tool);
  if (!server || !handlers[tool]) throw new Error(`Unknown MCP tool: ${tool}`);
  const id = ++store.mcpSeq;
  const t0 = Date.now();
  await sleep(90 + (hash(tool + id) % 220)); // simulated network hop
  const result = handlers[tool](args);
  const entry = {
    id, caller, tool,
    server: server.id, serverName: server.name, icon: server.icon, color: server.color,
    ms: Date.now() - t0,
    ts: new Date().toISOString(),
    request: { jsonrpc: "2.0", id, method: "tools/call", params: { name: tool, arguments: args } },
    response: { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }], isError: false } },
    result,
  };
  store.mcpLog.unshift(entry);
  store.mcpLog.length = Math.min(store.mcpLog.length, 60);
  return entry;
}
