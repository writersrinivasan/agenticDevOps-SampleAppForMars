import { store } from "./store";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
export const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export const hasGroq = () => Boolean(process.env.GROQ_API_KEY);

// Calls Groq; if no key or the call fails, returns `fallback` so the demo never breaks.
export async function chat(messages, opts = {}) {
  const fallback = opts.fallback ?? "";
  if (!hasGroq()) return { text: fallback, live: false, ms: 0 };
  // Free-tier Groq keys have a tokens-per-minute cap: on a 429, wait as told (max 6s) and retry once.
  const r = await callGroq(messages, opts);
  const wait = r.error?.match(/try again in ([\d.]+)s/);
  if (r.error?.startsWith("Groq 429") && wait && +wait[1] <= 6) {
    await new Promise((res) => setTimeout(res, +wait[1] * 1000 + 150));
    return callGroq(messages, opts);
  }
  return r;
}

async function callGroq(messages, { temperature = 0.6, max_tokens = 400, json = false, fallback = "" } = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        // reasoning models (gpt-oss) spend tokens thinking first, so give them headroom and keep effort low
        ...(/gpt-oss/.test(MODEL) ? { reasoning_effort: "low", max_tokens: max_tokens + 160 } : { max_tokens }),
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    store.llmCalls++;
    store.llmTokens += data.usage?.total_tokens || 0;
    const text = (data.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return { text: text || fallback, live: true, ms: Date.now() - t0 };
  } catch (e) {
    if (!e.message.startsWith("Groq 429")) store.llmErrors++;
    store.lastLlmError = e.message;
    return { text: fallback, live: false, ms: Date.now() - t0, error: e.message };
  }
}
