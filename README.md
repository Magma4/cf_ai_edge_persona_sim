# Edge Persona Simulator

**Live Demo:** https://cf-ai-edge-persona-sim.raymondamoateng.workers.dev

## The Problem

Most AI demos are just chatbots that answer questions. But what if you could actually talk to the infrastructure? What if you could ask a CDN why it cached something, or a WAF how it detected an attack?

That's what this project does. It's an AI agent that roleplays different Cloudflare edge components and explains their decisions in real-time. You can chat with a Web Application Firewall, a Load Balancer, or any other edge component and get detailed explanations of how they work.

## What It Does

Select a persona (WAF, CDN Cache, Load Balancer, Bot Management, Workers Runtime, or Zero Trust) and start chatting. The AI stays in character and explains edge concepts using real Cloudflare terminology.

The interesting part: it's not just answering questions. The agent:
- **Remembers context** across conversations using semantic search
- **Runs multi-step analysis** for complex scenarios
- **Explains edge decisions** in plain English

Want to know how a WAF blocks SQL injection? Or how a CDN decides what to cache? Just ask.

---

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| **LLM** | Workers AI (Llama 3.3 70B) | ✅ |
| **Workflow/Coordination** | Agents SDK + Workflows + Durable Objects | ✅ |
| **User Input** | WebSocket real-time chat | ✅ |
| **Memory/State** | Agent state + Vectorize semantic memory | ✅ |
| **Documentation** | README.md + PROMPTS.md | ✅ |

### Bonus Features Implemented

Beyond the requirements, I added:
- **Vectorize integration** - Semantic memory that recalls relevant past conversations
- **Durable Workflows** - Multi-step replay and postmortem analysis
- **Production deployment** - Actually works at scale, globally distributed
- **Real-time WebSocket** - Sub-100ms responses, not slow HTTP polling
- **Clean architecture** - 4 files, ~1000 lines, well-commented

---

## Try It Now

**Live:** https://cf-ai-edge-persona-sim.raymondamoateng.workers.dev

1. Pick a persona (try WAF or Bot Management)
2. Ask: "What happens if I send a SQL injection attack?"
3. Watch the agent explain detection signals and blocking logic
4. Try the Replay or Postmortem buttons for deeper analysis

---

## Quick Start

### Run Locally
```bash
npm install
npm run dev
```
Open http://localhost:5173

### Deploy to Cloudflare
```bash
npm run deploy
```

### First-Time Setup

Create the Vectorize index:
```bash
npx wrangler vectorize create edge-persona-memory --dimensions=768 --metric=cosine
```

That's it. No environment variables, no API keys, no external services.

---

## How It Works

The architecture is 100% Cloudflare-native:

```
User → WebSocket → EdgePersonaAgent (Durable Object)
                           ↓
                    Workers AI (Llama 3.3)
                           ↓
                    Vectorize (semantic memory)
                           ↓
                    Response back via WebSocket
```

When you click Replay or Postmortem:
```
UI → Workflow API → EPSReplayWorkflow
                          ↓
                    Step 1: Analyze scenario
                          ↓
                    Step 2: Generate report
                          ↓
                    Formatted text response
```

**Why this stack matters:**
- Runs in 300+ cities globally (not one region)
- Sub-100ms AI inference at the edge
- Strongly consistent state (Durable Objects)
- Durable execution (Workflows survive crashes)
- Zero infrastructure management

---

## Project Structure

```
src/
├── agent.ts      - EdgePersonaAgent: chat, personas, memory
├── server.ts     - Worker entry: routing, UI, API
├── vector.ts     - Vectorize: semantic memory helpers
└── workflow.ts   - Multi-step replay/postmortem

wrangler.jsonc    - Cloudflare config
README.md         - This file
PROMPTS.md        - AI prompts used
```

Clean and minimal. Everything you need, nothing you don't.

---

## Features

### 1. Real-Time Edge Chat
Talk to six different Cloudflare components:
- 🛡️ WAF - Security threat analysis
- 💾 CDN Cache - Caching decisions
- ⚖️ Load Balancer - Traffic distribution
- 🤖 Bot Management - Bot detection
- ⚡ Workers Runtime - Edge compute
- 🔒 Zero Trust - Access control

Each one has its own personality and expertise.

### 2. Semantic Memory
The agent remembers previous conversations using Vectorize:
- Stores embeddings of every message
- Retrieves relevant context using cosine similarity
- Maintains consistency across sessions

Ask a follow-up question and it remembers what you talked about.

### 3. Multi-Step Workflows
Click Replay or Postmortem for deeper analysis:
- **Replay:** "What if" scenarios with different security settings
- **Postmortem:** Structured incident reports with root causes

These use Cloudflare Workflows for durable multi-step execution. Each step persists, so the analysis never loses progress.

---

## What I Learned

Building this taught me a lot about Cloudflare's edge platform:

**The Good:**
- Workers AI is fast - responses in under 100ms globally
- Durable Objects make state management simple
- Vectorize works great for semantic search
- Workflows handle complex multi-step logic elegantly

**The Challenges:**
- Agents SDK is new - documentation is still evolving
- WebSocket routing requires specific headers
- Debugging distributed systems takes patience
- Getting all the pieces to work together took iteration

**The Result:**
A production-ready app that actually demonstrates what makes Cloudflare's edge platform special - not just another chatbot, but something that shows edge-native reasoning.

---

## Tech Stack

Built entirely on Cloudflare:

- **Workers AI** - Llama 3.3 70B for inference
- **Agents SDK** - Stateful agents with Durable Objects
- **Vectorize** - Vector database for semantic memory
- **Workflows** - Durable multi-step execution
- **WebSockets** - Real-time bidirectional communication

No external APIs. No separate databases. No servers to manage. Everything runs at the edge.

---

## Future Improvements
- Add more personas (Rate Limiting, DDoS Protection, Stream, R2)
- Chat history export
- Voice input/output
- Analytics dashboard showing usage patterns
- Multi-agent conversations (WAF + Bot Mgmt working together)

---

Built for Cloudflare's AI/Edge
**Live Demo:** https://cf-ai-edge-persona-sim.raymondamoateng.workers.dev
