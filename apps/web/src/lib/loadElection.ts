import { promises as fs } from "node:fs";
import path from "node:path";
import type { Election } from "@/types";
import { DATA_DIR } from "./paths";

const ELECTIONS_DIR = path.join(DATA_DIR, "elections");

export async function loadElection(electionId: string): Promise<Election> {
  const file = path.join(ELECTIONS_DIR, `${electionId}.json`);
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as Election;
}

export async function tryLoadElection(
  electionId: string,
): Promise<Election | null> {
  try {
    return await loadElection(electionId);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function listElections(): Promise<Election[]> {
  const entries = await fs.readdir(ELECTIONS_DIR).catch(() => [] as string[]);
  const elections = await Promise.all(
    entries
      .filter((f) => f.endsWith(".json"))
      .map((f) => loadElection(f.replace(/\.json$/, ""))),
  );
  return elections.sort((a, b) => b.date.localeCompare(a.date));
}
