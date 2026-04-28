import { promises as fs } from "node:fs";
import path from "node:path";
import type { DriverArticle, SourceMetadata } from "@/types";
import { DATA_DIR } from "./paths";

const ARTICLES_DIR = path.join(DATA_DIR, "articles");

export async function loadArticle(
  electionId: string,
  tag: string,
): Promise<DriverArticle | null> {
  const file = path.join(ARTICLES_DIR, electionId, `${tag}.json`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as DriverArticle;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function listArticleTags(electionId: string): Promise<string[]> {
  const dir = path.join(ARTICLES_DIR, electionId);
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  return entries
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export async function loadSources(): Promise<Record<string, SourceMetadata>> {
  const file = path.join(DATA_DIR, "mappings", "sources.json");
  try {
    const raw = await fs.readFile(file, "utf-8");
    const list = JSON.parse(raw) as SourceMetadata[];
    return Object.fromEntries(list.map((s) => [s.source_id, s]));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}
