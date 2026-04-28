import { promises as fs } from "node:fs";
import path from "node:path";
import type { UpcomingElection } from "@/types";
import { DATA_DIR } from "./paths";

const UPCOMING_FILE = path.join(DATA_DIR, "upcoming-elections.json");

export async function loadUpcomingElections(): Promise<UpcomingElection[]> {
  try {
    const raw = await fs.readFile(UPCOMING_FILE, "utf-8");
    return JSON.parse(raw) as UpcomingElection[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}
