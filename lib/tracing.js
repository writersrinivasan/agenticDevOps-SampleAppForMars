import { RunTree } from "langsmith/run_trees";
import { Client } from "langsmith/lib/client";

// LangSmith observability. Every helper is null-safe and swallows errors:
// tracing must never break or slow down the demo.

export const TRACE_PROJECT = process.env.LANGSMITH_PROJECT || "mars-agentic-travel";
export const tracingEnabled = () => Boolean(process.env.LANGSMITH_API_KEY) && process.env.LANGSMITH_TRACING !== "false";

let client;
const getClient = () =>
  (client ??= new Client({ apiKey: process.env.LANGSMITH_API_KEY, apiUrl: process.env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com" }));

// Starts a run under `parent` (a RunTree, a promise of one, or null for a new root trace).
export async function startRun(parent, { name, run_type = "chain", inputs = {}, tags, metadata }) {
  if (!tracingEnabled()) return null;
  try {
    const p = await parent;
    if (parent && !p) return null; // parent failed to start, so skip the child
    const run = p
      ? p.createChild({ name, run_type, inputs, tags, metadata })
      : new RunTree({ name, run_type, inputs, tags, metadata, project_name: TRACE_PROJECT, client: getClient() });
    await run.postRun();
    return run;
  } catch {
    return null;
  }
}

export async function endRun(runP, outputs = {}, error) {
  try {
    const run = await runP;
    if (!run) return;
    await run.end(outputs, error);
    await run.patchRun();
  } catch {}
}

// Flushes queued trace batches and returns a link to the trace in the LangSmith UI.
export async function finishTrace(runP) {
  try {
    const run = await runP;
    if (!run) return null;
    await getClient().awaitPendingTraceBatches();
    const p = await projectInfo();
    return p ? `${UI_URL}/o/${p.tenant_id}/projects/p/${p.id}/r/${run.id}?trace_id=${run.trace_id || run.id}` : null;
  } catch {
    return null;
  }
}

// The SDK's getRunUrl() reads the run back, which 404s until ingestion finishes,
// so build the link from the project's ids instead (looked up once, then cached).
const API_URL = () => process.env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com";
const UI_URL = (process.env.LANGSMITH_ENDPOINT || "").includes("eu.") ? "https://eu.smith.langchain.com" : "https://smith.langchain.com";
let project;
async function projectInfo() {
  if (project) return project;
  const res = await fetch(`${API_URL()}/api/v1/sessions?name=${encodeURIComponent(TRACE_PROJECT)}&limit=1`, { headers: { "x-api-key": process.env.LANGSMITH_API_KEY } });
  const [p] = res.ok ? await res.json() : [];
  if (p?.id && p?.tenant_id) project = { id: p.id, tenant_id: p.tenant_id };
  return project;
}

// Fire-and-forget helper for synchronous steps (e.g. RAG retrieval).
export function traceStep(parent, config, outputs) {
  if (!tracingEnabled()) return;
  startRun(parent, config).then((r) => endRun(r, outputs));
}
