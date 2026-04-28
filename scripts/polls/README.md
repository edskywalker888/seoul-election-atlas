# scripts/polls

Scrape Korean election polling data from NESDC (중앙선거여론조사심의위원회 / National Election Survey Deliberation Commission), the public registry where every Korean election poll must be filed.

NESDC has no public API and is form-driven through a browser. We use a Claude agent (Sonnet 4.6, adaptive thinking, with the `web_search` and `web_fetch` server-side tools) to navigate the registry and pollster summary pages, extract poll filings, and aggregate them into the `PollAggregate` JSON shape the dashboard already consumes.

## Output
```
data/processed/polls/2026-seoul-mayor/aggregate.json
```
matches `schemas/poll-aggregate.schema.json`. The `method` field flips from `manual_demo` (current seed) to `nesdc_scrape` once this script runs successfully — the landing-page banner that warns about demo data hides automatically when method ≠ "manual_demo".

## Running locally
```bash
ANTHROPIC_API_KEY=sk-ant-... npm run polls:scrape
```

## Failure mode
If the scraper can't parse the model's JSON, finds no candidates, or hits a refusal, it **exits non-zero without overwriting** `aggregate.json`. Better to keep the previous good data than write empty real data.

## Cadence
Wired into `.github/workflows/salience.yml`. The same workflow that captures salience and markets every 12h also runs `polls:scrape`. Polls move on roughly weekly cycles, so 12h is generous, but the LLM call is cheap relative to the total signal cadence.

## Cost notes
- Model: `claude-sonnet-4-6` with adaptive thinking + `effort: high`. Sonnet handles "browse two sites and extract a table" cleanly; Opus 4.7 was overkill for this and ~5× more expensive per run. Bump to Opus 4.7 if extraction accuracy regresses on real Korean sources. The system prompt is `cache_control: ephemeral`, so across twice-daily runs the prefix is cached.
- Server-side tools (`web_search_20260209`, `web_fetch_20260209`) — billed at the published Anthropic rate; no separate API key needed.
- Estimated cost at 12h cadence: roughly $5–10/month for this script alone.

## Why an agent and not a static scraper?
NESDC's interface is form-driven and varies. Pollster summary pages each have their own layouts. Korean news outlets re-aggregate filings inconsistently. A traditional scraper would need bespoke parsing per source and would break frequently. An LLM agent can adapt its source and parsing on each run; the cost is tolerable at this cadence.

## Honest limits
- Output is only as accurate as the agent's tool searches. If NESDC rate-limits or pollster pages move, the agent may fall back to less authoritative news summaries — caveats it should record in `method_notes`.
- Fielding-date vs registration-date confusion is a common Korean polling gotcha. The agent is instructed to prefer fielding date.
- Weekly bucketing is lossy compared to per-poll storage. For tighter analysis, store individual filings instead and aggregate at read time. Not built yet.
