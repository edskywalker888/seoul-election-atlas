#!/usr/bin/env tsx
/**
 * Runs axe-core over the dev server against a list of routes.
 * Dev server must be running on http://localhost:3000 before this is invoked.
 * Exit 0 if no violations at WCAG AA, 1 otherwise, 2 on crash.
 */

import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.SEA_BASE_URL ?? "http://localhost:3000";

const ROUTES = [
  { name: "home", path: "/" },
  { name: "election-default", path: "/elections/na-2024-22" },
  {
    name: "election-with-district",
    path: "/elections/na-2024-22?district=seoul-jongno",
  },
  {
    name: "driver-article",
    path: "/elections/na-2024-22/drivers/government_approval",
  },
];

type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;

async function auditRoute(
  name: string,
  url: string,
): Promise<AxeResults["violations"]> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    console.log(
      `[${name}] ${url}: ${results.violations.length} violation${results.violations.length === 1 ? "" : "s"}`,
    );
    return results.violations;
  } finally {
    await browser.close();
  }
}

async function main() {
  let totalViolations = 0;
  const allByRoute: Record<string, AxeResults["violations"]> = {};
  for (const { name, path } of ROUTES) {
    const v = await auditRoute(name, `${BASE}${path}`);
    allByRoute[name] = v;
    totalViolations += v.length;
  }

  console.log(`\n${"=".repeat(60)}\nSummary: ${totalViolations} total violation(s)\n${"=".repeat(60)}`);

  for (const [route, violations] of Object.entries(allByRoute)) {
    if (violations.length === 0) continue;
    console.log(`\n[${route}]`);
    for (const v of violations) {
      console.log(`  ${v.impact?.toUpperCase() ?? "?"} · ${v.id}: ${v.help}`);
      console.log(`    ${v.helpUrl}`);
      for (const node of v.nodes.slice(0, 3)) {
        console.log(`    target: ${node.target.join(" ")}`);
        if (node.failureSummary) {
          console.log(
            "    " +
              node.failureSummary.replace(/\n/g, "\n    ").slice(0, 300),
          );
        }
      }
      if (v.nodes.length > 3) {
        console.log(`    (+ ${v.nodes.length - 3} more node${v.nodes.length - 3 === 1 ? "" : "s"})`);
      }
    }
  }

  process.exit(totalViolations === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Audit crashed:", err);
  process.exit(2);
});
