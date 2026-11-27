/**
 * The daily scrape: `npm run scrape` (or `npm run scrape -- --only tentco,eeziawn`).
 * `-- --placements <file>` also writes where each product was placed (category or the
 * reason it was left out), for reviewing the category rules.
 *
 * Reads every enabled store, then writes data/catalogue.json and data/history.json. A
 * store that can't be read, or whose products fail a sanity check, keeps its last good
 * products and the others are written. In GitHub Actions it reports `stores_failed`,
 * `stores_held` and `catalogue_changed` as step outputs so the workflow can name the commit
 * and fail after publishing what did scrape.
 *
 * With --only, the stores not read are kept from the last catalogue. If one of those fails
 * a sanity check (a category rule now drops most of it), nothing is written and it exits 2.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parseCatalogue, parseHistory, stringifyCatalogue, stringifyHistory } from "../src/lib/scrape/files";
import { realHttp } from "../src/lib/scrape/http";
import { runScrape } from "../src/lib/scrape/run";
import { enabledStores, type Store } from "../src/lib/stores/registry";
import { scrapeShopify } from "../src/lib/stores/shopify";
import { scrapeWooCommerce } from "../src/lib/stores/woocommerce";

/** Pause between one store's pages. */
const PAGE_PAUSE_MS = 1_500;

const CATALOGUE_PATH = join(process.cwd(), "data", "catalogue.json");
const HISTORY_PATH = join(process.cwd(), "data", "history.json");

function readOrNull<T>(path: string, parse: (text: string) => T): T | null {
  if (!existsSync(path)) return null;
  try {
    return parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(`Couldn't read ${path}; starting without it.`, error);
    return null;
  }
}

function output(name: string, value: string) {
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${name}=${value}\n`);
}

function flagValue(name: string): string | null {
  const at = process.argv.indexOf(name);
  return at === -1 ? null : (process.argv[at + 1] ?? null);
}

function selectedStores(): Store[] {
  const only = flagValue("--only");
  const stores = enabledStores();
  if (only === null) return stores;
  const wanted = new Set(only.split(","));
  return stores.filter((s) => wanted.has(s.id));
}

async function main() {
  const stores = selectedStores();
  const started = Date.now();
  console.log(`Reading ${stores.length} stores: ${stores.map((s) => s.id).join(", ")}`);

  const selected = new Set(stores.map((s) => s.id));
  const result = await runScrape({
    stores,
    read: (store) =>
      store.platform === "shopify"
        ? scrapeShopify(store, realHttp, PAGE_PAUSE_MS)
        : scrapeWooCommerce(store, realHttp, PAGE_PAUSE_MS),
    previous: readOrNull(CATALOGUE_PATH, parseCatalogue),
    // A partial run (--only) keeps the other stores' products from the last catalogue.
    keep: enabledStores()
      .filter((s) => !selected.has(s.id))
      .map((s) => s.id),
    history: readOrNull(HISTORY_PATH, parseHistory),
    log: (line) => console.log(`  ${line}`),
    collectPlacements: flagValue("--placements") !== null,
  });

  const placementsPath = flagValue("--placements");
  if (placementsPath) {
    writeFileSync(placementsPath, `${result.placements.map((p) => JSON.stringify(p)).join("\n")}\n`);
    console.log(`Wrote ${result.placements.length} placements to ${placementsPath}`);
  }

  if (result.sanityFailures.length > 0) {
    console.error("\nSanity checks failed for stores this run didn't read; not writing the data files:");
    for (const f of result.sanityFailures) console.error(`  ${f}`);
    process.exit(2);
  }

  const { catalogue } = result;
  writeFileSync(CATALOGUE_PATH, stringifyCatalogue(catalogue));
  writeFileSync(HISTORY_PATH, stringifyHistory(result.history));
  const deals = catalogue.products.filter((p) => p.deal).length;
  console.log(
    `\nWrote ${catalogue.products.length} products (${deals} deals) in ${Math.round((Date.now() - started) / 1000)}s; ${
      result.changed ? "prices changed" : "no price changes"
    }.`,
  );

  if (result.heldStores.length > 0) {
    console.error("\nHeld back by the sanity checks; these stores keep their last good prices:");
    for (const held of result.heldStores) for (const f of held.failures) console.error(`  ${held.storeId}: ${f}`);
  }

  output("catalogue_changed", String(result.changed));
  output("stores_failed", result.failedStores.join(","));
  output("stores_held", result.heldStores.map((h) => h.storeId).join(","));
  if (result.failedStores.length + result.heldStores.length === stores.length) {
    console.error("No store's read could be published.");
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
