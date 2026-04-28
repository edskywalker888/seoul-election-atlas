# Seoul Election Atlas

Interactive visualization of National Assembly election outcomes across Seoul districts over ~30 years.

## Structure

```
apps/web/       Next.js 15 + TypeScript + Tailwind app
data/raw/       Immutable source captures (official, wiki, news, boundaries)
data/processed/ Schema-validated JSON served to the app
schemas/        JSON Schema definitions (source of truth)
scripts/        fetch / transform / validate / export pipelines
docs/           Engineering docs (architecture, data dictionary, research)
tests/          Test suites
```

Project management, research notes, and design specs live in a separate Obsidian vault at `~/Desktop/Seoul Election Atlas/`.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Core rules

- **Facts vs interpretation are stored separately.** Official NEC results are the source of truth for numbers. Wiki/news feed interpretive notes only.
- **Never overwrite raw data.** `data/raw/` is append-only.
- **Processed data is regenerated from raw** via `scripts/`. Never hand-edit files in `data/processed/`.
- **Every processed JSON validates against its schema** in `/schemas/` before landing.
- **Vote percentages store with full precision** and format to 2 decimals only at the display layer.
- **Party colors resolve** via `party.colors[election_year] ?? party.colors.default`.
- **District boundaries are versioned per election.** There is no single Seoul map.

See `docs/architecture.md` and the Obsidian vault for detail.
