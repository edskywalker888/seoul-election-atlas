#!/usr/bin/env tsx
/**
 * NESDC poll scraper for the 2026 Seoul mayoral election.
 *
 * Approach: a Claude agent (Sonnet 4.6, adaptive thinking) is given web_search
 * and web_fetch as server-side tools and instructed to browse NESDC
 * (중앙선거여론조사심의위원회, https://www.nesdc.go.kr) — the public registry
 * where every Korean election poll must be filed — plus pollster summary pages
 * (Korea Gallup, Realmeter, etc.) when NESDC is hard to navigate. The model
 * extracts filings, groups them weekly, and returns JSON in our PollAggregate
 * shape. We then write that JSON with method="nesdc_scrape", which causes the
 * landing-page amber demo-data banner to disappear automatically (the page
 * conditions on `method === "manual_demo"`).
 *
 * Cost note: Sonnet 4.6 chosen over Opus 4.7 — the scraping task is
 * "browse two sites and extract a table," which Sonnet handles cleanly at
 * roughly one-fifth the per-run cost. Bump to Opus 4.7 if extraction
 * accuracy regresses.
 *
 * Usage: ANTHROPIC_API_KEY=… npm run polls:scrape
 *
 * Failure mode: on parse failure, missing data, or refusal, this script
 * exits non-zero WITHOUT overwriting the existing aggregate.json — better
 * to keep stale-but-known-good demo data than write empty real data.
 */

import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  PollAggregate,
  PollCandidate,
  PollPoint,
} from "../../apps/web/src/types/index.js";

const ROOT = process.cwd();
const OUT = path.join(
  ROOT,
  "data/processed/polls/2026-seoul-mayor/aggregate.json",
);
const MODEL = "claude-sonnet-4-6";
const MAX_TOOL_ITERATIONS = 6;

const SYSTEM_PROMPT = `You are an agent that extracts Seoul mayoral election polling data from public Korean sources, primarily NESDC (중앙선거여론조사심의위원회, https://www.nesdc.go.kr) — the registry where every Korean election poll must be filed by law.

Your output is consumed by a dashboard that compares prediction-market prices to polling support over time. Accuracy and conservatism beat completeness: it is better to report fewer polls correctly than many polls fabricated.

WORKFLOW
1. Use web_search to find Seoul mayor 2026 polls. Try Korean queries first — they hit better sources:
   - "2026 서울시장 여론조사 NESDC"
   - "선거여론조사심의위원회 서울시장"
   - "서울시장 정원오 오세훈 지지율"
   - "서울시장 선거 여론조사 2026"
2. NESDC's site is form-based and may be hard to navigate via web_fetch. If that's the case, fall back to:
   - Pollster summary pages: Korea Gallup (gallup.co.kr), Realmeter (realmeter.net), Korea Research, Embrain
   - Korean news outlets that aggregate NESDC filings (한겨레, 중앙일보, JTBC, 연합뉴스 reporting on poll filings)
   - Wikipedia '2026 서울특별시장 선거' if it exists
3. For each poll, extract:
   - Fielding date (the date the poll was conducted, NOT registration date)
   - Pollster / fielder name (one of: gallup-korea, realmeter, korea-research, embrain, other-<short-slug>)
   - Sample size (if reported)
   - Support share for each candidate (정원오, 오세훈, others mentioned)
4. Group polls into weekly buckets (Mon-Sun, ISO week). For each (candidate, week), average the support shares across all polls in that bucket. Record n_polls = count and sources = list of pollster slugs that contributed.
5. Cover the period from Nov 2025 to today as continuously as possible, but do not fabricate weeks where you found no polls — leave those weeks out.

OUTPUT
Return ONLY a JSON object — no preamble, no code-fence wrapping if you can avoid it. Schema:

{
  "captured_at": "<current ISO timestamp UTC>",
  "candidates": [
    {
      "name": "<English Romanization>",
      "name_ko": "<한글>",
      "party_id": "dpk" | "ppp" | "rebuild" | "other",
      "series": [
        {
          "t": "<ISO 8601 datetime, week start Monday UTC, e.g. 2025-11-03T00:00:00Z>",
          "p": <0–1>,
          "n_polls": <int>,
          "sources": ["<pollster slug>", ...]
        }
      ]
    }
  ],
  "method_notes": "<1–2 sentences: what coverage you found, what's missing, any caveats>"
}

RULES
- p must be in [0, 1]. If a poll reports "55%", store 0.55.
- The series for each candidate must have at least 2 weekly buckets, sorted by t ascending. If you cannot find 2 weeks of data for a candidate, omit that candidate from the output.
- Always include 정원오 (Chong Won-oh, DPK) and 오세훈 (Oh Se-hoon, PPP) if you find data for them — they are the front-runners.
- Use exact party_id strings: "dpk", "ppp", "rebuild", "other". Lowercase. No other values.
- DO NOT make up numbers. If unsure, omit. Conservative output is better than wrong output.
- If you cannot find ANY real polling data, return {"candidates": [], "method_notes": "no polls found via accessible sources"} — the calling script will keep the prior aggregate.

CANDIDATE BACKGROUND (for reference, do NOT include in output)
- 정원오 (Chong Won-oh): incumbent Seongdong-gu mayor, DPK
- 오세훈 (Oh Se-hoon): incumbent Seoul mayor, PPP
- 안철수 (Ahn Cheol-soo): PPP, formerly People's Party
- 박용진 (Park Yong-jin): DPK, former lawmaker
- 홍익표 (Hong Ihk-pyo): DPK
- 강훈식 (Kang Hoon-sik): DPK
- 박주민 (Park Ju-min): DPK
- 김민석 (Kim Min-seok): DPK
- 나경원 (Na Kyung-won): PPP
- 조국 (Cho Kuk): Rebuilding Korea (legally barred but appears in some early polls)`;

