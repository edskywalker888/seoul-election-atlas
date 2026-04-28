#!/usr/bin/env tsx
/**
 * Validates every file under data/processed/ against its JSON Schema and
 * enforces cross-file invariants. Run via `npm run validate` from repo root.
 * Exit 0 on success, 1 on validation failures, 2 on crash.
 */

import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCHEMAS = path.join(ROOT, "schemas");
const PROCESSED = path.join(ROOT, "data", "processed");

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const errors: string[] = [];
const record = (msg: string) => errors.push(msg);

async function loadSchema(name: string): Promise<ValidateFunction> {
  const raw = await fs.readFile(path.join(SCHEMAS, name), "utf-8");
  return ajv.compile(JSON.parse(raw));
}

async function readJson<T = unknown>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, "utf-8")) as T;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function* walkJson(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkJson(full);
    else if (e.name.endsWith(".json")) yield full;
  }
}

function rel(p: string): string {
  return path.relative(ROOT, p);
}

async function main() {
  const [
    electionSchema,
    districtSchema,
    partySchema,
    resultSchema,
    issueSchema,
    sourceSchema,
    articleSchema,
    upcomingSchema,
    salienceSchema,
    marketSchema,
    marketHistorySchema,
    pollAggregateSchema,
  ] = await Promise.all([
    loadSchema("election.schema.json"),
    loadSchema("district.schema.json"),
    loadSchema("party.schema.json"),
    loadSchema("result.schema.json"),
    loadSchema("issue.schema.json"),
    loadSchema("source.schema.json"),
    loadSchema("article.schema.json"),
    loadSchema("upcoming-election.schema.json"),
    loadSchema("salience-snapshot.schema.json"),
    loadSchema("market-snapshot.schema.json"),
    loadSchema("market-history.schema.json"),
    loadSchema("poll-aggregate.schema.json"),
  ]);

  let fileCount = 0;

  // Parties — also build the set of valid party_ids for invariants.
  const partyIds = new Set<string>();
  for await (const f of walkJson(path.join(PROCESSED, "parties"))) {
    fileCount++;
    const doc = await readJson<{ party_id: string }>(f);
    if (!partySchema(doc)) {
      record(`${rel(f)}: schema — ${ajv.errorsText(partySchema.errors)}`);
    }
    if (partyIds.has(doc.party_id)) {
      record(`${rel(f)}: duplicate party_id "${doc.party_id}"`);
    }
    partyIds.add(doc.party_id);
  }

  // Elections
  for await (const f of walkJson(path.join(PROCESSED, "elections"))) {
    fileCount++;
    const doc = await readJson(f);
    if (!electionSchema(doc)) {
      record(`${rel(f)}: schema — ${ajv.errorsText(electionSchema.errors)}`);
    }
  }

  // Districts
  for await (const f of walkJson(path.join(PROCESSED, "districts"))) {
    fileCount++;
    const doc = await readJson(f);
    if (!districtSchema(doc)) {
      record(`${rel(f)}: schema — ${ajv.errorsText(districtSchema.errors)}`);
    }
  }

  // Results — walk per election and cross-check invariants against the
  // election's boundary file.
  const resultsRoot = path.join(PROCESSED, "results");
  if (await exists(resultsRoot)) {
    const electionDirs = await fs.readdir(resultsRoot);
    for (const electionId of electionDirs) {
      const boundaryFile = path.join(
        PROCESSED,
        "boundaries",
        electionId,
        "seoul.geojson",
      );
      const boundary = (await exists(boundaryFile))
        ? await readJson<{
            features: Array<{ properties?: { district_id?: string } }>;
          }>(boundaryFile)
        : null;
      const districtIds = new Set<string>(
        boundary?.features
          ?.map((f) => f.properties?.district_id)
          .filter((id): id is string => typeof id === "string") ?? [],
      );

      for await (const f of walkJson(path.join(resultsRoot, electionId))) {
        fileCount++;
        const doc = await readJson<{
          election_id: string;
          district_id: string;
          winner_party_id: string;
          winner_candidate: string;
          candidates: Array<{ name: string; party_id: string; vote_pct: number }>;
        }>(f);
        if (!resultSchema(doc)) {
          record(`${rel(f)}: schema — ${ajv.errorsText(resultSchema.errors)}`);
          continue;
        }
        if (doc.election_id !== electionId) {
          record(
            `${rel(f)}: election_id "${doc.election_id}" does not match directory "${electionId}"`,
          );
        }
        const sum = doc.candidates.reduce((a, c) => a + c.vote_pct, 0);
        if (sum < 99 || sum > 101) {
          record(
            `${rel(f)}: vote_pct sum ${sum.toFixed(2)} outside [99, 101]`,
          );
        }
        if (!partyIds.has(doc.winner_party_id)) {
          record(
            `${rel(f)}: winner_party_id "${doc.winner_party_id}" not in /parties`,
          );
        }
        for (const c of doc.candidates) {
          if (!partyIds.has(c.party_id)) {
            record(
              `${rel(f)}: candidate party_id "${c.party_id}" not in /parties`,
            );
          }
        }
        if (!doc.candidates.some((c) => c.name === doc.winner_candidate)) {
          record(
            `${rel(f)}: winner_candidate "${doc.winner_candidate}" not in candidates list`,
          );
        }
        if (boundary && !districtIds.has(doc.district_id)) {
          record(
            `${rel(f)}: district_id "${doc.district_id}" has no geometry in ${rel(boundaryFile)}`,
          );
        }
      }
    }
  }

  // Issues (election and district share a oneOf schema)
  for await (const f of walkJson(path.join(PROCESSED, "issues"))) {
    fileCount++;
    const doc = await readJson(f);
    if (!issueSchema(doc)) {
      record(`${rel(f)}: schema — ${ajv.errorsText(issueSchema.errors)}`);
    }
  }

  // Articles (deep-dive driver articles)
  const articlesRoot = path.join(PROCESSED, "articles");
  if (await exists(articlesRoot)) {
    for await (const f of walkJson(articlesRoot)) {
      fileCount++;
      const doc = await readJson(f);
      if (!articleSchema(doc)) {
        record(`${rel(f)}: schema — ${ajv.errorsText(articleSchema.errors)}`);
      }
    }
  }

  // Market snapshots + history. `history.json` uses a different schema
  // (time-series); ISO-timestamped files are point-in-time snapshots.
  const marketsRoot = path.join(PROCESSED, "markets");
  if (await exists(marketsRoot)) {
    for await (const f of walkJson(marketsRoot)) {
      fileCount++;
      const doc = await readJson(f);
      const isHistory = path.basename(f) === "history.json";
      const schema = isHistory ? marketHistorySchema : marketSchema;
      if (!schema(doc)) {
        record(`${rel(f)}: schema — ${ajv.errorsText(schema.errors)}`);
      }
    }
  }

  // Poll aggregates
  const pollsRoot = path.join(PROCESSED, "polls");
  if (await exists(pollsRoot)) {
    for await (const f of walkJson(pollsRoot)) {
      fileCount++;
      const doc = await readJson(f);
      if (!pollAggregateSchema(doc)) {
        record(
          `${rel(f)}: schema — ${ajv.errorsText(pollAggregateSchema.errors)}`,
        );
      }
    }
  }

  // Salience snapshots
  const salienceRoot = path.join(PROCESSED, "salience");
  if (await exists(salienceRoot)) {
    for await (const f of walkJson(salienceRoot)) {
      fileCount++;
      const doc = await readJson(f);
      if (!salienceSchema(doc)) {
        record(`${rel(f)}: schema — ${ajv.errorsText(salienceSchema.errors)}`);
      }
    }
  }

  // Upcoming elections (single file at root of processed/, list of records)
  const upcomingFile = path.join(PROCESSED, "upcoming-elections.json");
  if (await exists(upcomingFile)) {
    fileCount++;
    const docs = await readJson<unknown>(upcomingFile);
    const list = Array.isArray(docs) ? docs : [docs];
    list.forEach((doc, i) => {
      if (!upcomingSchema(doc)) {
        record(
          `${rel(upcomingFile)}[${i}]: schema — ${ajv.errorsText(upcomingSchema.errors)}`,
        );
      }
    });
  }

  // Sources (one file with an array of source records, if present)
  const sourcesFile = path.join(PROCESSED, "mappings", "sources.json");
  if (await exists(sourcesFile)) {
    fileCount++;
    const docs = await readJson<unknown>(sourcesFile);
    const list = Array.isArray(docs) ? docs : [docs];
    list.forEach((doc, i) => {
      if (!sourceSchema(doc)) {
        record(
          `${rel(sourcesFile)}[${i}]: schema — ${ajv.errorsText(sourceSchema.errors)}`,
        );
      }
    });
  }

  if (errors.length === 0) {
    console.log(`✓ All ${fileCount} processed files valid`);
    process.exit(0);
  }
  console.error(`✗ ${errors.length} validation error(s) across ${fileCount} files:\n`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

main().catch((err) => {
  console.error("Validator crashed:", err);
  process.exit(2);
});
