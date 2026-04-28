import { promises as fs } from "node:fs";
import path from "node:path";
import type { Party } from "@/types";
import { DATA_DIR } from "./paths";

const PARTIES_DIR = path.join(DATA_DIR, "parties");

export async function loadParty(partyId: string): Promise<Party> {
  const file = path.join(PARTIES_DIR, `${partyId}.json`);
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as Party;
}

// Returns a plain object keyed by party_id so it serializes cleanly across
// the server → client boundary in React Server Components.
export async function loadParties(): Promise<Record<string, Party>> {
  const entries = await fs.readdir(PARTIES_DIR).catch(() => [] as string[]);
  const byId: Record<string, Party> = {};
  for (const f of entries) {
    if (!f.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(PARTIES_DIR, f), "utf-8");
    const party = JSON.parse(raw) as Party;
    byId[party.party_id] = party;
  }
  return byId;
}
