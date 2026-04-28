import { promises as fs } from "node:fs";
import path from "node:path";
import type { ElectionIssues, DistrictIssues } from "@/types";
import { DATA_DIR } from "./paths";

const ISSUES_DIR = path.join(DATA_DIR, "issues");

async function readJsonOrNull<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function loadElectionIssues(
  electionId: string,
): Promise<ElectionIssues | null> {
  const file = path.join(ISSUES_DIR, electionId, "election.json");
  return readJsonOrNull<ElectionIssues>(file);
}

export async function loadDistrictIssues(
  electionId: string,
  districtId: string,
): Promise<DistrictIssues | null> {
  const file = path.join(ISSUES_DIR, electionId, `${districtId}.json`);
  return readJsonOrNull<DistrictIssues>(file);
}

export async function loadAllDistrictIssues(
  electionId: string,
): Promise<Record<string, DistrictIssues>> {
  const dir = path.join(ISSUES_DIR, electionId);
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const byDistrict: Record<string, DistrictIssues> = {};
  for (const f of entries) {
    if (!f.endsWith(".json") || f === "election.json") continue;
    const raw = await fs.readFile(path.join(dir, f), "utf-8");
    const issues = JSON.parse(raw) as DistrictIssues;
    byDistrict[issues.district_id] = issues;
  }
  return byDistrict;
}
