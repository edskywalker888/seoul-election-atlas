# Data Dictionary (code repo)

The authoritative data dictionary lives in the Obsidian vault at `~/Desktop/Seoul Election Atlas/03 Data Model/Entity Definitions.md`. This file is a pointer plus engineering-specific notes.

## Quick reference

| Entity | Schema | TS type | Path |
|---|---|---|---|
| Election | `schemas/election.schema.json` | `Election` | `data/processed/elections/<election_id>.json` |
| District | `schemas/district.schema.json` | `District` | `data/processed/districts/<district_id>.json` |
| DistrictResult | `schemas/result.schema.json` | `DistrictResult` | `data/processed/results/<election_id>/<district_id>.json` |
| ElectionIssues | `schemas/issue.schema.json` | `ElectionIssues` | `data/processed/issues/<election_id>/election.json` |
| DistrictIssues | `schemas/issue.schema.json` | `DistrictIssues` | `data/processed/issues/<election_id>/<district_id>.json` |
| Party | — (JSON, TS type only) | `Party` | `data/processed/parties/<party_id>.json` |
| SourceMetadata | `schemas/source.schema.json` | `SourceMetadata` | `data/processed/mappings/sources.json` |

## Rules for engineers
- **Never edit `data/processed/*` by hand.** It's regenerated from `data/raw/*` via `scripts/transform`.
- **Never edit `data/raw/*`** after capture. Append new captures, don't mutate.
- **Keep TS types in sync with schemas.** When adding a field, update both.
- **Percentages are numbers, not strings.** Formatting happens at display only.
- **IDs are stable strings** — lowercase, ASCII, hyphen-separated.

## Party colors

Party objects live at `data/processed/parties/<party_id>.json` and follow this shape:

```json
{
  "party_id": "dpk",
  "display_name_en": "Democratic Party of Korea",
  "display_name_ko": "더불어민주당",
  "family": "liberal",
  "colors": {
    "default": "#005BAC",
    "2024": "#005BAC",
    "2020": "#004EA2"
  }
}
```

Resolution order in `lib/colorFor.ts`: `colors[year] ?? colors.default ?? family fallback`.
