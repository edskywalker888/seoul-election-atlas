#!/usr/bin/env tsx
/**
 * Captures prediction market snapshots from Polymarket and Kalshi for the
 * 2026 Seoul mayoral election.
 *
 * Both APIs are public read-only — no authentication required.
 *
 * Usage: npm run markets:capture
 *
 * Output:
 *   data/processed/markets/polymarket/2026-seoul-mayor/<ISO>.json
 *   data/processed/markets/kalshi/2026-seoul-mayor/<ISO>.json
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  MarketCandidate,
  MarketCandidateHistory,
  MarketHistory,
  MarketSnapshot,
} from "../../apps/web/src/types/index.js";

const ROOT = process.cwd();
const MARKETS_DIR = path.join(ROOT, "data/processed/markets");
const EVENT_SLUG = "2026-seoul-mayor";

const POLYMARKET_URL =
  "https://gamma-api.polymarket.com/events?slug=2026-seoul-mayoral-election-winner";
const POLYMARKET_PUBLIC_URL =
  "https://polymarket.com/event/2026-seoul-mayoral-election-winner";
const KALSHI_URL =
  "https://api.elections.kalshi.com/trade-api/v2/events/KXSEOULMAYOR-26JUN03";
const KALSHI_PUBLIC_URL =
  "https://kalshi.com/markets/kxseoulmayor/who-will-win-the-seoul-mayoral-election/kxseoulmayor-26jun03";

// Hand-curated mapping from Romanized names to Korean + party_id.
// Both platforms use English names; we want consistent metadata.
const NAME_MAP: Record<string, { ko: string; party_id: string }> = {
  "Oh Se-hoon": { ko: "오세훈", party_id: "ppp" },
  "Chong Won-oh": { ko: "정원오", party_id: "dpk" },
  "Chong Won-o": { ko: "정원오", party_id: "dpk" },
  "Cho Eun-hee": { ko: "조은희", party_id: "ppp" },
  "Ahn Cheol-soo": { ko: "안철수", party_id: "ppp" },
  "Park Yong-jin": { ko: "박용진", party_id: "dpk" },
  "Hong Ihk-pyo": { ko: "홍익표", party_id: "dpk" },
  "Cho Kuk": { ko: "조국", party_id: "rebuild" },
  "Kang Hoon-sik": { ko: "강훈식", party_id: "dpk" },
  "Park Ju-min": { ko: "박주민", party_id: "dpk" },
  "Seo Young-kyo": { ko: "서영교", party_id: "dpk" },
  "Kim Min-seok": { ko: "김민석", party_id: "dpk" },
  "Na Kyung-won": { ko: "나경원", party_id: "ppp" },
};

function enrich(name: string): { name_ko?: string; party_id?: string } {
  const m = NAME_MAP[name];
  if (!m) return {};
  return { name_ko: m.ko, party_id: m.party_id };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "seoul-atlas/0.1" },
  });
  if (!res.ok) {
    throw new Error(`${url} → HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

interface PolymarketEvent {
  id: string | number;
  slug: string;
  title: string;
  endDate: string;
  liquidity?: number;
  volume?: number;
  markets: Array<{
    id?: string | number;
    question: string;
    slug?: string;
    groupItemTitle?: string;
    outcomes?: string;
    outcomePrices?: string;
    lastTradePrice?: number;
    bestBid?: number;
    bestAsk?: number;
    volume?: number;
    volumeNum?: number;
    liquidity?: number;
    liquidityNum?: number;
    active?: boolean;
    closed?: boolean;
  }>;
}

async function capturePolymarket(capturedAt: string): Promise<MarketSnapshot> {
  const events = await fetchJson<PolymarketEvent[]>(POLYMARKET_URL);
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error("Polymarket: no event in response");
  }
  const event = events[0];

  const candidates: MarketCandidate[] = [];
  for (const m of event.markets) {
    if (m.closed === true) continue;
    if (m.active === false) continue;
    const name = m.groupItemTitle ?? m.question;
    if (!name) continue;
    const prob =
      typeof m.lastTradePrice === "number"
        ? m.lastTradePrice
        : (() => {
            try {
              const prices = m.outcomePrices ? JSON.parse(m.outcomePrices) : null;
              return Array.isArray(prices) && prices.length >= 1
                ? Number(prices[0])
                : 0;
            } catch {
              return 0;
            }
          })();
    const volume_usd =
      typeof m.volumeNum === "number"
        ? m.volumeNum
        : typeof m.volume === "number"
          ? m.volume
          : undefined;
    // Skip dust markets unless they have meaningful volume
    if (prob < 0.001 && (!volume_usd || volume_usd < 1000)) continue;
    candidates.push({
      name,
      ...enrich(name),
      prob: Number(prob.toFixed(4)),
      volume_usd,
      market_id: String(m.id ?? m.slug ?? name),
    });
  }
  candidates.sort((a, b) => b.prob - a.prob);

  return {
    captured_at: capturedAt,
    source: "polymarket",
    event_id: String(event.id),
    event_slug: event.slug,
    event_url: POLYMARKET_PUBLIC_URL,
    event_title: event.title,
    end_date: event.endDate ?? SEOUL_MAYOR_2026_END,
    total_volume_usd: event.volume,
    total_liquidity_usd: event.liquidity,
    candidates,
    method_notes:
      "Captured live from Polymarket gamma API. Prob = last_trade_price (binary YES contract).",
  };
}

// Election date is statutorily fixed (June 3, 2026, 18:00 KST = 09:00 UTC).
// Used as a fallback when the API doesn't return expected_expiration_time.
const SEOUL_MAYOR_2026_END = "2026-06-03T09:00:00Z";

interface KalshiResponse {
  event: {
    event_ticker: string;
    title: string;
    sub_title?: string;
    status: string;
    expected_expiration_time?: string | null;
  };
  markets: Array<{
    ticker: string;
    title?: string;
    yes_sub_title?: string;
    status: string;
    yes_bid_dollars?: string | number;
    yes_ask_dollars?: string | number;
    last_price_dollars?: string | number;
    volume_fp?: string | number;
    open_interest_fp?: string | number;
  }>;
}

function nameFromKalshi(market: KalshiResponse["markets"][0]): string {
  // Title looks like "Will Oh Se-hoon win the 2026 Seoul mayoral election?"
  const t = market.yes_sub_title ?? market.title ?? "";
  const m = t.match(/^Will\s+(.+?)\s+win/i);
  return m ? m[1] : t;
}

function num(v: string | number | undefined): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : undefined;
}

async function captureKalshi(capturedAt: string): Promise<MarketSnapshot> {
  const data = await fetchJson<KalshiResponse>(KALSHI_URL);

  const candidates: MarketCandidate[] = data.markets
    .filter((m) => m.status === "active")
    .map((m) => {
      const name = nameFromKalshi(m);
      const last = num(m.last_price_dollars) ?? 0;
      return {
        name,
        ...enrich(name),
        market_id: m.ticker,
        prob: Number(last.toFixed(4)),
        yes_bid: num(m.yes_bid_dollars),
        yes_ask: num(m.yes_ask_dollars),
        last_price: last,
        volume_usd: num(m.volume_fp),
      };
    });
  candidates.sort((a, b) => b.prob - a.prob);

  return {
    captured_at: capturedAt,
    source: "kalshi",
    event_id: data.event.event_ticker,
    event_slug: "kxseoulmayor-26jun03",
    event_url: KALSHI_PUBLIC_URL,
    event_title: data.event.title,
    end_date: data.event.expected_expiration_time ?? SEOUL_MAYOR_2026_END,
    candidates,
    method_notes:
      "Captured live from Kalshi v2 API. Each candidate is a separate binary YES/NO market; prob = last_price_dollars.",
  };
}

async function writeSnapshot(snapshot: MarketSnapshot): Promise<string> {
  const dir = path.join(MARKETS_DIR, snapshot.source, EVENT_SLUG);
  await fs.mkdir(dir, { recursive: true });
  const filename =
    snapshot.captured_at.replace(/[:.]/g, "-").replace(/-\d{3}Z$/, "Z") +
    ".json";
  const out = path.join(dir, filename);
  await fs.writeFile(out, JSON.stringify(snapshot, null, 2) + "\n");
  return path.relative(ROOT, out);
}

async function fetchPolymarketHistory(
  capturedAt: string,
  topCandidates: MarketCandidate[],
): Promise<MarketHistory> {
  // Polymarket prices-history needs the YES token ID. Re-fetch the event so
  // we don't have to hardcode token IDs as they evolve.
  const events = await fetchJson<PolymarketEvent[]>(POLYMARKET_URL);
  const event = events[0];
  const tokenByName = new Map<string, string>();
  for (const m of event.markets) {
    const name = m.groupItemTitle ?? m.question;
    if (!name || !m.clobTokenIds) continue;
    try {
      const ids = JSON.parse(m.clobTokenIds);
      if (Array.isArray(ids) && ids.length >= 1) {
        // First token is the YES side
        tokenByName.set(name, String(ids[0]));
      }
    } catch {
      // skip malformed
    }
  }

  const candidates: MarketCandidateHistory[] = [];
  for (const c of topCandidates) {
    const token = tokenByName.get(c.name);
    if (!token) continue;
    try {
      const url = `https://clob.polymarket.com/prices-history?market=${token}&interval=all&fidelity=1440`;
      const data = await fetchJson<{ history: Array<{ t: number; p: number }> }>(
        url,
      );
      candidates.push({
        name: c.name,
        name_ko: c.name_ko,
        party_id: c.party_id,
        market_id: token,
        series: data.history.map(({ t, p }) => ({
          t: new Date(t * 1000).toISOString().replace(/\.\d{3}Z$/, "Z"),
          p: Number(p.toFixed(4)),
        })),
      });
    } catch (err) {
      console.error(`[markets] poly history ${c.name} failed:`, err);
    }
  }

  return {
    source: "polymarket",
    event_id: String(event.id),
    event_slug: event.slug,
    captured_at: capturedAt,
    interval: "1d",
    candidates,
  };
}

async function fetchKalshiHistory(
  capturedAt: string,
  topCandidates: MarketCandidate[],
): Promise<MarketHistory> {
  const startTs = Math.floor(Date.parse("2025-11-13") / 1000);
  const endTs = Math.floor(Date.now() / 1000);

  const candidates: MarketCandidateHistory[] = [];
  for (const c of topCandidates) {
    if (!c.market_id) continue;
    try {
      const url = `https://api.elections.kalshi.com/trade-api/v2/series/KXSEOULMAYOR/markets/${c.market_id}/candlesticks?period_interval=1440&start_ts=${startTs}&end_ts=${endTs}`;
      const data = await fetchJson<{
        candlesticks: Array<{
          end_period_ts: number;
          price: { close_dollars: string | null };
        }>;
      }>(url);
      // Carry-forward across no-trade days (Kalshi returns null close).
      let lastPrice: number | null = null;
      const series: { t: string; p: number }[] = [];
      for (const cs of data.candlesticks) {
        const v = cs.price?.close_dollars;
        const parsed = v == null ? NaN : parseFloat(v);
        const p = Number.isFinite(parsed) ? parsed : lastPrice;
        if (p == null) continue;
        lastPrice = p;
        series.push({
          t: new Date(cs.end_period_ts * 1000)
            .toISOString()
            .replace(/\.\d{3}Z$/, "Z"),
          p: Number(p.toFixed(4)),
        });
      }
      candidates.push({
        name: c.name,
        name_ko: c.name_ko,
        party_id: c.party_id,
        market_id: c.market_id,
        series,
      });
    } catch (err) {
      console.error(`[markets] kalshi history ${c.name} failed:`, err);
    }
  }

  return {
    source: "kalshi",
    event_id: "KXSEOULMAYOR-26JUN03",
    event_slug: "kxseoulmayor-26jun03",
    captured_at: capturedAt,
    interval: "1d",
    candidates,
  };
}

async function writeHistory(history: MarketHistory): Promise<string> {
  const dir = path.join(MARKETS_DIR, history.source, EVENT_SLUG);
  await fs.mkdir(dir, { recursive: true });
  const out = path.join(dir, "history.json");
  await fs.writeFile(out, JSON.stringify(history, null, 2) + "\n");
  return path.relative(ROOT, out);
}

async function main() {
  const capturedAt = new Date().toISOString();
  console.log(`[markets] capturing at ${capturedAt}`);

  // Capture both in parallel; if one fails, continue with the other.
  const [polyResult, kalResult] = await Promise.allSettled([
    capturePolymarket(capturedAt),
    captureKalshi(capturedAt),
  ]);

  let wrote = 0;
  if (polyResult.status === "fulfilled") {
    const out = await writeSnapshot(polyResult.value);
    console.log(`[markets] polymarket → ${out}`);
    wrote++;
  } else {
    console.error("[markets] polymarket failed:", polyResult.reason);
  }

  if (kalResult.status === "fulfilled") {
    const out = await writeSnapshot(kalResult.value);
    console.log(`[markets] kalshi → ${out}`);
    wrote++;
  } else {
    console.error("[markets] kalshi failed:", kalResult.reason);
  }

  if (wrote === 0) {
    console.error("[markets] no snapshots written; exiting non-zero");
    process.exit(1);
  }

  // Refresh history.json for top 2 candidates from each source. These
  // overwrite each capture so the chart shows full series back to market open.
  const polyTop =
    polyResult.status === "fulfilled"
      ? polyResult.value.candidates.slice(0, 2)
      : [];
  const kalTop =
    kalResult.status === "fulfilled"
      ? kalResult.value.candidates.slice(0, 2)
      : [];

  const [polyHistRes, kalHistRes] = await Promise.allSettled([
    polyTop.length > 0
      ? fetchPolymarketHistory(capturedAt, polyTop)
      : Promise.reject(new Error("no polymarket snapshot")),
    kalTop.length > 0
      ? fetchKalshiHistory(capturedAt, kalTop)
      : Promise.reject(new Error("no kalshi snapshot")),
  ]);

  if (polyHistRes.status === "fulfilled") {
    const out = await writeHistory(polyHistRes.value);
    console.log(
      `[markets] polymarket history → ${out} (${polyHistRes.value.candidates
        .map((c) => `${c.name}: ${c.series.length}pts`)
        .join(", ")})`,
    );
  } else {
    console.error("[markets] polymarket history failed:", polyHistRes.reason);
  }

  if (kalHistRes.status === "fulfilled") {
    const out = await writeHistory(kalHistRes.value);
    console.log(
      `[markets] kalshi history → ${out} (${kalHistRes.value.candidates
        .map((c) => `${c.name}: ${c.series.length}pts`)
        .join(", ")})`,
    );
  } else {
    console.error("[markets] kalshi history failed:", kalHistRes.reason);
  }
}

main().catch((err) => {
  console.error("[markets] capture crashed:", err);
  process.exit(1);
});
