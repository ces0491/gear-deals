/**
 * Rebuilds data/catalogue.json from itself under the current rules and registry, without
 * reading any store: `npm run recategorise`. Use it after changing the category rules
 * (src/lib/catalogue/categories.ts) or turning a store off. Products the rules now leave
 * out, and products of stores no longer read, are dropped, and deals and cross-store
 * matches are worked out again. Prices, their date and the price history don't change.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parseCatalogue, parseHistory, stringifyCatalogue } from "../src/lib/scrape/files";
import { runScrape } from "../src/lib/scrape/run";
import { enabledStores } from "../src/lib/stores/registry";

const CATALOGUE_PATH = join(process.cwd(), "data", "catalogue.json");
const HISTORY_PATH = join(process.cwd(), "data", "history.json");

async function main() {
  const before = parseCatalogue(readFileSync(CATALOGUE_PATH, "utf8"));
  const result = await runScrape({
    stores: [],
    read: () => Promise.reject(new Error("recategorise reads no store")),
    previous: before,
    history: parseHistory(readFileSync(HISTORY_PATH, "utf8")),
    keep: enabledStores().map((s) => s.id),
    // The catalogue's own time, so its date and the deals' "today" stay as they were.
    now: new Date(before.generatedAt),
  });
  if (result.sanityFailures.length > 0) {
    console.error("Sanity checks failed; not writing the catalogue:");
    for (const f of result.sanityFailures) console.error(`  ${f}`);
    process.exit(2);
  }

  const after = result.catalogue;
  const was = new Map(before.products.map((p) => [p.id, p]));
  const moved = after.products.filter((p) => was.has(p.id) && was.get(p.id)?.category !== p.category).length;
  const gone = new Set(before.products.map((p) => p.storeId).filter((id) => !after.stores[id]));
  writeFileSync(CATALOGUE_PATH, stringifyCatalogue(after));
  console.log(
    `Moved ${moved} products to another category and dropped ${before.products.length - after.products.length}` +
      `${gone.size > 0 ? ` (including every product from ${[...gone].join(", ")}, no longer read)` : ""}; ` +
      `${after.products.length} remain, ${after.products.filter((p) => p.deal).length} of them deals.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