interface ModelResult {
  captured_at?: string;
  candidates: PollCandidate[];
  method_notes?: string;
}

function extractJson(text: string): string {
  // Try fenced JSON first (```json … ``` or ``` … ```)
  const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fence) return fence[1].trim();
  // Otherwise grab from first { to last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

// The schema requires `t` to be RFC-3339 date-time (e.g. 2025-11-03T00:00:00Z).
// The agent occasionally emits plain calendar dates (2025-11-03); coerce those
// to UTC midnight rather than re-running the whole scrape on a format quibble.
function normalizeT(t: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return `${t}T00:00:00Z`;
  return t;
}

function validatePoint(p: unknown): p is PollPoint {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.t === "string" &&
    typeof o.p === "number" &&
    o.p >= 0 &&
    o.p <= 1 &&
    !Number.isNaN(Date.parse(o.t))
  );
}

function validateCandidate(c: unknown): c is PollCandidate {
  if (typeof c !== "object" || c === null) return false;
  const o = c as Record<string, unknown>;
  if (typeof o.name !== "string" || o.name.length === 0) return false;
  if (!Array.isArray(o.series) || o.series.length < 2) return false;
  return o.series.every(validatePoint);
}

async function runAgent(
  client: Anthropic,
  userPrompt: string,
): Promise<Anthropic.Message> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    // Stream the response — agentic loops with adaptive thinking + multiple
    // tool roundtrips can exceed the SDK's 10-minute non-streaming HTTP
    // timeout. Streaming keeps the connection alive across long generations
    // and tool calls; finalMessage() returns the complete Message once done.
    const stream = client.messages.stream({
      model: MODEL,
      // 32K output budget — adaptive thinking + multiple tool_use blocks
      // count against this cap alongside the final JSON. Empirically saw
      // ~13.5K output tokens hit max_tokens at 8192, with no final text
      // emitted because the budget was exhausted on thinking + tool calls.
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        { type: "web_search_20260209", name: "web_search" },
        { type: "web_fetch_20260209", name: "web_fetch" },
      ],
      messages,
    });
    const response = await stream.finalMessage();

    console.log(
      `[polls] iter ${i + 1}: stop_reason=${response.stop_reason} ` +
        `input=${response.usage.input_tokens} output=${response.usage.output_tokens} ` +
        `cache_read=${response.usage.cache_read_input_tokens ?? 0}`,
    );

    if (response.stop_reason === "end_turn") return response;
    if (response.stop_reason === "pause_turn") {
      // Server-side tool hit iteration limit; resend to continue.
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason === "refusal") {
      throw new Error("model refused to produce polling data");
    }
    return response;
  }
  throw new Error(`exceeded ${MAX_TOOL_ITERATIONS} pause_turn iterations`);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic();
  const today = new Date().toISOString().slice(0, 10);
  const userPrompt = `Today's date: ${today}.\n\nBrowse NESDC and Korean polling sources for 2026 Seoul mayoral election polls fielded between November 2025 and today. Group weekly. Return the JSON object per your instructions.`;

  console.log(`[polls] starting NESDC scrape (model=${MODEL})`);
  const response = await runAgent(client, userPrompt);

  // Concatenate all final text blocks (some agents emit reasoning + JSON across blocks)
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("model returned no text");

  let parsed: ModelResult;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch (err) {
    throw new Error(
      `failed to parse JSON from model output: ${(err as Error).message}\n` +
        `First 500 chars of response:\n${text.slice(0, 500)}`,
    );
  }

  if (!Array.isArray(parsed.candidates) || parsed.candidates.length === 0) {
    throw new Error(
      `model found no candidates with sufficient data. method_notes: "${parsed.method_notes ?? "(none)"}"`,
    );
  }

  // Coerce any YYYY-MM-DD `t` values to RFC-3339 date-time before validating.
  for (const c of parsed.candidates) {
    if (c && Array.isArray((c as PollCandidate).series)) {
      for (const pt of (c as PollCandidate).series) {
        if (pt && typeof pt.t === "string") pt.t = normalizeT(pt.t);
      }
    }
  }

  const validCandidates = parsed.candidates.filter(validateCandidate);
  if (validCandidates.length === 0) {
    throw new Error("no candidates passed validation; not overwriting aggregate.json");
  }

  // Sort each candidate's series by date asc
  for (const c of validCandidates) {
    c.series.sort((a, b) => a.t.localeCompare(b.t));
  }

  const aggregate: PollAggregate = {
    event_slug: "2026-seoul-mayor",
    captured_at: parsed.captured_at ?? new Date().toISOString(),
    method: "nesdc_scrape",
    method_notes:
      parsed.method_notes ??
      "Scraped via Claude agent browsing NESDC and Korean pollster summaries.",
    interval: "1w",
    candidates: validCandidates,
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(aggregate, null, 2) + "\n");
  console.log(
    `[polls] wrote ${path.relative(ROOT, OUT)} — ${aggregate.candidates.length} candidates, ` +
      `${aggregate.candidates.reduce((s, c) => s + c.series.length, 0)} weekly points`,
  );
}

main().catch((err) => {
  console.error("[polls] scrape failed:", err);
  process.exit(1);
});
