# Research Guidelines (code repo)

Full research methodology lives in the Obsidian vault:

- `~/Desktop/Seoul Election Atlas/02 Research/Methodology.md`
- `~/Desktop/Seoul Election Atlas/02 Research/Source Evaluation.md`
- `~/Desktop/Seoul Election Atlas/02 Research/Confidence Workflow.md`

This file is the engineering-facing summary.

## Core separation
- **Facts** (results, turnout, winners, candidates) → `data/processed/results/` + `data/processed/elections/`
- **Interpretation** (drivers, narratives, issues) → `data/processed/issues/`

Never mix. The app joins them by `election_id` + `district_id` at the UI layer only.

## When an engineer touches research data
1. Only via `scripts/transform` or `scripts/validate` — never by hand-editing files in `data/processed/`.
2. Every interpretive claim carries `source_ids` and a `confidence` number.
3. Claims with `confidence < 0.45` must not be surfaced in the UI without an explicit "tentative" label.

## Source tiers (for engineers)
- Tier 1 (official) → used for facts
- Tier 2 (reference: wiki, academic) → used for interpretive synthesis
- Tier 3 (news, commentary) → used for narrative and district drivers

Every source referenced in processed JSON has a matching entry in `data/processed/mappings/sources.json`.
