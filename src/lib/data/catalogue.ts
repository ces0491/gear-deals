import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { CatalogueFile, HistoryFile, Product, ProductHistory } from "@/lib/catalogue/types";
import { findMatches } from "@/lib/deals/match";
import { parseCatalogue, parseHistory } from "@/lib/scrape/files";

/**
 * The published catalogue and its price history, read once when the server starts.
 *
 * The files only change with a deploy (the daily scrape commits them and the commit
 * deploys), so they're read at module scope: every request in a deployment sees the
 * same data, and with Cache Components the pages that use it prerender into the static
 * shell.
 *
 * `GEAR_DEALS_DATA=fixture` reads the test catalogue instead, for the browser tests.
 * Both paths are literals so the bundler can trace exactly which files a build needs;
 * a path held in an environment variable would make it trace the whole project.
 */
const USE_FIXTURE = process.env.GEAR_DEALS_DATA === "fixture";

const CATALOGUE: CatalogueFile = parseCatalogue(
  readFileSync(
    USE_FIXTURE
      ? join(process.cwd(), "test", "fixtures", "site", "catalogue.json")
      : join(process.cwd(), "data", "catalogue.json"),
    "utf8",
  ),
);

const HISTORY: HistoryFile = parseHistory(
  readFileSync(
    USE_FIXTURE
      ? join(process.cwd(), "test", "fixtures", "site", "history.json")
      : join(process.cwd(), "data", "history.json"),
    "utf8",
  ),
);

const BY_ID = new Map(CATALOGUE.products.map((p) => [p.id, p]));

/** The same rules the scrape used for cheaper-elsewhere deals, so the two never disagree. */
const MATCHES = findMatches(CATALOGUE.products);

export function catalogue(): CatalogueFile {
  return CATALOGUE;
}

export function historyStartedOn(): string {
  return HISTORY.startedOn;
}

export function productById(id: string): Product | null {
  return BY_ID.get(id) ?? null;
}

export function historyOf(id: string): ProductHistory | null {
  return HISTORY.products[id] ?? null;
}

/** The same item at other stores, cheapest first (see src/lib/deals/match.ts for the rules). */
export function sameItemElsewhere(product: Product): Product[] {
  return (MATCHES.get(product.id) ?? [])
    .map((id) => BY_ID.get(id))
    .filter((p): p is Product => p !== undefined)
    .sort((a, b) => a.priceZar - b.priceZar);
}
