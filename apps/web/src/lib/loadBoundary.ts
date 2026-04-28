import { promises as fs } from "node:fs";
import path from "node:path";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { DATA_DIR } from "./paths";

export interface DistrictProperties {
  district_id: string;
  name_ko?: string;
  name_en?: string;
  _synthetic?: boolean;
}

export type DistrictBoundary = FeatureCollection<
  Polygon | MultiPolygon,
  DistrictProperties
>;

const BOUNDARIES_DIR = path.join(DATA_DIR, "boundaries");

export async function loadBoundary(
  electionId: string,
  region = "seoul",
): Promise<DistrictBoundary | null> {
  const file = path.join(BOUNDARIES_DIR, electionId, `${region}.geojson`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as DistrictBoundary;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
