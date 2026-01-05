/**
 * Multi-step workflow for deep incident analysis
 *
 * This workflow uses Cloudflare's durable execution to run a 2-step AI analysis:
 * 1. Analyze: What kind of attack/issue is this?
 * 2. Finalize: Generate a replay summary or postmortem report
 *
 * Workflows persist across crashes and can run for hours if needed.
 * Each step's output is saved, so we never lose progress.
 */

import { WorkflowEntrypoint, WorkflowStep, type WorkflowEvent } from "cloudflare:workers";

export interface ReplayParams {
  sessionId: string;
  persona: string;
  userMessage: string;
  mode: "replay" | "postmortem";
}

export class EPSReplayWorkflow extends WorkflowEntrypoint<any, ReplayParams> {
  async run(event: WorkflowEvent<ReplayParams>, step: WorkflowStep) {
    const { persona, userMessage, mode } = event.payload;

    // Step 1: Analyze the scenario
    // This step is durable - if it succeeds, we never re-run it even if the workflow crashes
    const analysis = await step.do("analyze", async () => {
      const system = `You are a Cloudflare ${persona} security analyst. Analyze this scenario:

Format your response like this:

**Possible Attack/Issue:**
* Type 1 description
* Type 2 description

**Key Signals Detected:**
* Signal 1 (Severity: High/Medium/Low)
* Signal 2 (Severity: High/Medium/Low)
* Signal 3 (Severity: High/Medium/Low)

**Recommended Actions:**
* Action 1
* Action 2
* Action 3

Be specific and use real Cloudflare security terms.`;

      const result = await (this.env as any).AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      return result.response ?? String(result);
    });

    // Step 2: Generate the final report based on the analysis
    // This runs after step 1 completes - uses that output to create a structured report
    const final = await step.do("finalize", async () => {
      const systemPrompt = mode === "postmortem"
        ? `Based on the analysis, write a postmortem report in this exact format:

**Summary:**
[2-3 sentence overview]

**Root Causes:**
* Cause 1
* Cause 2
* Cause 3

**Mitigations Applied:**
* Action 1
* Action 2

**Follow-up Actions:**
* Recommendation 1
* Recommendation 2
* Recommendation 3

Be specific and professional.`
        : `Based on the analysis, write a replay summary in this exact format:

**What Happened:**
[2-3 sentence description]

**Actions Taken:**
* Action 1 with details
* Action 2 with details
* Action 3 with details

**Expected Impact:**
[Brief paragraph explaining the protection]

**Risk Level:**
[High/Medium/Low] - [Brief explanation]

Be specific about Cloudflare security features.`;

      const result = await (this.env as any).AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Scenario: ${userMessage}\n\nAnalysis:\n${analysis}` },
        ],
        temperature: 0.3,
        max_tokens: 600,
      });

      return result.response ?? String(result);
    });

    // Package up the results for the API to send back to the client
    const title = mode === "postmortem" ? "📋 INCIDENT POSTMORTEM" : "🔁 REPLAY ANALYSIS";

    return {
      title,
      mode,
      scenario: userMessage,
      analysis,
      result: final
    };
  }
}
