# scripts/

Data pipeline entrypoints.

## Stages
- `fetch/` — pull from official NEC, wiki, news, boundary sources → `data/raw/` *(not yet implemented)*
- `transform/` — raw → schema-conformant `data/processed/` *(not yet implemented)*
- `validate/` — JSON Schema + invariants check; CI gate ✅ **implemented**
- `export/` — build-time bundling for the web app *(not yet needed)*

## Running

From the repo root:

```bash
npm run validate
```

Validates every `.json` file under `data/processed/` against its JSON Schema in `/schemas/`, plus cross-file invariants:

- `vote_pct` sum per district result within `[99, 101]`
- Every `winner_party_id` and candidate `party_id` exists in `data/processed/parties/`
- Every `winner_candidate` appears in the candidates list
- Every result's `district_id` has a matching feature in the election's boundary GeoJSON
- `election_id` in each result matches its containing directory

Exit code: `0` on success, `1` on validation failures, `2` on crash. Wire this into CI as a merge gate.

## Not yet enforced (deferred)

- `issue.tag` values matching the Issue Taxonomy (taxonomy lives in the vault as markdown — needs a JSON export)
- `source_ids` referenced from issues existing in `data/processed/mappings/sources.json` (no sources registry yet)
- Boundary GeoJSON schema (using GeoJSON spec implicitly for now)

See `docs/architecture.md` and the Obsidian vault's `05 Engineering/ETL Plan.md`.
