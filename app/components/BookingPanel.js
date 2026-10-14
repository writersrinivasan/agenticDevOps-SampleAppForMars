"use client";
import { useEffect, useRef, useState } from "react";
import AgentGraph from "./AgentGraph";
import { streamEvents, reduceAgents, fmt } from "./util";
import { BOOKING_AGENTS, BOOKING_STAGES } from "@/lib/agentsMeta";

const AG = Object.fromEntries(BOOKING_AGENTS.map((a) => [a.id, a]));
const HABITATS = [
  { id: "jezero", label: "Jezero Dome", e: "🏞️", c: "#ff6b6b" },
  { id: "olympus", label: "Olympus Mons", e: "🌋", c: "#ff922b" },
  { id: "valles", label: "Valles Marineris", e: "🏜️", c: "#fcc419" },
  { id: "gale", label: "Gale Crater", e: "🔬", c: "#20c997" },
  { id: "phobos", label: "Phobos Orbit", e: "🌑", c: "#845ef7" },
];
const CABINS = [
  { id: "Economy Pod", p: "450K MC", c: "#22b8cf" },
  { id: "Explorer Suite", p: "1.2M MC", c: "#cc5de8" },
  { id: "Olympus First", p: "3.5M MC", c: "#fcc419" },
];

function FeedItem({ e }) {
  const a = AG[e.agent] || { emoji: "•", color: "#aaa", name: e.agent };
  if (e.type === "thought")
    return (
      <div className="feed-item" style={{ "--c": a.color }}>
        <span className="fi-e">{a.emoji}</span>
        <div><b>{a.name}</b> <span className={`tag ${e.live ? "live" : "sim"}`}>{e.live ? "LLM live" : "sim"}</span><div className="fi-t">{e.text}</div></div>
      </div>
    );
  if (e.type === "mcp")
    return (
      <details className="feed-item mcp" style={{ "--c": e.entry.color }}>
        <summary>
          <span className="fi-e">🔌</span>
          <span><b>{a.name}</b> → <code>{e.entry.serverName}.{e.entry.tool}</code> <span className="ms">{e.entry.ms} ms</span></span>
        </summary>
        <pre>{JSON.stringify(e.entry.request, null, 1)}{"\n"}{JSON.stringify(e.entry.result, null, 1)}</pre>
      </details>
    );
  if (e.type === "rag")
    return (
      <div className="feed-item rag" style={{ "--c": "#cc5de8" }}>
        <span className="fi-e">📚</span>
        <div><b>{a.name}</b> retrieved {e.hits.length} chunks in {e.ms} ms<div className="fi-t">{e.hits.map((h) => `${h.title} (${h.score.toFixed(2)})`).join(" · ")}</div></div>
      </div>
    );
  if (e.type === "agent_start") return <div className="feed-sys" style={{ "--c": a.color }}>▶ {a.emoji} {a.name} started</div>;
  if (e.type === "agent_end") return <div className="feed-sys done" style={{ "--c": a.color }}>✔ {a.emoji} {a.name} · {e.summary}</div>;
  if (e.type === "run_start") return <div className="feed-sys">🛰️ Run {e.runId} · {e.agents} agents · {e.stages} stages · LLM {e.llm ? "live (Groq)" : "offline simulation"}</div>;
  if (e.type === "trace") return e.url ? <a className="feed-sys trace" href={e.url} target="_blank" rel="noreferrer">🔭 Full trace recorded in LangSmith — open ↗</a> : null;
  if (e.type === "error") return <div className="feed-sys err">❌ {e.message}</div>;
  return null;
}

function BoardingPass({ b }) {
  return (
    <div className="ticket">
      <div className="ticket-main">
        <div className="ticket-brand">🔴 RED HORIZON INTERPLANETARY · BOARDING PASS</div>
        <div className="ticket-route">
          <div><small>FROM</small><b>EARTH</b><span>Starbase Pad 39A</span></div>
          <div className="ticket-ship">🚀<span>{b.ship}</span><em>{b.transit_days} days</em></div>
          <div><small>TO</small><b>MARS</b><span>{b.region}</span></div>
        </div>
        <div className="ticket-grid">
          <div><small>Passenger</small><b>{b.name}{b.travelers > 1 ? ` +${b.travelers - 1}` : ""}</b></div>
          <div><small>Launch</small><b>{b.launch}</b></div>
          <div><small>Arrival</small><b>{b.arrival}</b></div>
          <div><small>Cabin</small><b>{b.cabin}</b></div>
          <div><small>Seats</small><b>{b.seats.join(", ")}</b></div>
          <div><small>Habitat</small><b>{b.habitat}</b></div>
          <div><small>Medical</small><b>{b.medical}</b></div>
          <div><small>Dust risk</small><b>{b.weather}</b></div>
        </div>
        <div className="ticket-msg">{b.message}</div>
      </div>
      <div className="ticket-stub">
        <small>BOOKING</small><b>{b.id}</b>
        <small>TOTAL</small><b className="gold">{fmt(b.price.total)} MC</b>
        <small>DEPOSIT PAID</small><b>{fmt(b.price.deposit)} MC</b>
        <small>TXN</small><b className="mono">{b.txn}</b>
        <div className="barcode" />
      </div>
    </div>
  );
}

