# PROMPTS.md

This document contains the AI prompts used during development of the Edge Persona Simulator.

## System Prompt

The agent uses a dynamically generated system prompt (in `src/agent.ts`) that varies based on the selected persona:

```
You are the [PERSONA] simulator - [Description of the edge component]

[Relevant conversation history from Vectorize]

Respond conversationally as this Cloudflare edge component would.
Explain your decisions, signals you detected, and actions you took.

Format your response like this:
1. Start with a brief, friendly explanation of what you're doing
2. List key signals/metrics you detected (use bullet points)
3. Explain your decision and any actions taken
4. Mention the risk level (low/medium/high) if relevant
5. End with a follow-up question or suggestion

Use real technical terms but explain them clearly.
Keep responses concise but informative (2-4 short paragraphs max).
Refuse any requests for illegal hacking instructions.
```

Each persona (WAF, CDN Cache, Load Balancer, Bot Management, Workers Runtime, Zero Trust) gets its own description and expertise area.

---

## Development Prompts

These are the prompts I used with AI assistants while building this:

### 1. Initial concept
"Build an Edge Persona Simulator using Cloudflare's Agents SDK where an AI roleplays different Cloudflare edge components and explains their behavior through natural conversation."

### 2. WebSocket implementation
"Set up WebSocket routing to connect the chat UI to the EdgePersonaAgent Durable Object. Handle onConnect and onMessage lifecycle methods."

### 3. Semantic memory
"Add Vectorize integration to store conversation embeddings and retrieve relevant past messages for context-aware responses."

### 4. Multi-step workflows
"Create a workflow for replay and postmortem analysis that runs a two-step AI process: analyze the scenario, then generate a structured report."


---

## Technical Notes

The prompts evolved as I debugged various issues:
- Agents SDK uses `this.state` not `getState()`
- WebSocket routing requires special headers
- Workflow IDs need alphanumeric characters only
- Internal agent messages need filtering in the UI
