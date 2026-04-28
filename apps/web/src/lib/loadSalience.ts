import { promises as fs } from "node:fs";
import path from "node:path";
import type { SalienceSnapshot, SalienceTopic } from "@/types";
import { DATA_DIR } from "./paths";

const SALIENCE_DIR = path.join(DATA_DIR, "salience");

export async function listSnapshots(): Promise<SalienceSnapshot[]> {
  const entries = await fs.readdir(SALIENCE_DIR).catch(() => [] as string[]);
  const snapshots = await Promise.all(
    entries
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        const raw = await fs.readFile(path.join(SALIENCE_DIR, f), "utf-8");
        return JSON.parse(raw) as SalienceSnapshot;
      }),
  );
  // Newest first
  return snapshots.sort((a, b) =>
    b.captured_at.localeCompare(a.captured_at),
  );
}

export interface RankedTopic extends SalienceTopic {
  prev_rank?: number;
  /** positive = moved UP in ranking (lower number is better); 0 = same; negative = moved DOWN; undefined = brand-new */
  rank_change?: number;
  is_new?: boolean;
}

export interface SalienceView {
  current: SalienceSnapshot;
  previous?: SalienceSnapshot;
  /** Topics from the current snapshot, augmented with rank-change vs the previous snapshot */
  ranked: RankedTopic[];
  /** Topics that were in the previous snapshot but dropped from the current one */
  dropped: SalienceTopic[];
}

/**
 * Loads the latest snapshot and computes rank changes against the immediately
 * preceding one. Topics are matched by `topic_en` (the canonical English label).
 */
export async function loadLatestView(): Promise<SalienceView | null> {
  const all = await listSnapshots();
  if (all.length === 0) return null;
  const [current, previous] = all;

  const prevByTopic = new Map<string, SalienceTopic>();
  if (previous) {
    for (const t of previous.topics) prevByTopic.set(t.topic_en, t);
  }

  const ranked: RankedTopic[] = current.topics
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((t) => {
      const prev = prevByTopic.get(t.topic_en);
      if (!prev) return { ...t, is_new: true };
      return { ...t, prev_rank: prev.rank, rank_change: prev.rank - t.rank };
    });

  const currentTopics = new Set(current.topics.map((t) => t.topic_en));
  const dropped = previous
    ? previous.topics.filter((t) => !currentTopics.has(t.topic_en))
    : [];

  return { current, previous, ranked, dropped };
}
