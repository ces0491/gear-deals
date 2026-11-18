/**
 * Builds the catalogue the browser tests run against, test/fixtures/site/, from the real
 * data/catalogue.json: `npm run fixtures:catalogue`.
 *
 * The live catalogue changes every morning, so tests against it would break daily. This
 * picks a small fixed set of real products that covers every state the pages show (each
 * deal reason, a match across stores, out of stock, products that aren't deals), and adds
 * made-up price history to a few so the tracked-drop deal, the long-running was-price
 * note and the price chart all appear. Deals are then recomputed with the real rules.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { HistoryFile, Product, ProductHistory } from "../src/lib/catalogue/types";
import { addDays } from "../src/lib/dates";
import { dealFor } from "../src/lib/deals/deals";
import { findMatches } from "../src/lib/deals/match";
import { parseCatalogue, stringifyCatalogue, stringifyHistory } from "../src/lib/scrape/files";

const source = parseCatalogue(readFileSync(join(process.cwd(), "data", "catalogue.json"), "utf8"));
const today = source.pricedOn;
const byId = new Map(source.products.map((p) => [p.id, p]));
const picked = new Map<string, Product>();

function take(products: Product[], n: number) {
  for (const p of products) {
    if (n <= 0) return;
    if (!picked.has(p.id)) {
      picked.set(p.id, p);
      n -= 1;
    }
  }
}

const sorted = [...source.products].sort((a, b) => (a.id < b.id ? -1 : 1));
const has = (p: Product, kind: string) => p.deal?.reasons.some((r) => r.kind === kind) ?? false;

// Biggest store was-price deals, a spread of stores.
take(
  [...sorted].filter((p) => p.inStock && has(p, "was-price")).sort((a, b) => (b.deal?.savingZar ?? 0) - (a.deal?.savingZar ?? 0)),
  8,
);
// Every pair behind a cheaper-elsewhere deal.
for (const p of sorted.filter((p) => has(p, "cheaper-elsewhere")).slice(0, 3)) {
  picked.set(p.id, p);
  const r = p.deal?.reasons.find((x) => x.kind === "cheaper-elsewhere");
  const other = r && r.kind === "cheaper-elsewhere" ? byId.get(r.otherProductId) : undefined;
  if (other) picked.set(other.id, other);
}
take(sorted.filter((p) => has(p, "clearance")), 3);
take(sorted.filter((p) => !p.inStock && p.deal), 2);
take(sorted.filter((p) => !p.inStock && !p.deal), 2);
// Products that aren't deals, a few categories.
for (const category of ["fridges", "tents", "kitchen", "recovery", "camp-lighting", "rooftop-tents"]) {
  take(sorted.filter((p) => p.inStock && !p.deal && p.category === category), 2);
}

// Made-up history: two products whose price dropped a few days ago, and one whose
// was-price has been shown for 90 days.
const history: Record<string, ProductHistory> = {};
for (const p of picked.values()) {
  history[p.id] = { firstSeen: today, lastSeen: today, points: [{ on: today, priceZar: p.priceZar, wasZar: p.wasZar }] };
}
const quiet = [...picked.values()].filter((p) => p.inStock && !p.deal && p.wasZar === null);
for (const p of quiet.slice(0, 2)) {
  const before = Math.round(p.priceZar * 1.25);
  history[p.id] = {
    firstSeen: addDays(today, -40),
    lastSeen: today,
    points: [
      { on: addDays(today, -40), priceZar: before, wasZar: null },
      { on: addDays(today, -4), priceZar: p.priceZar, wasZar: null },
    ],
  };
}
const longSale = [...picked.values()].find((p) => p.inStock && p.wasZar !== null && p.storeId !== "ironman");
if (longSale) {
  history[longSale.id] = {
    firstSeen: addDays(today, -90),
    lastSeen: today,
    points: [{ on: addDays(today, -90), priceZar: longSale.priceZar, wasZar: longSale.wasZar }],
  };
}

const chosen = [...picked.values()];
const matches = findMatches(chosen);
const chosenById = new Map(chosen.map((p) => [p.id, p]));
const products = chosen
  .map((p) => ({
    ...p,
    firstSeen: history[p.id].firstSeen,
    deal: dealFor(p, history[p.id], (matches.get(p.id) ?? []).map((id) => chosenById.get(id)!).filter(Boolean), today),
  }))
  .sort((a, b) => (a.id < b.id ? -1 : 1));

const storeIds = new Set(products.map((p) => p.storeId));
const catalogue = {
  ...source,
  stores: Object.fromEntries(Object.entries(source.stores).filter(([id]) => storeIds.has(id as Product["storeId"]))),
  products,
};
const historyFile: HistoryFile = { version: 1, startedOn: addDays(today, -90), products: history };

const out = join(process.cwd(), "test", "fixtures", "site");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "catalogue.json"), stringifyCatalogue(catalogue));
writeFileSync(join(out, "history.json"), stringifyHistory(historyFile));
const kinds = new Map<string, number>();
for (const p of products) for (const r of p.deal?.reasons ?? []) kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
console.log(`Wrote ${products.length} products from ${storeIds.size} stores; reasons: ${JSON.stringify(Object.fromEntries(kinds))}`);
