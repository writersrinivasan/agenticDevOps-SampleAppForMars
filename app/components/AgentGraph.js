"use client";
import { Fragment } from "react";
import { LAYER_COLORS } from "@/lib/agentsMeta";

function LayerBadges({ agent, st, small }) {
  const used = { MCP: st?.mcp, RAG: st?.rag, LLM: st?.llm };
  return (
    <div className="badges">
      {agent.layers.map((l) => (
        <span key={l} className={`badge ${used[l] ? "lit" : ""}`} style={{ "--b": LAYER_COLORS[l] }}>
          {l}{!small && used[l] ? ` ×${used[l]}` : ""}
        </span>
      ))}
    </div>
  );
}

export function AgentNode({ agent, st, small }) {
  const status = st?.status || "idle";
  return (
    <div className={`node ${status} ${small ? "small" : ""}`} style={{ "--c": agent.color }} title={agent.role}>
      <div className="node-top">
        <span className="node-emoji">{agent.emoji}</span>
        <div className="node-name">{agent.name}</div>
      </div>
      {!small && <div className="node-sub">{st?.summary || agent.role}</div>}
      <div className="node-foot">
        <LayerBadges agent={agent} st={st} small={small} />
        <span className={`pill ${status}`}>{status === "done" ? `${((st.ms || 0) / 1000).toFixed(1)}s` : status}</span>
      </div>
    </div>
  );
}

// Visual DAG: optional orchestrator hub on top, then stages left→right with animated edges.
export default function AgentGraph({ agents, stages, state = {}, hub, small }) {
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  const stageStatus = (ids) => {
    const s = ids.map((id) => state[id]?.status);
    if (s.some((x) => x === "running")) return "running";
    if (s.length && s.every((x) => x === "done")) return "done";
    if (s.some((x) => x === "done")) return "running";
    return "idle";
  };
  return (
    <div className={`graph ${small ? "small" : ""}`}>
      {hub && (
        <div className="hub-wrap">
          <AgentNode agent={hub} st={state[hub.id]} small={small} />
          <div className={`hub-bus ${state[hub.id]?.status || "idle"}`} />
        </div>
      )}
      <div className="flow">
        {stages.map((ids, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div className={`edge ${stageStatus(stages[i - 1]) === "done" ? "lit" : ""} ${stageStatus(ids) === "running" ? "flowing" : ""}`}>
                <span className="dot" />
              </div>
            )}
            <div className={`stage ${stageStatus(ids)}`}>
              <div className="stage-label">{ids.length > 1 ? "⚡ parallel" : `step ${i + 1}`}</div>
              {ids.map((id) => byId[id] && <AgentNode key={id} agent={byId[id]} st={state[id]} small={small} />)}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
