import { promises as fs } from "node:fs";
import path from "node:path";
import type { PollAggregate } from "@/types";
import { DATA_DIR } from "./paths";

const POLLS_DIR = path.join(DATA_DIR, "polls");

export async function loadPollAggregate(
  eventSlug: string,
): Promise<PollAggregate | null> {
  const file = path.join(POLLS_DIR, eventSlug, "aggregate.json");
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as PollAggregate;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
