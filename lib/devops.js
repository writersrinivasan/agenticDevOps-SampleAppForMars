import { createRun } from "./runtime";
import { contextBlock } from "./rag";
import { store } from "./store";
import { DEVOPS_AGENTS } from "./agentsMeta";

const A = Object.fromEntries(DEVOPS_AGENTS.map((a) => [a.id, a]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Agentic CI/CD: every pipeline stage is owned by an agent that acts through the DevOps MCP server.
export async function runPipeline(emit) {
  const run = createRun("devops", emit);
  const version = `v2.${4 + store.devopsRuns}.0`;
  store.devopsRuns++;
  const metric = (m) => run.record({ type: "metric", ...m });
  run.record({ type: "run_start", runId: run.trace.runId, llm: run.trace.llm, agents: DEVOPS_AGENTS.length, version });

  // 1. Code review
  run.start("review", 0);
  const diff = await run.mcp("review", "get_git_diff", {});
  run.log("review", "info", `Reviewing ${diff.files_changed} files on ${diff.branch} (+${diff.additions} / -${diff.deletions})`);
  await run.think("review", A.review, "Review this change set and give a verdict.", diff,
    "LGTM — the Phobos day-trip upsell is isolated to the pricing agent, has tests and an itinerary eval; approving with one nit on rounding.");
  run.log("review", "ok", "✔ Approved by Code Review Agent");
  run.end("review", "Approved ✅", diff);

  // 2. Tests + Security in parallel
  await Promise.all([
    (async () => {
      run.start("test", 1);
      run.log("test", "info", "Running 150 unit tests + agent evals (hallucination, tool-call accuracy)…");
      const t = await run.mcp("test", "run_test_suite", { suite: "all" });
      run.log("test", "ok", `✔ ${t.passed} passed, ${t.failed} failed, coverage ${t.coverage}`);
      run.log("test", "ok", `✔ Agent evals: tool-call accuracy ${t.agent_evals.tool_call_accuracy}, hallucination ${t.agent_evals.hallucination_rate}`);
      metric({ tests: t.passed, coverage: t.coverage });
      run.end("test", `${t.passed}/${t.passed + t.failed} passed`, t);
    })(),
    (async () => {
      run.start("security", 1);
      const policy = run.rag("security", "security release blocked critical CVE secret", 1);
      run.log("security", "info", `Policy loaded via RAG: "${policy.hits[0]?.title}"`);
      const v = await run.mcp("security", "scan_vulnerabilities", {});
      run.log("security", v.critical ? "error" : "ok", `✔ critical ${v.critical} · high ${v.high} · medium ${v.medium} · secrets ${v.secrets_found}`);
      metric({ vulns: v.critical + v.high });
      run.end("security", "No blockers 🛡️", v);
    })(),
  ]);

  // 3. Build
  run.start("build", 2);
  run.log("build", "info", `Building release ${version} (no containers needed for the demo)…`);
  const b = await run.mcp("build", "build_release", { version });
  run.log("build", "ok", `✔ ${b.artifact} · ${b.digest.slice(0, 22)}… · signed`);
  run.end("build", `${version} signed 📦`, b);

  // 4. Deploy (canary) with SRE watching and self-healing
  run.start("deploy", 3);
  run.start("sre", 4);
  let healed = false;
  for (const pct of [10, 25, 50, 100]) {
    await run.mcp("deploy", "rollout_canary", { percent: pct });
    const spike = pct === 50 && !healed;
    const p95 = spike ? 920 : 160 + Math.round(Math.random() * 80);
    metric({ deploy: pct, p95, errorRate: spike ? 1.1 : 0.2 });
    run.log("deploy", "info", `→ Canary at ${pct}% traffic`);
    run.log("sre", spike ? "warn" : "ok", `p95 ${p95} ms · error rate ${spike ? "1.1" : "0.2"}%`);
    if (spike) {
      run.start("incident", 4);
      run.log("incident", "warn", "⚠ SLO breach: p95 > 800 ms — paging Self-Healing Agent");
      const rb = run.rag("incident", "high latency p95 canary rollout runbook", 1);
      run.log("incident", "info", `Runbook retrieved via RAG: "${rb.hits[0]?.title}"`);
      await run.think("incident", A.incident, "Decide a remediation from the runbook.", contextBlock(rb.hits),
        "Runbook says scale the agent-worker pool 2x and pre-warm the RAG cache — applying now instead of rolling back.");
      const fix = await run.mcp("incident", "auto_remediate", { action: "scale_workers" });
      await sleep(400);
      metric({ p95: 210, errorRate: 0.2 });
      run.log("incident", "ok", `✔ Workers ${fix.workers_before} → ${fix.workers_after}, ${fix.cache}. p95 back to 210 ms`);
      run.end("incident", "Auto-healed 🩹", fix);
      healed = true;
    }
    await sleep(250);
  }
  await run.think("deploy", A.deploy, "Summarize the rollout.", { version }, `${version} fully rolled out to Earth and Mars edge regions with zero downtime.`);
  run.end("deploy", `${version} at 100% 🚢`, {});

  const h = await run.mcp("sre", "get_cluster_health", {});
  metric({ p95: h.p95_ms, errorRate: 0.2 });
  await run.think("sre", A.sre, "Report post-deploy health.", h, `All SLOs green: p95 ${h.p95_ms} ms, ${h.agents_online} agents online, ${h.mcp_servers_up} MCP servers up.`);
  run.end("sre", "SLOs green 📈", h);

  const summary = run.finish();
  store.lastDevops = { ...summary, version, healed };
  run.record({ type: "done", version, ms: summary.ms, healed });
}
