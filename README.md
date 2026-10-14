# 🔴 Red Horizon: Mars Agentic Travel (classroom demo)

A Next.js app that books trips to Mars using a **swarm of 19 AI agents**, with visible **AI orchestration**, a **RAG layer**, an **MCP layer**, **Groq LLM** reasoning, and an **agentic DevOps** pipeline. Everything runs in-process, so you don't need Docker, a database or cloud services.

## Run it
```bash
npm install        # first time only
npm run dev        # → http://localhost:3000
```

## Add your Groq key
Create `.env.local` in the project root (or copy `.env.local.example`):
```
GROQ_API_KEY=gsk_...
```
The header badge turns green (⚡ Groq live). Without a key, the app still runs in an **offline simulation** mode, so the demo never breaks.

## Monitoring with LangSmith (optional)
Add these lines to `.env.local`:
```
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=mars-agentic-travel
```
Every booking, DevOps run and ARIA answer is then recorded as a trace tree in the `mars-agentic-travel` project:
`root chain → agent chains → llm (Groq, with token usage) / tool (MCP) / retriever (RAG)`.
After each run the app shows a 🔭 link that opens that exact trace. If tracing fails, the app keeps working.

## Tabs
| Tab | What it shows |
|---|---|
| 🚀 Book a Trip | 11 agents (orchestrator + 10 specialists) stream LLM thoughts, MCP calls and RAG hits live, then produce a boarding pass and itinerary |
| 🧠 Orchestration | Agent census, architecture layers, the live state of the DAG, and a catalogue of every agent |
| 📚 RAG Layer | Step-by-step retrieval: tokenize → TF-IDF → cosine → top-k → augmented prompt |
| 🔌 MCP Layer | 7 MCP servers / 16 tools, an inspector to call any tool, and live JSON-RPC traffic |
| ⚙️ Agentic DevOps | 7 agents run review → test + security → build → canary deploy, with an SLO breach that gets auto-healed |
| 🤖 ARIA Assistant | Chat. Ask **"status"** to see every visual: census, architecture, orchestration, MCP, RAG and DevOps |

Demo shortcut: `http://localhost:3000/?tab=aria&ask=status`

## Code map
- `lib/agentsMeta.js`: all 19 agents and the DAG stages
- `lib/agents.js`: booking orchestrator · `lib/devops.js`: DevOps pipeline · `lib/runtime.js`: agent runtime (think / rag / mcp)
- `lib/rag.js`: knowledge base and vector index · `lib/mcp.js` + `lib/mcpRegistry.js`: MCP servers and tools
- `lib/groq.js`: Groq client with offline fallback · `lib/tracing.js`: LangSmith tracing · `app/api/*`: streaming NDJSON endpoints
