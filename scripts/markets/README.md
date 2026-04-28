# scripts/markets

Capture prediction-market prices for upcoming Korean elections. Currently wired for the **2026 Seoul mayoral election** (June 3, 2026, 9th Local Elections).

## Sources
- **Polymarket** — `https://gamma-api.polymarket.com/events?slug=2026-seoul-mayoral-election-winner` (public, no auth). Single event, multiple binary YES/NO markets per candidate.
- **Kalshi** — `https://api.elections.kalshi.com/trade-api/v2/events/KXSEOULMAYOR-26JUN03` (public, no auth). One event with one market per candidate.

Both endpoints are anonymous read-only; no API key required.

## Output
```
data/processed/markets/polymarket/2026-seoul-mayor/<ISO>.json
data/processed/markets/kalshi/2026-seoul-mayor/<ISO>.json
```
Each file matches `schemas/market-snapshot.schema.json` and is validated by `npm run validate`.

## Running locally
```bash
npm run markets:capture
```
No env vars needed. Output goes to the directories above.

## Cadence
Wired into `.github/workflows/salience.yml` to run alongside the salience capture every 12 hours. Markets move faster than salience does, so a finer cadence may be worth it later — change the cron to `0 */6 * * *` for every 6h.

## Why side-by-side
Polymarket is USD-stablecoin-denominated, deeper liquidity, generally more global participation. Kalshi is CFTC-regulated, US-based, narrower participant pool. They price the same event from different liquidity pools, so spread between them is itself a signal: small spread = consensus, large spread = real disagreement. The UI surfaces the consensus / divergence call directly.

## Limitations
- Both platforms are mostly English-speaking — illiquid Korean candidate markets can show stale prices. Always cross-check with `volume_usd` before reading too much into a small market.
- The Romanization → Korean name mapping in `capture.ts` is hand-curated. New candidates that show up will fall back to English-only display until the map is updated.
- "Probability" here means *implied probability* of winning per the market price. This is not the same as a forecast accuracy (markets can be wrong; they're priced expectations).
