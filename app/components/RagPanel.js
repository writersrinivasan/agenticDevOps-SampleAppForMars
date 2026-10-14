"use client";
import { useEffect, useState } from "react";

const SAMPLES = ["What is the baggage allowance?", "Can I get a refund if I cancel?", "medical requirements for heart conditions", "best things to do at Olympus Mons", "what happens during a dust storm?"];
const STEPS = ["❓ Query", "✂️ Tokenize", "📐 TF-IDF vector", "🧮 Cosine similarity", "🏆 Top-k chunks", "🧠 Augmented prompt"];
const CAT_COLORS = ["#ff6b6b", "#f06595", "#cc5de8", "#845ef7", "#5c7cfa", "#339af0", "#22b8cf", "#20c997", "#51cf66", "#94d82d", "#fcc419", "#ff922b"];

export default function RagPanel() {
  const [kb, setKb] = useState([]);
  const [vocab, setVocab] = useState(0);
  const [q, setQ] = useState(SAMPLES[0]);
  const [res, setRes] = useState(null);
  const [step, setStep] = useState(-1);

  useEffect(() => {
    fetch("/api/rag").then((r) => r.json()).then((d) => { setKb(d.kb); setVocab(d.vocab); });
  }, []);

  const cats = [...new Set(kb.map((d) => d.category))];
  const catColor = (c) => CAT_COLORS[cats.indexOf(c) % CAT_COLORS.length];

  async function search(query = q) {
    setQ(query);
    setRes(null);
    for (let i = 0; i < STEPS.length; i++) {
      setStep(i);
      await new Promise((r) => setTimeout(r, 260));
      if (i === 2) {
        const r = await fetch("/api/rag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, k: 3 }) }).then((x) => x.json());
        setRes(r);
      }
    }
  }

  const scoreOf = (id) => res?.allScores.find((s) => s.id === id)?.score || 0;
  const maxScore = Math.max(0.0001, ...(res?.allScores.map((s) => s.score) || [0]));
  const hitIds = new Set(res?.hits.map((h) => h.id));

  return (
    <div className="panel-grid">
      <div className="card wide">
        <h2>📚 RAG layer — Retrieval-Augmented Generation <span className="count">{kb.length} chunks · {vocab} terms</span></h2>
        <p className="lead">Every agent that needs facts (Knowledge, Medical, Itinerary, Security, Self-Healing, ARIA) queries this vector index first, then passes the top chunks to the LLM — so answers are grounded in Red Horizon&apos;s own documents.</p>
        <form className="searchbar" onSubmit={(e) => { e.preventDefault(); search(); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask the knowledge base…" />
          <button className="cta small">🔎 Retrieve</button>
        </form>
        <div className="chips">{SAMPLES.map((s) => <button key={s} className="chip btn" onClick={() => search(s)}>{s}</button>)}</div>
        <div className="pipeline">
          {STEPS.map((s, i) => <div key={s} className={`pstep ${i < step ? "done" : i === step ? "running" : ""}`}><span>{i + 1}</span>{s}</div>)}
        </div>
        {res && (
          <div className="rag-detail">
            <div>
              <div className="sub-h">✂️ Query tokens <em>(stop-words removed, stemmed)</em></div>
              <div className="tokens">{res.tokens.map((t, i) => <span key={i}>{t}</span>)}</div>
              <div className="sub-h">🏆 Top-{res.hits.length} retrieved in {res.ms} ms</div>
              {res.hits.map((h, i) => (
                <div key={h.id} className="hit big" style={{ "--c": catColor(h.category) }}>
                  <div className="hit-h"><b>#{i + 1} {h.title}</b> <small>{h.category}</small><span className="ms">cos {h.score.toFixed(3)}</span></div>
                  <div className="hit-t">{h.text}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="sub-h">🧠 Augmented prompt sent to the LLM</div>
              <pre className="prompt">{res.augmented}</pre>
            </div>
          </div>
        )}
      </div>
      <div className="card wide">
        <h2>🗂️ Vector index — similarity of every chunk to your query</h2>
        <div className="kb-grid">
          {kb.map((d) => {
            const s = scoreOf(d.id);
            return (
              <div key={d.id} className={`kb ${hitIds.has(d.id) ? "hit-on" : ""}`} style={{ "--c": catColor(d.category) }}>
                <div className="kb-h"><span className="kb-cat">{d.category}</span><span className="ms">{res ? s.toFixed(3) : d.id}</span></div>
                <b>{d.title}</b>
                <div className="bar"><i style={{ width: `${res ? (s / maxScore) * 100 : 0}%` }} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