export default function BookingPanel({ onDone }) {
  const [form, setForm] = useState({ name: "Ada Lovelace", age: 34, travelers: 2, departure: "2026-11", cabin: "Explorer Suite", habitat: "jezero", nights: 14, conditions: "none", request: "Our honeymoon! We love sunsets, rover adventures and great food." });
  const [agents, setAgents] = useState({});
  const [events, setEvents] = useState([]);
  const [booking, setBooking] = useState(null);
  const [running, setRunning] = useState(false);
  const [traceUrl, setTraceUrl] = useState(null);
  const feedRef = useRef(null);
  const graphRef = useRef(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [events]);

  async function launch(e) {
    e.preventDefault();
    setRunning(true);
    setAgents({});
    setEvents([]);
    setBooking(null);
    setTraceUrl(null);
    graphRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    try {
      await streamEvents("/api/book", form, (ev) => {
        setAgents((s) => reduceAgents(s, ev));
        if (ev.type === "trace") setTraceUrl(ev.url);
        if (ev.type !== "plan" && ev.type !== "done") setEvents((l) => [...l, ev]);
        if (ev.type === "done") setBooking(ev.booking);
      });
    } catch (err) {
      setEvents((l) => [...l, { type: "error", message: err.message }]);
    }
    setRunning(false);
    onDone?.();
  }

  const doneCount = Object.values(agents).filter((a) => a.status === "done").length;

  return (
    <div className="panel-grid">
      <form className="card form" onSubmit={launch}>
        <h2>🚀 Plan your Mars getaway</h2>
        <div className="row2">
          <label>Traveler name<input value={form.name} onChange={set("name")} /></label>
          <label>Age<input type="number" value={form.age} onChange={set("age")} /></label>
        </div>
        <div className="row2">
          <label>Travelers<input type="number" min="1" max="6" value={form.travelers} onChange={set("travelers")} /></label>
          <label>Depart after<input type="month" value={form.departure} onChange={set("departure")} /></label>
        </div>
        <label>Cabin class</label>
        <div className="choices">
          {CABINS.map((c) => (
            <button type="button" key={c.id} className={`choice ${form.cabin === c.id ? "on" : ""}`} style={{ "--c": c.c }} onClick={() => setForm({ ...form, cabin: c.id })}>
              <b>{c.id}</b><small>{c.p}</small>
            </button>
          ))}
        </div>
        <label>Destination habitat</label>
        <div className="choices five">
          {HABITATS.map((h) => (
            <button type="button" key={h.id} className={`choice ${form.habitat === h.id ? "on" : ""}`} style={{ "--c": h.c }} onClick={() => setForm({ ...form, habitat: h.id })}>
              <span className="big">{h.e}</span><small>{h.label}</small>
            </button>
          ))}
        </div>
        <div className="row2">
          <label>Nights on Mars<input type="number" min="3" max="60" value={form.nights} onChange={set("nights")} /></label>
          <label>Medical notes<input value={form.conditions} onChange={set("conditions")} /></label>
        </div>
        <label>Tell the agents what you want<textarea rows={3} value={form.request} onChange={set("request")} /></label>
        <button className="cta" disabled={running}>{running ? `🛰️ Agents working… ${doneCount}/${BOOKING_AGENTS.length}` : "✨ Launch the agent swarm"}</button>
      </form>

      <div className="card feed-card">
        <h2>📡 Live agent activity <span className="count">{events.length} events</span></h2>
        <div className="feed" ref={feedRef}>
          {!events.length && <div className="muted center">Press <b>Launch the agent swarm</b> to watch {BOOKING_AGENTS.length} agents collaborate in real time — LLM thoughts, MCP tool calls and RAG retrievals stream here.</div>}
          {events.map((ev, i) => <FeedItem key={i} e={ev} />)}
        </div>
      </div>

      <div className="card wide" ref={graphRef}>
        <h2>🧠 AI orchestration graph <span className="count">{doneCount}/{BOOKING_AGENTS.length} agents complete</span></h2>
        <div className="progress"><i style={{ width: `${(doneCount / BOOKING_AGENTS.length) * 100}%` }} /></div>
        <AgentGraph agents={BOOKING_AGENTS} stages={BOOKING_STAGES} state={agents} hub={BOOKING_AGENTS[0]} />
      </div>

      {booking && (
        <div className="card wide">
          <h2>🎫 Confirmed! {traceUrl && <a className="count trace-link" href={traceUrl} target="_blank" rel="noreferrer">🔭 View LangSmith trace ↗</a>}</h2>
          <BoardingPass b={booking} />
          <div className="itinerary">
            <h3>🗺️ Itinerary (by the Itinerary Agent)</h3>
            {booking.itinerary.split("\n").filter(Boolean).map((l, i) => <div key={i} className="itin-line" style={{ animationDelay: `${i * 0.12}s` }}>{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
