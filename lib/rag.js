import { store } from "./store";

// ---- Knowledge base: the "documents" our RAG layer indexes ----------------
export const KB = [
  { id: "kb-01", category: "Launch", title: "Launch windows & transit", text: "Earth to Mars launches only happen during Hohmann transfer windows that open roughly every 26 months. Upcoming windows are December 2026, January 2029 and March 2031. Transit takes between 180 and 210 days aboard Red Horizon starships departing Starbase Pad 39A." },
  { id: "kb-02", category: "Fleet", title: "Starship fleet", text: "The Red Horizon fleet includes Ares Clipper I, Olympus Express and Crimson Voyager. Each ship carries 100 passengers, has artificial-gravity rings, hydroponic gardens and a zero-g observation dome." },
  { id: "kb-03", category: "Cabins", title: "Cabin classes", text: "Economy Pod costs 450,000 MarsCredits per traveler and includes a sleeping pod and shared lounges. Explorer Suite costs 1,200,000 MC with a private window and VR deck. Olympus First costs 3,500,000 MC with a private suite, chef-prepared meals and priority EVA training." },
  { id: "kb-04", category: "Habitats", title: "Martian habitats", text: "Jezero Dome Resort sits in Jezero Crater near ancient river deltas. Olympus Mons Base Camp offers summit treks on the tallest volcano in the solar system. Valles Marineris Canyon Lodge is carved into a canyon wall. Gale Crater Science Habitat hosts researchers. Phobos Orbital Hotel orbits Mars every 7.6 hours." },
  { id: "kb-05", category: "Medical", title: "Medical fitness requirements", text: "All travelers must pass a medical fitness screening. Travelers must be between 18 and 70 years old. Cardiac conditions require a cardiologist waiver. Cumulative radiation dose per round trip is limited to 600 millisieverts; storm shelters are mandatory during solar particle events." },
  { id: "kb-06", category: "Safety", title: "Dust storm season", text: "Global dust storms are most likely during the southern summer of Mars. During a dust storm, surface excursions are suspended and solar power drops. Weather Risk levels are LOW, MODERATE and HIGH; HIGH risk triggers automatic itinerary rescheduling." },
  { id: "kb-07", category: "Policy", title: "Baggage allowance", text: "Each traveler may bring 5 kilograms of personal baggage. Liquids are limited to 500 ml. Seeds, soil and live organisms are prohibited under planetary protection rules. Extra mass costs 20,000 MarsCredits per kilogram." },
  { id: "kb-08", category: "Policy", title: "Refund & cancellation policy", text: "Cancellations more than 12 months before launch receive a 90 percent refund. Cancellations within 12 months receive 50 percent. Missed launch windows due to medical disqualification are refunded in full. Bookings are transferable to the next launch window once." },
  { id: "kb-09", category: "Payments", title: "MarsCredits & payment", text: "Prices are quoted in MarsCredits (MC). One MarsCredit equals 1 US dollar. Payments are processed by the Interplanetary Payment Network. A 10 percent deposit secures the seat and the balance is due 90 days before launch. Travel insurance costs 4 percent of the fare." },
  { id: "kb-10", category: "Experiences", title: "Surface experiences", text: "Popular experiences include pressurized rover tours of Jezero delta, Olympus Mons summit treks, sunset viewing of blue Martian sunsets, low-gravity sports at 0.38 g, and visits to the historic Perseverance rover site." },
  { id: "kb-11", category: "Comms", title: "Communications delay", text: "Messages between Earth and Mars take 4 to 24 minutes one way depending on planetary alignment. Confirmations are sent over the Deep Space Relay network. Real-time video calls are not possible; travelers use asynchronous video mail." },
  { id: "kb-12", category: "Training", title: "Pre-flight training", text: "Travelers complete 6 weeks of pre-flight training including centrifuge sessions, spacesuit fitting, emergency drills and a parabolic zero-g flight. Olympus First guests receive EVA training." },
  { id: "kb-13", category: "Life", title: "Food & life on board", text: "Meals are grown in on-board hydroponic gardens and include fresh greens, 3D-printed proteins and freeze-dried desserts. Coffee is rationed to two cups per day. Exercise of 2 hours daily is mandatory to protect bone density." },
  { id: "kb-14", category: "DevOps", title: "Platform runbook: high latency", text: "If p95 latency of the booking API exceeds 800 ms during a canary rollout, the self-healing agent scales the agent-worker pool by 2x and warms the RAG index cache. If the error rate exceeds 2 percent, the deploy agent rolls back automatically." },
  { id: "kb-15", category: "DevOps", title: "Platform runbook: security", text: "Releases are blocked when a critical CVE is found or a secret is detected in the diff. High severity vulnerabilities require an approved exception. All release bundles are signed and an SBOM is attached." },
];

const STOP = new Set("the and for are with that this from have has will can into each per who what when where how why our your you a an of to in on is it be by as at or".split(" "));

export const tokenize = (s) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/s$/, ""));

// ---- Build a TF-IDF vector index once at module load --------------------
const docTokens = KB.map((d) => tokenize(`${d.title} ${d.title} ${d.category} ${d.text}`));
const df = new Map();
docTokens.forEach((toks) => new Set(toks).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
const N = KB.length;
const idf = (t) => Math.log((N + 1) / ((df.get(t) || 0) + 1)) + 1;

function vectorize(tokens) {
  const tf = new Map();
  tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
  const v = new Map();
  let norm = 0;
  tf.forEach((c, t) => {
    const w = (c / tokens.length) * idf(t);
    v.set(t, w);
    norm += w * w;
  });
  norm = Math.sqrt(norm) || 1;
  v.forEach((w, t) => v.set(t, w / norm));
  return v;
}

const docVectors = docTokens.map(vectorize);
export const VOCAB_SIZE = df.size;

function cosine(a, b) {
  let s = 0;
  a.forEach((w, t) => { if (b.has(t)) s += w * b.get(t); });
  return s;
}

export function retrieve(query, k = 3, caller = "user") {
  const t0 = performance.now();
  const tokens = tokenize(query);
  const qv = vectorize(tokens.length ? tokens : ["mars"]);
  const scored = KB.map((d, i) => ({ ...d, score: +cosine(qv, docVectors[i]).toFixed(4) })).sort((a, b) => b.score - a.score);
  const hits = scored.slice(0, k).filter((h) => h.score > 0);
  const result = {
    query,
    caller,
    tokens,
    hits,
    allScores: scored.map(({ id, score }) => ({ id, score })),
    chunks: N,
    vocab: VOCAB_SIZE,
    ms: +(performance.now() - t0).toFixed(2),
    ts: new Date().toISOString(),
  };
  store.ragLog.unshift({ query, caller, top: hits[0]?.title || "—", score: hits[0]?.score || 0, k: hits.length, ts: result.ts });
  store.ragLog.length = Math.min(store.ragLog.length, 40);
  return result;
}

export const contextBlock = (hits) => hits.map((h, i) => `[${i + 1}] ${h.title}: ${h.text}`).join("\n");
