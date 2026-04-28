# scripts/salience

Twelve-hour capture of top Korean political topics, with sentiment + salience scoring.

## Output
Each run writes `data/processed/salience/<ISO timestamp>.json` matching `schemas/salience-snapshot.schema.json`. The web app's `/salience` route renders the latest two snapshots side-by-side as a scorechart with rank-change indicators.

## Running locally
```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run salience:capture
```

## Implementation notes
- **Model:** `claude-sonnet-4-6` (latest Sonnet, balanced cost / quality for this task)
- **Web search:** `web_search_20260209` (latest version with dynamic filtering — filters results in-context before they hit the response)
- **Structured output:** `output_config.format` with a `json_schema` matching the project's salience-snapshot schema. The model is constrained to return exactly the shape we validate.
- **Prompt caching:** the system prompt is frozen and tagged `cache_control: ephemeral`. Across two-per-day runs the prefix caches, so each capture pays the cache-read rate (~10% of base input) on the system prompt rather than the full rate.
- **No streaming:** `max_tokens` is small (~4096), well below the SDK timeout threshold.

## Scheduled runs
GitHub Actions runs this every 12 hours (`0 0,12 * * *` UTC = 09:00 + 21:00 KST) and commits the new snapshot back to `main`. See `.github/workflows/salience.yml`. Requires the repo secret `ANTHROPIC_API_KEY`.

## Future direction
The "method" field is an enum (`llm_synthesis | rule_based | manual_demo | bigkinds | datalab`) so the salience layer can swap fetchers without changing consumers. The natural next step is BigKinds (Korea Press Foundation's news analytics — gold standard for media salience) or Naver DataLab (search-attention curves). Both need API credentials we don't yet have. When credentials land, drop in a new fetcher that emits the same schema and the UI continues to work.

## Honest caveat
This signal measures **attention** (what coverage and search show), not **influence** (what moves votes). For outcome-relevance, layer post-election survey data (KEPS / 한국선거학회) on top — that's the only signal that connects salience to actual electoral effect.
