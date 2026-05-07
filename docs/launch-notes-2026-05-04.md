# Launch notes — 2026-05-04

End-to-end deploy of Seoul Election Atlas to Vercel, plus the last set of fixes that got the live-signals pipeline producing real data instead of demo seeds.

**Live:** https://seoul-election-atlas-web.vercel.app
**Repo:** https://github.com/edskywalker888/seoul-election-atlas

## What's running

Three live signal layers, all rendering on the landing page over the Seoul gu choropleth:

| Layer | Source | Cadence | Method |
|---|---|---|---|
| Salience tracker | Sonnet 4.6 + `web_search` | every 12h | LLM synthesis from Korean political coverage |
| Prediction-market history | Polymarket gamma + Kalshi v2 | every 12h | direct API capture |
| Poll aggregate (NESDC) | Sonnet 4.6 + `web_search` + `web_fetch` | every 12h | agentic scrape of NESDC + pollster summaries |

GitHub Actions cron runs all three captures, validates the JSON against schemas, commits the snapshots, and pushes to `main`. Vercel auto-redeploys on every push, so the site stays current without any manual touch.

## The four CLI failures we fixed today, in order

Each workflow run got further into the agent's lifecycle before failing — not flaky CLI, just a sequence of distinct issues.

### 1. Schema rejected — `minItems: 8`

```
For 'array' type, 'minItems' values other than 0 or 1 are not supported
```

Anthropic structured outputs only accept `minItems: 0 | 1`. Fixed by stripping `minItems: 8`/`maxItems: 8` from the salience snapshot schema; semantic constraints (rank 1–8) are pinned in the system prompt instead.

### 2. Schema rejected — `minimum`/`maximum` on numbers

```
For 'integer' type, properties maximum, minimum are not supported
```

Same family — Anthropic structured outputs reject `minimum`, `maximum`, `minLength`, `maxLength`, `format`, and `multipleOf`. Stripped all of them from the schema. The schema is now structural-only; bounds live in the prompt.

### 3. Validate failed — Kalshi `end_date` was null

```
Kalshi snapshot missing required end_date
```

Kalshi's `expected_expiration_time` field came back `null` for the Seoul mayor market. Added a `SEOUL_MAYOR_2026_END = "2026-06-03T09:00:00Z"` fallback constant and changed the type to `string | null` to match the API.

### 4. Polls scrape — `APIConnectionTimeoutError` after 15min

The Anthropic SDK's default non-streaming HTTP timeout is 10 minutes. The polls scraper uses an agentic loop with adaptive thinking + `web_search` + `web_fetch` over a long-running multi-roundtrip session, which routinely runs longer than 10min. Switched from `client.messages.create()` to `client.messages.stream()` + `stream.finalMessage()` to keep the connection alive across long generations and tool calls.

Commit: `611a7a2 polls: stream agent response to avoid 10min SDK timeout`

### 5. Polls scrape — `stop_reason=max_tokens`

Streaming worked (51-min generation completed), but `max_tokens: 8192` was too tight for an adaptive-thinking agent. Thinking blocks, server `tool_use` blocks, and the final JSON all share the budget; the agent burned ~13.5K tokens on thinking + searches and never got to emit the JSON. Bumped to `max_tokens: 32000`.

### 6. Validate failed — `t` not in `date-time` format

```
data/candidates/0/series/0/t must match format "date-time"
```

The poll-aggregate schema declares `series[].t` as `format: "date-time"` (full RFC-3339 with `T..Z`), but Sonnet 4.6 occasionally interpreted "ISO date" in the prompt as a plain calendar date and emitted `"2025-11-03"`. Two fixes:

1. Tightened the prompt schema example to `"ISO 8601 datetime, e.g. 2025-11-03T00:00:00Z"`.
2. Added `normalizeT()` in the script as a belt-and-braces fallback — coerces any `YYYY-MM-DD` to `YYYY-MM-DDT00:00:00Z` before validation.

Commit: `415b6a9 polls: normalize date-only t values to RFC-3339 date-time`

### 7. Vercel build — `useSearchParams()` not in Suspense

```
useSearchParams() should be wrapped in a suspense boundary at page "/"
Error occurred prerendering page "/"
```

`next dev` tolerates `useSearchParams()` at the page root; `next build` does not. Next 15 fails the prerender of any path containing the hook unless the calling component is inside a `<Suspense>` boundary. `MapCanvas` reads `?district=` for deep-linkable selection, so wrapping it in `<Suspense fallback={null}>` inside `MapView` keeps prerender working without pulling Suspense up to the page root or making the whole map a client-only island.

Commit: `f84e504 web: wrap MapCanvas in Suspense to fix Next 15 prerender`

## Vercel project settings

- Root Directory: `apps/web`
- Build Command: `next build` (auto-detected)
- Framework: Next.js 15
- Auto-deploy on push to `main`: enabled
- Production URL: `seoul-election-atlas-web.vercel.app`
- Bot commits from the Signals capture workflow trigger redeploys automatically

## Cost snapshot

| Component | Estimated $/mo |
|---|---|
| Salience capture (Sonnet 4.6, 12h cadence, prompt-cached) | ~$2 |
| Polls scrape (Sonnet 4.6, agentic, 12h cadence) | ~$5–10 |
| Markets capture (no LLM) | $0 |
| Vercel Hobby tier | $0 |
| GitHub Actions runners (well under free tier) | $0 |
| **Total** | **~$7–12/mo** |

## Open follow-ups

- `actions/checkout@v4` and `actions/setup-node@v4` will be forced to Node 24 by GitHub on 2026-06-02. Bump the workflow when convenient.
- Polls aggregator stores weekly buckets, which is lossy. For tighter analysis, switch to per-poll storage and aggregate at read time.
- The `data/processed/...` files are read at build time via `process.cwd()` — fine for a static site at this scale, but if data volume grows, move to ISR or a runtime fetch.
