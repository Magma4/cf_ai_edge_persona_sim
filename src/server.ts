// Entry Worker that serves UI + upgrades to Agent (WebSocket)

import type { AgentNamespace } from "agents";
import { routeAgentRequest, getAgentByName } from "agents";
import { EdgePersonaAgent } from "./agent";
import { EPSReplayWorkflow } from "./workflow";

// CRITICAL: Export the Durable Object and Workflow classes from the entry module
export { EdgePersonaAgent };
export { EPSReplayWorkflow };

// Force-bundle the agent class to ensure it's included in the Worker bundle
import "./agent";

// Use the beautiful UI from index.html
const ui = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Edge Persona Simulator</title>
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        padding: 20px;
        color: #333;
      }

      .container {
        max-width: 1000px;
        margin: 0 auto;
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        height: calc(100vh - 40px);
      }

      .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
      }

      .header h1 {
        font-size: 24px;
        font-weight: 600;
      }

      .controls {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
      }

      .status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
      }

      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #4ade80;
        box-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
      }

      .status-dot.disconnected {
        background: #ef4444;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
      }

      select, button {
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      select {
        background: white;
        color: #333;
        border: 1px solid rgba(255, 255, 255, 0.3);
        min-width: 160px;
      }

      select:focus {
        outline: 2px solid rgba(255, 255, 255, 0.5);
        outline-offset: 2px;
      }

      button {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        backdrop-filter: blur(10px);
      }

      button:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: translateY(-1px);
      }

      button:active {
        transform: translateY(0);
      }

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .chat-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .messages {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .message {
        display: flex;
        flex-direction: column;
        gap: 8px;
        animation: fadeIn 0.3s ease-in;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .message.user {
        align-items: flex-end;
      }

      .message.assistant {
        align-items: flex-start;
      }

      .message-bubble {
        max-width: 75%;
        padding: 12px 16px;
        border-radius: 12px;
        word-wrap: break-word;
        line-height: 1.5;
      }

      .message.user .message-bubble {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-bottom-right-radius: 4px;
      }

      .message.assistant .message-bubble {
        background: white;
        color: #333;
        border: 1px solid #e2e8f0;
        border-bottom-left-radius: 4px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      }

      .message-meta {
        font-size: 12px;
        color: #64748b;
        padding: 0 4px;
      }

      .message.user .message-meta {
        text-align: right;
      }

      .json-response {
        background: #1e293b;
        color: #e2e8f0;
        padding: 16px;
        border-radius: 8px;
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 13px;
        overflow-x: auto;
        white-space: pre-wrap;
        max-height: 400px;
        overflow-y: auto;
      }

      .json-response pre {
        margin: 0;
      }

      .input-area {
        padding: 20px;
        background: white;
        border-top: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .input-row {
        display: flex;
        gap: 12px;
      }

      textarea {
        flex: 1;
        padding: 12px 16px;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        min-height: 80px;
        max-height: 200px;
        transition: border-color 0.2s;
      }

      textarea:focus {
        outline: none;
        border-color: #667eea;
      }

      .send-button {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 32px;
        font-weight: 600;
        align-self: flex-start;
      }

      .send-button:hover {
        opacity: 0.9;
      }

      .empty-state {
        text-align: center;
        color: #94a3b8;
        padding: 60px 20px;
      }

      .empty-state svg {
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      .loading {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      ::-webkit-scrollbar {
        width: 8px;
      }

      ::-webkit-scrollbar-track {
        background: #f1f5f9;
      }

      ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }

      ::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🌐 Edge Persona Simulator</h1>
        <div class="controls">
          <div class="status">
            <div class="status-dot" id="statusDot"></div>
            <span id="statusText">Connecting...</span>
          </div>
          <select id="persona">
            <option value="WAF">🛡️ WAF</option>
            <option value="CDN_CACHE">💾 CDN Cache</option>
            <option value="LOAD_BALANCER">⚖️ Load Balancer</option>
            <option value="BOT_MGMT">🤖 Bot Management</option>
            <option value="WORKERS_RUNTIME">⚡ Workers Runtime</option>
            <option value="ZERO_TRUST">🔒 Zero Trust</option>
          </select>
          <button onclick="replay('replay')">🔁 Replay</button>
          <button onclick="replay('postmortem')">📋 Postmortem</button>
        </div>
      </div>

      <div class="chat-container">
        <div class="messages" id="messages">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <p>Select a persona and start chatting with the edge!</p>
          </div>
        </div>

        <div class="input-area">
          <div class="input-row">
            <textarea
              id="msg"
              placeholder="Ask the edge component a question..."
              rows="3"
            ></textarea>
          </div>
          <button class="send-button" onclick="send()" id="sendBtn">Send Message</button>
        </div>
      </div>
    </div>

    <script>
      const messagesEl = document.getElementById("messages");
      const msgInput = document.getElementById("msg");
      const personaSelect = document.getElementById("persona");
      const sendBtn = document.getElementById("sendBtn");
      const statusDot = document.getElementById("statusDot");
      const statusText = document.getElementById("statusText");

      let ws = null;
      let messageHistory = [];

      function updateStatus(connected) {
        if (connected) {
          statusDot.classList.remove("disconnected");
          statusText.textContent = "Connected";
        } else {
          statusDot.classList.add("disconnected");
          statusText.textContent = "Disconnected";
        }
      }

      function connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(\`\${protocol}//\${location.host}/agents/EdgePersonaAgent/room-v5\`);

        ws.onopen = () => {
          console.log("WebSocket opened - connection established");
          updateStatus(true);
          console.log("Connected to Edge Persona Simulator");
        };

        ws.onmessage = (e) => {
          console.log("Received message:", e.data);
          try {
            const data = JSON.parse(e.data);

            // Filter out ALL internal Cloudflare agent messages
            if (data.type && (
              data.type.includes('cf_agent') ||
              data.type.includes('mcp') ||
              data.type === 'sync' ||
              data.type === 'state'
            )) {
              console.log("Filtered internal message:", data.type);
              return;
            }

            // Filter out MCP-related messages
            if (data.mcp !== undefined) {
              console.log("Filtered MCP message");
              return;
            }

            // Filter out state sync messages
            if (data.state !== undefined && data.type) {
              console.log("Filtered state message");
              return;
            }

            if (data.ok && data.message) {
              // Initial connection message
              updateStatus(true);
              console.log("Initial handshake received:", data.message);
              return;
            }

            // Only show messages that look like actual content
            if (data.answer || data.error || (!data.type && !data.mcp && !data.state)) {
              addMessage(data, 'assistant');
            }
          } catch (err) {
            // If not JSON, treat as plain text - this is the actual AI response
            addMessage(e.data, 'assistant');
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          console.error("WebSocket readyState:", ws?.readyState);
          updateStatus(false);
        };

        ws.onclose = (event) => {
          console.log("WebSocket closed. Code:", event.code, "Reason:", event.reason, "Was clean:", event.wasClean);
          updateStatus(false);
          console.log("Disconnected. Reconnecting in 3 seconds...");
          setTimeout(connect, 3000);
        };
      }

      function addMessage(content, role) {
        // Remove empty state
        const emptyState = messagesEl.querySelector('.empty-state');
        if (emptyState) {
          emptyState.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = \`message \${role}\`;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';

        // Display content - prefer plain text for readability
        let displayContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

        // Convert markdown-like formatting to HTML for better display
        displayContent = displayContent
          .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')  // Bold
          .replace(/\\*(.+?)\\*/g, '<em>$1</em>')               // Italic
          .replace(/^- (.+)$/gm, '• $1')                        // Bullet points
          .replace(/^(\\d+)\\. /gm, '$1. ')                      // Numbered lists
          .replace(/\\n/g, '<br>');                              // Line breaks

        bubble.innerHTML = displayContent;

        const meta = document.createElement('div');
        meta.className = 'message-meta';
        meta.textContent = role === 'user' ? 'You' : personaSelect.value;
        meta.textContent += \` • \${new Date().toLocaleTimeString()}\`;

        messageDiv.appendChild(bubble);
        messageDiv.appendChild(meta);
        messagesEl.appendChild(messageDiv);

        // Scroll to bottom
        messagesEl.scrollTop = messagesEl.scrollHeight;

        messageHistory.push({ role, content });
      }

      function send() {
        const message = msgInput.value.trim();
        if (!message || !ws || ws.readyState !== WebSocket.OPEN) {
          return;
        }

        addMessage(message, 'user');
        msgInput.value = '';

        ws.send(JSON.stringify({
          persona: personaSelect.value,
          message: message
        }));
      }

      async function replay(mode) {
        const message = msgInput.value.trim();
        if (!message) {
          alert('Please enter a message first');
          return;
        }

        const button = event.target;
        const originalText = button.textContent;
        button.disabled = true;
        button.innerHTML = '<span class="loading"></span> Processing...';

        try {
          const res = await fetch("/api/replay", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sessionId: "default",
              persona: personaSelect.value,
              message: message,
              mode: mode
            })
          });

          // Get the formatted text response
          const formattedText = await res.text();
          addWorkflowMessage(formattedText, mode);
        } catch (error) {
          addMessage('Error: ' + error.message, 'assistant');
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      }

      function addWorkflowMessage(content, mode) {
        const emptyState = messagesEl.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.style.maxWidth = '90%';
        bubble.style.lineHeight = '1.8';
        bubble.style.fontSize = '14px';

        // Format the text with proper HTML
        let formattedContent = content
          // First convert newlines to a placeholder to preserve them
          .split('\\n').join('__NEWLINE__')
          // Convert **text** to bold (non-greedy match)
          .replace(/\\*\\*([^*]+?)\\*\\*/g, '<strong>$1</strong>')
          // Convert * bullet points at start of lines
          .replace(/__NEWLINE__\\* /g, '__NEWLINE__• ')
          // Convert section headers (text followed by colon at start of line)
          .replace(/__NEWLINE__([^<>:]+):/g, '__NEWLINE__<strong>$1:</strong>')
          // Add extra spacing after main headers (with separators)
          .replace(/(═+|─+)/g, '$1<br>')
          // Add paragraph breaks for double newlines
          .replace(/__NEWLINE____NEWLINE__/g, '<br><br>')
          // Convert remaining single newlines to breaks
          .replace(/__NEWLINE__/g, '<br>');

        bubble.innerHTML = formattedContent;

        const meta = document.createElement('div');
        meta.className = 'message-meta';
        meta.textContent = (mode === 'postmortem' ? 'Postmortem' : 'Replay') + ' • ' + new Date().toLocaleTimeString();

        messageDiv.appendChild(bubble);
        messageDiv.appendChild(meta);
        messagesEl.appendChild(messageDiv);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      // Enter key to send
      msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      });

      // Initial connection
      connect();
    </script>
  </body>
</html>`;

export interface Env {
  AI: Ai;
  VEC: VectorizeIndex;
  EdgePersonaAgent: AgentNamespace<EdgePersonaAgent>;
  EPS_REPLAY_WF: Workflow;
  AI_GATEWAY_NAME: string;
}

// Type assertion to work around type definition mismatch
// The actual Agents SDK API uses onMessage(raw: string) but types may be outdated

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);

    // 1) Serve UI (static HTML) with no-cache headers to prevent CDN/browser caching
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(ui, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-cache, no-store, must-revalidate",
          "pragma": "no-cache",
          "expires": "0"
        },
      });
    }

    // 2) Handle Agent connections at /agents/EdgePersonaAgent/:roomId
    // We manually forward to the Durable Object with required headers
    const agentMatch = url.pathname.match(/^\/agents\/EdgePersonaAgent\/(.+)$/);
    if (agentMatch) {
      const roomId = agentMatch[1];
      const id = env.EdgePersonaAgent.idFromName(roomId);
      const stub = env.EdgePersonaAgent.get(id);

      // Add the required namespace/room headers the Agent expects
      const headers = new Headers(req.headers);
      headers.set("x-partykit-namespace", "EdgePersonaAgent");
      headers.set("x-partykit-room", roomId);

      const modifiedRequest = new Request(req.url, {
        method: req.method,
        headers: headers,
        body: req.body,
      });

      return stub.fetch(modifiedRequest);
    }

    // 3) Feature 3: Workflows endpoint for Replay/Postmortem
    if (url.pathname === "/api/replay" && req.method === "POST") {
      try {
        const body = (await req.json()) as {
          sessionId: string;
          persona: string;
          message: string;
          mode: "replay" | "postmortem";
        };
        const { sessionId, persona, message, mode } = body;

        // Generate a valid workflow ID (alphanumeric and hyphens only)
        const workflowId = `eps-${sessionId}-${mode}-${Date.now()}`.replace(/[^a-zA-Z0-9-]/g, '-');

        const instance = await env.EPS_REPLAY_WF.create({
          id: workflowId,
          params: { sessionId, persona, userMessage: message, mode },
        });

        // Poll for workflow completion (max 30 seconds)
        const maxAttempts = 30;
        let attempts = 0;
        let result;

        while (attempts < maxAttempts) {
          result = await instance.status();

          if (result.status === "complete" || result.status === "errored") {
            break;
          }

          // Wait 1 second before polling again
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }

        if (result?.status === "complete" && result?.output) {
          // Format as plain text for better readability
          const output = result.output;
          let formattedText = '';

          if (output.title) {
            formattedText += `${output.title}\n`;
            formattedText += '═'.repeat(50) + '\n\n';
          }

          if (output.analysis) {
            formattedText += '📊 ANALYSIS\n';
            formattedText += '─'.repeat(50) + '\n';
            formattedText += output.analysis + '\n\n';
          }

          if (output.result) {
            formattedText += '✅ RESULT\n';
            formattedText += '─'.repeat(50) + '\n';
            formattedText += output.result + '\n';
          }

          return new Response(formattedText, {
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        } else if (result?.status === "errored") {
          return new Response(`Error: Workflow failed\n\nDetails: ${result.error}`, {
            status: 500,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        } else {
          return new Response(`⏳ Workflow is still processing...\n\nPlease try again in a few seconds.\nWorkflow ID: ${workflowId}`, {
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }
      } catch (e) {
        console.error("Workflow error:", e);
        return new Response(JSON.stringify({ error: "Workflow failed", details: String(e) }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
