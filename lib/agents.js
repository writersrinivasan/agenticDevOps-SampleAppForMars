import { createRun } from "./runtime";
import { chat } from "./groq";
import { contextBlock } from "./rag";
import { CABINS } from "./mcp";
import { store } from "./store";
import { BOOKING_AGENTS, BOOKING_STAGES } from "./agentsMeta";

const A = Object.fromEntries(BOOKING_AGENTS.map((a) => [a.id, a]));
const fmt = (n) => Number(n).toLocaleString("en-US");

function safeJson(text, fallback) {
  try {
    const m = String(text).match(/\{[\s\S]*\}/);
    return m ? { ...fallback, ...JSON.parse(m[0]) } : fallback;
  } catch {
    return fallback;
  }
}

export async function runBooking(input, emit) {
  const name = input.name?.trim() || "Demo Traveler";
  const run = createRun("booking", emit, { traveler: name, ...input });
  const travelers = Math.max(1, Math.min(6, Number(input.travelers) || 1));
  const nights = Math.max(3, Math.min(60, Number(input.nights) || 14));
  const age = Number(input.age) || 34;
  const request = input.request?.trim() || "A relaxing first trip to Mars with some adventure.";

  run.record({ type: "run_start", runId: run.trace.runId, llm: run.trace.llm, agents: BOOKING_AGENTS.length, stages: BOOKING_STAGES.length });

  // ── Orchestrator: plan ─────────────────────────────────────────────
  run.start("orchestrator", -1);
  await run.think("orchestrator", A.orchestrator, "Plan the agent DAG for this Mars booking request.", { name, travelers, request },
    `Decomposing ${name}'s request into ${BOOKING_STAGES.length} stages across ${BOOKING_AGENTS.length - 1} specialists — fanning out launch, habitat, medical and weather in parallel.`);
  run.record({ type: "plan", stages: BOOKING_STAGES });

  // ── Stage 1: Intent ────────────────────────────────────────────────
  run.start("intent", 0);
  const defaultIntent = { cabin: CABINS[input.cabin] ? input.cabin : "Explorer Suite", interests: ["rover tours", "sunsets"], budget: "mid", special_needs: input.conditions || "none", mood: "adventurous" };
  const intentR = await run.think("intent", A.intent, "Extract structured intent from the traveler's request.", { request, form: { cabin: input.cabin, habitat: input.habitat, conditions: input.conditions } },
    JSON.stringify(defaultIntent),
    { json: true, max_tokens: 200, silent: true, system: 'Return ONLY JSON: {"cabin":"Economy Pod|Explorer Suite|Olympus First","interests":[string],"budget":"low|mid|high","special_needs":string,"mood":string}. Prefer the cabin from the form unless the request clearly says otherwise.' });
  const intent = safeJson(intentR.text, defaultIntent);
  if (!CABINS[intent.cabin]) intent.cabin = defaultIntent.cabin;
  run.record({ type: "thought", agent: "intent", text: `Parsed intent → ${intent.cabin}, interests: ${(intent.interests || []).join(", ")}, mood: ${intent.mood}.`, live: intentR.live });
  run.end("intent", `${intent.cabin} · ${(intent.interests || []).slice(0, 2).join(", ")}`, intent);

  // ── Stage 2: Knowledge (RAG) ───────────────────────────────────────
  run.start("knowledge", 1);
  const kb = run.rag("knowledge", `${request} ${intent.cabin} cabin baggage refund policy ${(intent.interests || []).join(" ")}`, 4);
  await run.think("knowledge", A.knowledge, "Summarize which retrieved policies matter for this trip.", contextBlock(kb.hits),
    `Grounded the trip in ${kb.hits.length} policy chunks — top match "${kb.hits[0]?.title}" (score ${kb.hits[0]?.score}).`);
  run.end("knowledge", `${kb.hits.length} chunks · top "${kb.hits[0]?.title}"`, { hits: kb.hits.map((h) => h.title) });

  // ── Stage 3: parallel fan-out ──────────────────────────────────────
  const [launch, habitat, medical] = await Promise.all([
    (async () => {
      run.start("launch", 2);
      const { windows } = await run.mcp("launch", "get_launch_windows", { after: input.departure || "2026-10" });
      const w = windows.find((x) => x.seats_left >= travelers) || windows[0] || { window_id: "W-2026-12", launch: "2026-12-18", arrival: "2027-07-02", ship: "Ares Clipper I", transit_days: 196 };
      const hold = await run.mcp("launch", "reserve_seat", { window_id: w.window_id, cabin: intent.cabin, travelers });
      await run.think("launch", A.launch, "Choose the best launch window.", { windows, chosen: w },
        `Locked ${w.ship} on the ${w.launch} Hohmann window — ${w.transit_days} days of transit, seats ${hold.seats.join(", ")} on hold.`);
      run.end("launch", `${w.ship} · ${w.launch}`, { ...w, ...hold });
      return { ...w, ...hold };
    })(),
    (async () => {
      run.start("habitat", 2);
      const { results } = await run.mcp("habitat", "search_habitats", { preference: input.habitat || "jezero", nights });
      const h = results[0];
      const conf = await run.mcp("habitat", "book_habitat", { habitat_id: h.id, nights, travelers });
      await run.think("habitat", A.habitat, "Pick the habitat that fits the traveler's interests.", { interests: intent.interests, options: results.slice(0, 3) },
        `${h.name} matches the "${intent.mood}" vibe — ${h.vibe}; module ${conf.module} reserved for ${nights} sols.`);
      run.end("habitat", `${h.name} · ${nights} nights`, { ...h, ...conf });
      return { ...h, ...conf };
    })(),
    (async () => {
      run.start("medical", 2);
      const rules = run.rag("medical", "medical fitness requirements age radiation cardiac waiver", 2);
      const fit = await run.mcp("medical", "check_fitness", { age, conditions: intent.special_needs || "none" });
      await run.think("medical", A.medical, "Decide medical clearance.", { fit, rules: contextBlock(rules.hits) },
        fit.cleared ? `Traveler cleared: within age band, radiation budget ${fit.radiation_budget_msv} mSv, ${fit.training_weeks}-week training scheduled.` : `Flagged: ${fit.notes}. Booking proceeds conditionally pending waiver.`);
      run.end("medical", fit.cleared ? "Cleared for flight ✅" : `Conditional ⚠️ ${fit.notes}`, fit);
      return fit;
    })(),
  ]);
  // weather depends on the habitat region, so it starts once the habitat is known (still within stage 3)
  run.start("weather", 2);
  const wx = await run.mcp("weather", "get_dust_forecast", { region: habitat.region });
  await run.think("weather", A.weather, "Assess dust-storm risk for the stay.", wx,
    `${wx.risk} dust risk over ${habitat.region} (τ=${wx.opacity_tau}) — ${wx.advisory.toLowerCase()}.`);
  run.end("weather", `${wx.risk} risk · ${wx.temp_c}°C`, wx);

  // ── Stage 4: Pricing ───────────────────────────────────────────────
  run.start("pricing", 3);
  const quote = await run.mcp("pricing", "quote_price", { cabin: intent.cabin, travelers, nightly: habitat.nightly, nights });
  await run.think("pricing", A.pricing, "Explain the quote.", quote, `Total ${fmt(quote.total)} MC incl. 4% insurance; a ${fmt(quote.deposit)} MC deposit secures the seats.`);
  run.end("pricing", `${fmt(quote.total)} MC total`, quote);

  // ── Stage 5: Payment ───────────────────────────────────────────────
  run.start("payment", 4);
  const pay = await run.mcp("payment", "charge_payment", { amount: quote.deposit, payer: name });
  await run.think("payment", A.payment, "Confirm the deposit charge.", pay, `Deposit approved on the Interplanetary Payment Network — txn ${pay.txn_id}.`);
  run.end("payment", `${pay.status} · ${pay.txn_id}`, pay);

  // ── Stage 6: Itinerary (LLM + RAG) ─────────────────────────────────
  run.start("itinerary", 5);
  const exp = run.rag("itinerary", `surface experiences ${habitat.name} ${(intent.interests || []).join(" ")}`, 2);
  const fallbackItin = [
    `🚀 Day 0 — Launch from Starbase Pad 39A aboard ${launch.ship} (${launch.launch}).`,
    `🌌 Transit — ${launch.transit_days} days: hydroponic dinners, VR deck and daily 2-hour workouts.`,
    `🔴 Sol 1 — Touchdown and welcome briefing at ${habitat.name}.`,
    `🛻 Sol 2–4 — Pressurized rover tours; ${habitat.vibe}.`,
    `🌅 Sol 5 — Blue Martian sunset viewing${wx.risk === "HIGH" ? " (rescheduled around dust storm)" : ""}.`,
    `🏀 Sol 6+ — Low-gravity (0.38 g) sports and free exploration for ${nights - 5} more sols.`,
  ].join("\n");
  const itin = await chat(
    [
      { role: "system", content: "You are the Itinerary Agent for Red Horizon Interplanetary. Write a fun, concise Mars itinerary as 6 lines, each starting with an emoji and a day label (e.g. 'Sol 2 —'). Use only facts from the context. No intro or outro." },
      { role: "user", content: `Traveler: ${name} (${travelers} pax), mood ${intent.mood}, interests ${(intent.interests || []).join(", ")}.\nShip: ${launch.ship}, launch ${launch.launch}, transit ${launch.transit_days} days.\nHabitat: ${habitat.name} (${habitat.vibe}), ${nights} nights.\nWeather: ${wx.risk} dust risk.\nKnowledge:\n${contextBlock(exp.hits)}` },
    ],
    { max_tokens: 380, fallback: fallbackItin, parentRun: run.agentRun("itinerary"), traceName: "🗺️ Itinerary Agent · write plan" }
  );
  if (itin.live) run.trace.agents.itinerary.llm++;
  run.record({ type: "thought", agent: "itinerary", text: `Drafted a ${nights}-sol itinerary grounded in ${exp.hits.length} experience docs.`, live: itin.live });
  run.end("itinerary", "6-step plan drafted", { itinerary: itin.text });

  // ── Stage 7: Comms ─────────────────────────────────────────────────
  run.start("notify", 6);
  const note = await run.mcp("notify", "send_notification", { to: name, message: `Your Mars trip ${run.trace.runId} on ${launch.ship} is confirmed!` });
  run.end("notify", `Delivered via relay (${note.one_way_delay_min} min delay)`, note);

  // ── Orchestrator: wrap-up ──────────────────────────────────────────
  const final = await run.think("orchestrator", A.orchestrator, "Write a 2-sentence celebratory confirmation for the traveler.", { name, ship: launch.ship, habitat: habitat.name, total: quote.total },
    `All ${BOOKING_AGENTS.length} agents converged: ${name} flies ${launch.ship} on ${launch.launch} and stays at ${habitat.name}. Welcome to the Red Planet! 🔴`,
    { max_tokens: 120, system: "Reply with 2 short, exciting sentences. No preamble." });
  run.end("orchestrator", "Run complete", {});

  const booking = {
    id: run.trace.runId,
    name, travelers, age,
    cabin: intent.cabin,
    ship: launch.ship, window: launch.window_id, launch: launch.launch, arrival: launch.arrival, transit_days: launch.transit_days,
    seats: launch.seats, hold_id: launch.hold_id,
    habitat: habitat.name, region: habitat.region, module: habitat.module, nights,
    weather: wx.risk, medical: medical.cleared ? "CLEARED" : "CONDITIONAL",
    price: quote, txn: pay.txn_id,
    itinerary: itin.text,
    message: final.text,
    createdAt: new Date().toISOString(),
  };
  const summary = run.finish();
  store.bookings.unshift(booking);
  store.bookings.length = Math.min(store.bookings.length, 20);
  store.lastBooking = summary;
  run.record({ type: "done", booking, ms: summary.ms });
  summary.traceUrl = await run.closeTrace({ booking });
}
