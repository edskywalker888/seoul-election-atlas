import { promises as fs } from "node:fs";
import path from "node:path";
import type { DistrictResult } from "@/types";
import { DATA_DIR } from "./paths";

const RESULTS_DIR = path.join(DATA_DIR, "results");

export async function loadDistrictResult(
  electionId: string,
  districtId: string,
): Promise<DistrictResult> {
  const file = path.join(RESULTS_DIR, electionId, `${districtId}.json`);
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as DistrictResult;
}

export async function loadElectionResults(
  electionId: string,
): Promise<DistrictResult[]> {
  const dir = path.join(RESULTS_DIR, electionId);
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const results = await Promise.all(
    entries
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        const raw = await fs.readFile(path.join(dir, f), "utf-8");
        return JSON.parse(raw) as DistrictResult;
      }),
  );
  return results.sort((a, b) => a.district_id.localeCompare(b.district_id));
}
