# Architecture (code repo)

This file is the engineering-facing summary. The full architectural rationale lives in the Obsidian vault at `~/Desktop/Seoul Election Atlas/05 Engineering/Architecture.md`.

## Stack
- Next.js 15 (App Router) + TypeScript + Tailwind
- SVG + D3 (`d3-geo`) for map rendering — not a map engine
- JSON Schema as source of truth; TS types in `apps/web/src/types/` mirror them
- Static export; no server runtime needed for MVP

## Data flow
```
data/raw/**           immutable captures (NEC, wiki, news, boundaries)
    ↓ scripts/transform
data/processed/**     schema-validated JSON
    ↓ bundled/imported at build
apps/web              renders map + tooltip + panels
```

## Rules (enforced)
- Raw data is append-only; transforms are idempotent
- Processed JSON validates against `/schemas/*.schema.json` before landing
- Vote percentages stored with full precision; `lib/format.ts` owns display rounding
- Party colors resolved via `lib/colorFor.ts`: `colors[year] ?? colors.default ?? family fallback`
- District boundaries are versioned per election in `data/raw/boundaries/<election_id>/`

## Where things live
- **Routes:** `apps/web/src/app/` (App Router)
- **Features:** `apps/web/src/features/{map,timeline,results,issues}`
- **Shared UI:** `apps/web/src/components/`
- **Types:** `apps/web/src/types/`
- **Utilities:** `apps/web/src/lib/`
- **Schemas:** `/schemas/*.schema.json`
- **Pipelines:** `/scripts/{fetch,transform,validate,export}`

## MVP scope
22nd election, Seoul only. Tooltip, district panel, election issue panel, legend, timeline. Everything else is Phase 2+.
