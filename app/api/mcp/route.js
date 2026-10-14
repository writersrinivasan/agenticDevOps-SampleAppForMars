import { callTool } from "@/lib/mcp";
import { MCP_SERVERS } from "@/lib/mcpRegistry";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

// GET = MCP `tools/list` across all servers + the live call log
export async function GET() {
  return Response.json({ servers: MCP_SERVERS, log: store.mcpLog.slice(0, 25), calls: store.mcpSeq });
}

// POST = MCP `tools/call`
export async function POST(req) {
  const { tool, args = {} } = await req.json().catch(() => ({}));
  try {
    return Response.json(await callTool(tool, args, "mcp-inspector"));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
