#!/usr/bin/env tsx
/**
 * Captures a salience snapshot of top Korean political topics every 12 hours.
 * Calls the Anthropic API with Sonnet 4.6 + web_search to fetch current
 * headlines, extract ranked topics, and score sentiment + salience.
 *
 * Usage: npm run salience:capture
 * Requires: ANTHROPIC_API_KEY env var.
 *
 * Output: data/processed/salience/<ISO timestamp>.json
 *
 * Notes on design choices:
 * - Sonnet 4.6 (per project request — latest Sonnet, balanced speed and cost)
 * - web_search_20260209 has dynamic filtering built in (no separate code_execution
 *   tool, no beta header)
 * - System prompt is frozen and marked cache_control:ephemeral so the prefix
 *   caches across the twice-daily runs
 * - output_config.format with json_schema constrains the response to the
 *   project's salience-snapshot schema
 */

import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SALIENCE_DIR = path.join(ROOT, "data/processed/salience");
const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a Korean political analyst producing a salience snapshot of the top political topics in Korea right now. Your output is consumed by an interactive dashboard that compares snapshots over time.

For this snapshot, do the following:
1. Use the web_search tool to find recent (last 24 hours) Korean political news. Search Korean-language sources where possible. Issue 3-5 queries covering different angles: government, opposition, scandals, foreign policy, local elections, economy.
2. Identify the top 8 distinct political topics dominating coverage. A "topic" is a coherent storyline, not a single article.
3. For each topic, return:
   - rank (1 = most prominent)
   - topic_en: short English label, 4-8 words
   - topic_ko: short Korean label, 한글
   - summary: 1-2 sentences, plain English, factual
   - sentiment: one of "positive", "negative", "neutral", "mixed" (the prevailing tone of coverage, NOT your judgment of the topic)
   - sentiment_score: -1.0 (most negative) to 1.0 (most positive)
   - salience: 0.0 to 1.0, relative dominance among the 8 topics (rank 1 should be highest, rank 8 lowest)
   - issue_tag: optional, lowercase snake_case tag from this taxonomy if applicable: government_approval, economy, inflation, housing, demographics, candidate_strength, incumbency, local_development, party_fragmentation, opposition_unity, scandal, corruption, ideology, foreign_policy, education
   - evidence_headlines: 2-3 actual headlines from your searches, with title, outlet, and url

Rules:
- Be empirical: rank by what coverage shows, not by what you think should matter.
- Stay neutral: do not editorialize. The summary describes what is happening; sentiment describes the tone of the coverage.
- topic_en strings are stable handles used for cross-snapshot comparison. Use the SAME topic_en for the same ongoing storyline across snapshots when possible.
- Return ONLY the JSON object matching the provided schema. No prose, no preamble.`;

const SNAPSHOT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["topics"],
  properties: {
    topics: {
      // Anthropic structured outputs don't support: minItems > 1, maxItems,
      // minimum/maximum on numbers, minLength/maxLength on strings, format,
      // multipleOf. Semantic constraints (rank 1–8, prob 0–1, etc.) are
      // pinned in the system prompt instead.
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rank", "topic_en", "topic_ko", "summary", "salience"],
        properties: {
          rank: { type: "integer" },
          topic_en: { type: "string" },
          topic_ko: { type: "string" },
          summary: { type: "string" },
          sentiment: {
            type: "string",
            enum: ["positive", "negative", "neutral", "mixed"],
          },
          sentiment_score: { type: "number" },
          salience: { type: "number" },
          issue_tag: { type: "string", pattern: "^[a-z][a-z0-9_]*$" },
          evidence_headlines: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title"],
              properties: {
                title: { type: "string" },
                outlet: { type: "string" },
                url: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

async function main() {
  const client = new Anthropic();
  const capturedAt = new Date().toISOString();

  const userPrompt = `Capture timestamp: ${capturedAt}

Today's date: ${capturedAt.slice(0, 10)}

Produce the salience snapshot per your instructions. Use web_search to find current Korean political coverage, identify the top 8 topics, and return the JSON.`;

  console.log(`[salience] capturing at ${capturedAt} (model: ${MODEL})`);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // Frozen system prompt — caches across the twice-daily runs
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    output_config: {
      format: {
        type: "json_schema",
        schema: SNAPSHOT_SCHEMA,
      },
    },
    messages: [{ role: "user", content: userPrompt }],
  });

  console.log(
    `[salience] usage: input=${response.usage.input_tokens} output=${response.usage.output_tokens} cache_read=${response.usage.cache_read_input_tokens ?? 0} cache_write=${response.usage.cache_creation_input_tokens ?? 0}`,
  );

  // Extract structured JSON from the response
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Model did not return a text block");
  }
  const parsed = JSON.parse(textBlock.text) as {
    topics: Array<{
      rank: number;
      topic_en: string;
      topic_ko: string;
      summary: string;
      sentiment?: string;
      sentiment_score?: number;
      salience: number;
      issue_tag?: string;
      evidence_headlines?: Array<{
        title: string;
        outlet?: string;
        url?: string;
      }>;
    }>;
  };

  // Collect any web_search source URLs the model surfaced
  const sourceUrls = new Set<string>();
  for (const t of parsed.topics) {
    for (const h of t.evidence_headlines ?? []) {
      if (h.url) sourceUrls.add(h.url);
    }
  }

  const snapshot = {
    captured_at: capturedAt,
    method: "llm_synthesis" as const,
    model: MODEL,
    source_urls: [...sourceUrls],
    topics: parsed.topics,
    method_notes:
      "Captured via Anthropic API (Sonnet 4.6) with web_search for live Korean political coverage. Topic labels (topic_en) are stable handles for cross-snapshot rank comparison.",
  };

  await fs.mkdir(SALIENCE_DIR, { recursive: true });
  const filename =
    capturedAt.replace(/[:.]/g, "-").replace(/-\d{3}Z$/, "Z") + ".json";
  const out = path.join(SALIENCE_DIR, filename);
  await fs.writeFile(out, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`[salience] wrote ${path.relative(ROOT, out)}`);
}

main().catch((err) => {
  console.error("[salience] capture failed:", err);
  process.exit(1);
});
