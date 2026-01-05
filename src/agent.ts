/**
 * EdgePersonaAgent - The main AI agent that simulates Cloudflare edge components
 *
 * This is a Durable Object that maintains state across WebSocket connections.
 * Each connection gets a persistent agent that remembers the selected persona
 * and can recall previous conversations using Vectorize.
 */

import { Agent, type Connection } from "agents";
import { upsertMemory, queryMemory } from "./vector";
import type { Env } from "./server";

// All the edge components we can simulate
type Persona =
  | "WAF"
  | "CDN_CACHE"
  | "LOAD_BALANCER"
  | "BOT_MGMT"
  | "WORKERS_RUNTIME"
  | "ZERO_TRUST";

// Agent state that persists in the Durable Object
type State = {
  persona: Persona;
};

const DEFAULT_STATE: State = {
  persona: "WAF"
};

export class EdgePersonaAgent extends Agent<Env, State> {
  private currentConnection: Connection | null = null;
  initialState: State = DEFAULT_STATE;

  // Called when a WebSocket connection is established
  onConnect(connection: Connection) {
    this.currentConnection = connection;

    // Let the client know we're ready
    connection.send(
      JSON.stringify({
        ok: true,
        message: "Connected to Edge Persona Simulator",
        persona: this.state?.persona ?? "WAF",
      })
    );
  }

  // Called when a message arrives from the client
  async onMessage(connection: Connection, raw: string) {
    // Parse the incoming message (could be JSON or plain text)
    const parsed = safeJson(raw);
    const message = (parsed?.message ?? raw)?.toString().trim();
    const persona = (parsed?.persona ?? this.state?.persona ?? "WAF") as Persona;
    const sessionId = this.name; // Durable Object name is our session ID

    // If user switched personas, update our state
    if (persona !== this.state?.persona) {
      this.setState({ persona });
    }

    // Store this message in Vectorize so we can recall it later
    // This gives the agent "memory" across conversations
    try {
      await upsertMemory(this.env, sessionId, `[USER] ${message}`, "user");
    } catch (e) {
      console.warn("Vectorize upsert error (non-fatal):", e);
    }

    // Retrieve relevant past conversations to provide context
    // Vectorize does semantic search to find related messages
    let memories: string[] = [];
    try {
      memories = await queryMemory(this.env, sessionId, message, 3);
    } catch (e) {
      console.warn("Vectorize query error (non-fatal):", e);
    }

    // Build the system prompt for this persona, including relevant memories
    const systemPrompt = buildSystemPrompt(persona, memories);

    // Call Workers AI to generate the response
    try {
      const result = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.4,
        max_tokens: 700,
      });

      // Workers AI can return results in different formats, so we handle all of them
      let responseText: string;
      if (typeof result === "string") {
        responseText = result;
      } else if ((result as any)?.response) {
        responseText = (result as any).response;
      } else if ((result as any)?.choices?.[0]?.message?.content) {
        responseText = (result as any).choices[0].message.content;
      } else {
        responseText = JSON.stringify(result, null, 2);
      }

      // Store the AI's response in Vectorize too (truncated to 500 chars)
      try {
        await upsertMemory(this.env, sessionId, `[ASSISTANT] ${responseText.substring(0, 500)}`, "assistant");
      } catch (e) {
        console.warn("Vectorize upsert error (non-fatal):", e);
      }

      // Send response back to the client
      connection.send(responseText);
    } catch (e) {
      console.error("AI error:", e);
      connection.send(JSON.stringify({ error: "AI call failed", details: String(e) }, null, 2));
    }
  }

  // Clean up when connection closes
  onClose(connection: Connection) {
    if (this.currentConnection === connection) {
      this.currentConnection = null;
    }
  }
}

/**
 * Build the system prompt for the AI based on which persona is active
 * Includes relevant memories from previous conversations for context
 */
function buildSystemPrompt(persona: Persona, memories: string[]) {
  // Add memory context if we have any relevant past conversations
  const memBlock = memories.length
    ? `\n\nRelevant conversation history:\n- ${memories.join("\n- ")}`
    : "";

  // Each persona has its own personality and expertise
  const personaDescriptions: Record<Persona, string> = {
    WAF: "Cloudflare Web Application Firewall - I analyze HTTP requests for malicious patterns like SQL injection, XSS, and other OWASP threats. I use managed rulesets and custom rules to block attacks.",
    CDN_CACHE: "Cloudflare CDN Cache - I store and serve cached content from edge locations worldwide. I manage cache keys, TTLs, cache-control headers, and determine HIT/MISS/STALE states.",
    LOAD_BALANCER: "Cloudflare Load Balancer - I distribute traffic across origin pools using health checks, steering policies (random, hash, geo, latency), and failover logic.",
    BOT_MGMT: "Cloudflare Bot Management - I analyze requests using ML models, fingerprinting, and behavioral analysis to calculate bot scores and distinguish humans from automated traffic.",
    WORKERS_RUNTIME: "Cloudflare Workers Runtime - I execute JavaScript/WASM at the edge with V8 isolates. I handle request/response transformation, KV storage, Durable Objects, and edge compute.",
    ZERO_TRUST: "Cloudflare Zero Trust / Access - I enforce identity-based access policies, integrate with IdPs, manage device posture checks, and secure internal applications."
  };

  // The actual prompt sent to Workers AI
  return `You are the ${persona} simulator - ${personaDescriptions[persona]}
${memBlock}

Respond conversationally as this Cloudflare edge component would. Explain your decisions, signals you detected, and actions you took.

Format your response like this:
1. Start with a brief, friendly explanation of what you're doing
2. List key signals/metrics you detected (use bullet points)
3. Explain your decision and any actions taken
4. Mention the risk level (low/medium/high) if relevant
5. End with a follow-up question or suggestion

Use real technical terms (TTL, cache keys, WAF rules, bot scores, health checks, etc.) but explain them clearly.
Keep responses concise but informative (2-4 short paragraphs max).
Refuse any requests for illegal hacking instructions.`.trim();
}

// Helper to safely parse JSON without crashing
function safeJson(x: string) {
  try {
    return JSON.parse(x);
  } catch {
    return null;
  }
}
