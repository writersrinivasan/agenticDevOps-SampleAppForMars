// Shared (client + server) registry of MCP servers and the tools they expose.
// Each tool mirrors the MCP `tools/list` shape: name, description, inputSchema.

const s = (props) => ({ type: "object", properties: props });

export const MCP_SERVERS = [
  {
    id: "launch-ops", name: "Launch Ops", icon: "🚀", color: "#845ef7", transport: "stdio",
    tools: [
      { name: "get_launch_windows", description: "List Earth→Mars launch windows with seat availability", inputSchema: s({ after: { type: "string" } }), example: { after: "2026-11" } },
      { name: "reserve_seat", description: "Hold seats on a launch", inputSchema: s({ window_id: { type: "string" }, cabin: { type: "string" }, travelers: { type: "number" } }), example: { window_id: "W-2026-12", cabin: "Explorer Suite", travelers: 2 } },
    ],
  },
  {
    id: "habitat", name: "Habitat Booking", icon: "🏕️", color: "#5c7cfa", transport: "streamable-http",
    tools: [
      { name: "search_habitats", description: "Search Martian habitats by preference", inputSchema: s({ preference: { type: "string" }, nights: { type: "number" } }), example: { preference: "Jezero", nights: 14 } },
      { name: "book_habitat", description: "Reserve a habitat module", inputSchema: s({ habitat_id: { type: "string" }, nights: { type: "number" }, travelers: { type: "number" } }), example: { habitat_id: "jezero", nights: 14, travelers: 2 } },
    ],
  },
  {
    id: "mars-weather", name: "Mars Weather", icon: "🌪️", color: "#22b8cf", transport: "streamable-http",
    tools: [{ name: "get_dust_forecast", description: "Dust-storm risk forecast for a Martian region", inputSchema: s({ region: { type: "string" } }), example: { region: "Jezero Crater" } }],
  },
  {
    id: "med-bay", name: "Med-Bay", icon: "🩺", color: "#339af0", transport: "stdio",
    tools: [{ name: "check_fitness", description: "Screen a traveler against flight medical rules", inputSchema: s({ age: { type: "number" }, conditions: { type: "string" } }), example: { age: 34, conditions: "none" } }],
  },
  {
    id: "payments", name: "Interplanetary Payments", icon: "💳", color: "#51cf66", transport: "streamable-http",
    tools: [
      { name: "quote_price", description: "Compute fare, habitat, insurance & taxes", inputSchema: s({ cabin: { type: "string" }, travelers: { type: "number" }, nightly: { type: "number" }, nights: { type: "number" } }), example: { cabin: "Explorer Suite", travelers: 2, nightly: 9000, nights: 14 } },
      { name: "charge_payment", description: "Charge the 10% deposit in MarsCredits", inputSchema: s({ amount: { type: "number" }, payer: { type: "string" } }), example: { amount: 250000, payer: "Demo Traveler" } },
    ],
  },
  {
    id: "deep-space-comms", name: "Deep Space Comms", icon: "📡", color: "#ff922b", transport: "stdio",
    tools: [{ name: "send_notification", description: "Send a message over the Deep Space Relay", inputSchema: s({ to: { type: "string" }, message: { type: "string" } }), example: { to: "Demo Traveler", message: "T-minus 60 days!" } }],
  },
  {
    id: "devops", name: "DevOps Control Plane", icon: "⚙️", color: "#f06595", transport: "streamable-http",
    tools: [
      { name: "get_git_diff", description: "Fetch the pending change set", inputSchema: s({}), example: {} },
      { name: "run_test_suite", description: "Run unit + agent-eval tests", inputSchema: s({ suite: { type: "string" } }), example: { suite: "all" } },
      { name: "scan_vulnerabilities", description: "SAST + dependency + secret scan", inputSchema: s({}), example: {} },
      { name: "build_release", description: "Build and sign a release bundle", inputSchema: s({ version: { type: "string" } }), example: { version: "v2.4.0" } },
      { name: "rollout_canary", description: "Shift traffic to the new version", inputSchema: s({ percent: { type: "number" } }), example: { percent: 10 } },
      { name: "get_cluster_health", description: "Live SLO metrics for the Mars booking platform", inputSchema: s({}), example: {} },
      { name: "auto_remediate", description: "Apply a runbook action", inputSchema: s({ action: { type: "string" } }), example: { action: "scale_workers" } },
    ],
  },
];

export const MCP_TOOL_COUNT = MCP_SERVERS.reduce((n, sv) => n + sv.tools.length, 0);
export const serverForTool = (tool) => MCP_SERVERS.find((sv) => sv.tools.some((t) => t.name === tool));
