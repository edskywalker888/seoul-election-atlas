import path from "node:path";

// Server-only. Resolves the repo's data directory relative to the Next.js
// app's cwd. Override via SEA_REPO_ROOT env var when running from elsewhere.
const defaultRepoRoot = path.resolve(process.cwd(), "../..");

export const REPO_ROOT = process.env.SEA_REPO_ROOT ?? defaultRepoRoot;
export const DATA_DIR = path.join(REPO_ROOT, "data", "processed");
