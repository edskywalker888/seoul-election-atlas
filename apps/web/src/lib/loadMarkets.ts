import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  MarketHistory,
  MarketSnapshot,
  MarketSource,
} from "@/types";
import { DATA_DIR } from "./paths";

const MARKETS_DIR = path.join(DATA_DIR, "markets");

async function listSnapshotsForSource(
  source: MarketSource,
  eventSlug: string,
): Promise<MarketSnapshot[]> {
  const dir = path.join(MARKETS_DIR, source, eventSlug);
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const snapshots = await Promise.all(
    entries
      // Snapshots use ISO-timestamp filenames; history.json is separate.
      .filter((f) => f.endsWith(".json") && f !== "history.json")
      .map(async (f) => {
        const raw = await fs.readFile(path.join(dir, f), "utf-8");
        return JSON.parse(raw) as MarketSnapshot;
      }),
  );
  return snapshots.sort((a, b) =>
    b.captured_at.localeCompare(a.captured_at),
  );
}

async function loadHistoryForSource(
  source: MarketSource,
  eventSlug: string,
): Promise<MarketHistory | null> {
  const file = path.join(MARKETS_DIR, source, eventSlug, "history.json");
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as MarketHistory;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export interface MarketEventView {
  polymarket: MarketSnapshot | null;
  kalshi: MarketSnapshot | null;
  polymarketHistory: MarketHistory | null;
  kalshiHistory: MarketHistory | null;
  /** Top candidate name where both markets agree, if any */
  consensusName?: string;
  /** Absolute pp spread between sources on the agreed top candidate */
  consensusSpread?: number;
}

/**
 * Loads the latest Polymarket and Kalshi snapshots for an event slug
 * (canonical project name like "2026-seoul-mayor"). Computes a small
 * consensus signal so the UI can flag agreement vs divergence.
 */
export async function loadMarketEvent(
  eventSlug: string,
): Promise<MarketEventView> {
  const [polyList, kalList, polyHistory, kalHistory] = await Promise.all([
    listSnapshotsForSource("polymarket", eventSlug),
    listSnapshotsForSource("kalshi", eventSlug),
    loadHistoryForSource("polymarket", eventSlug),
    loadHistoryForSource("kalshi", eventSlug),
  ]);
  const polymarket = polyList[0] ?? null;
  const kalshi = kalList[0] ?? null;

  let consensusName: string | undefined;
  let consensusSpread: number | undefined;
  if (polymarket && kalshi) {
    const polyTop = [...polymarket.candidates].sort(
      (a, b) => b.prob - a.prob,
    )[0];
    const kalTop = [...kalshi.candidates].sort(
      (a, b) => b.prob - a.prob,
    )[0];
    // Match on Korean name when present (Polymarket and Kalshi sometimes
    // disagree on Romanization but the Korean name is canonical).
    const polyKey = polyTop.name_ko ?? polyTop.name;
    const kalKey = kalTop.name_ko ?? kalTop.name;
    if (polyKey === kalKey) {
      consensusName = polyTop.name_ko ?? polyTop.name;
      consensusSpread = Math.abs(polyTop.prob - kalTop.prob);
    }
  }

  return {
    polymarket,
    kalshi,
    polymarketHistory: polyHistory,
    kalshiHistory: kalHistory,
    consensusName,
    consensusSpread,
  };
}
