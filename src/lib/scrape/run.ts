/**
 * One scrape run: read every enabled store, normalise, record history, find matches and
 * deals, and check the result before it's published.
 *
 * Each store's pages are read one at a time, so no store sees more than one request in
 * flight from this site. WooCommerce stores are separate hosts and are read in parallel.
 * Shopify stores share Shopify's edge, which rate-limits an address across all its stores,
 * so they're read one after another in a lane of their own.
 */
import { normalise, type NormalisedProduct } from "@/lib/catalogue/normalise";
import { recategorise } from "@/lib/catalogue/recategorise";
import type { CatalogueFile, HistoryFile, Product, StoreRunStatus } from "@/lib/catalogue/types";
import { todayInSouthAfrica } from "@/lib/dates";
import { dealFor } from "@/lib/deals/deals";
import { findMatches } from "@/lib/deals/match";
import { emptyHistory, recordDay } from "@/lib/history/history";
import { carryForward } from "@/lib/scrape/carry-forward";
import { describeError } from "@/lib/scrape/http";
import { runSanityChecks } from "@/lib/scrape/sanity";
import type { Store, StoreId } from "@/lib/stores/registry";
import type { ScrapeResult } from "@/lib/stores/parse";

export interface RunInput {
  stores: readonly Store[];
  read: (store: Store) => Promise<ScrapeResult>;
  previous: CatalogueFile | null;
  /**
   * Stores not read this run whose products in `previous` stay on the site (a run with
   * --only). They take part in matching and deals, so cross-store comparisons cover the
   * whole catalogue, but nothing is recorded in history for them.
   */
  keep?: readonly StoreId[];
  history: HistoryFile | null;
  now?: Date;
  log?: (line: string) => void;
  /** Also return where every product was placed, for reviewing the category rules. */
  collectPlacements?: boolean;
}

export interface PlacementRecord {
  storeId: StoreId;
  title: string;
  storeCategories: string[];
  /** A category id, or "excluded: <reason>". */
  placedIn: string;
}

export interface RunOutput {
  catalogue: CatalogueFile;
  history: HistoryFile;
  /** Reasons to refuse publishing. Empty when the run can be written. */
  sanityFailures: string[];
  failedStores: StoreId[];
  /** Whether any product changed, ignoring timestamps. */
  changed: boolean;
  placements: PlacementRecord[];
}

/** Stores in the same lane are read one after another; lanes run in parallel. */
export function laneOf(store: Store): string {
  return store.platform === "shopify" ? "shopify" : store.id;
}

export async function runScrape(input: RunInput): Promise<RunOutput> {
  const now = input.now ?? new Date();
  const today = todayInSouthAfrica(now);
  const log = input.log ?? (() => {});
  const placements: PlacementRecord[] = [];

  const readStore = async (store: Store) => {
    const ranAt = new Date().toISOString();
    try {
      const read = await input.read(store);
      const products: NormalisedProduct[] = [];
      let excluded = 0;
      for (const scraped of read.products) {
        const out = normalise(scraped, store);
        if ("product" in out) products.push(out.product);
        else excluded += 1;
        if (input.collectPlacements) {
          placements.push({
            storeId: store.id,
            title: "product" in out ? out.product.title : scraped.title,
            storeCategories: scraped.storeCategories,
            placedIn: "product" in out ? out.product.category : `excluded: ${out.because}`,
          });
        }
      }
      const unreadable = read.unreadable > 0 ? `, ${read.unreadable} unreadable` : "";
      log(
        `${store.id}: ${read.rawCount} in catalogue${unreadable}, ${read.products.length} for sale, ${products.length} kept, ${excluded} not gear (${read.requests} requests)`,
      );
      const status: StoreRunStatus = { ok: true, count: products.length, rawCount: read.rawCount, ranAt };
      return { store, observed: products, carried: [] as Product[], status };
    } catch (error) {
      const message = describeError(error);
      log(`${store.id}: FAILED: ${message}`);
      const carried = carryForward(store.id, message, ranAt, input.previous);
      // Carried products were placed by whatever rules ran last time; re-place them under today's.
      const replaced = recategorise(carried.products).products;
      if (replaced.length > 0) {
        log(`${store.id}: carrying forward ${replaced.length} products from ${carried.status.lastOkAt}`);
      }
      return {
        store,
        observed: [] as NormalisedProduct[],
        carried: replaced,
        status: { ...carried.status, count: replaced.length },
      };
    }
  };

  const lanes = new Map<string, Store[]>();
  for (const store of input.stores) lanes.set(laneOf(store), [...(lanes.get(laneOf(store)) ?? []), store]);
  const results = (
    await Promise.all(
      [...lanes.values()].map(async (stores) => {
        const done = [];
        for (const store of stores) done.push(await readStore(store));
        return done;
      }),
    )
  ).flat();

  const observed = results.flatMap((r) => r.observed);
  const history = recordDay(input.history ?? emptyHistory(today), observed, today);

  // Like carried products, kept ones are re-placed under today's category rules.
  const keep = new Set<StoreId>(input.keep ?? []);
  const kept = recategorise((input.previous?.products ?? []).filter((p) => keep.has(p.storeId))).products;

  const all: NormalisedProduct[] = [...observed, ...results.flatMap((r) => r.carried), ...kept];
  const byId = new Map(all.map((p) => [p.id, p]));
  const matches = findMatches(all);

  const products: Product[] = [...byId.values()]
    .map((p) => {
      const entry = history.products[p.id] ?? null;
      const others = (matches.get(p.id) ?? []).map((id) => byId.get(id)).filter((o) => o !== undefined);
      return { ...p, firstSeen: entry?.firstSeen ?? today, deal: dealFor(p, entry, others, today) };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const stores: CatalogueFile["stores"] = {};
  for (const id of keep) {
    const status = input.previous?.stores[id];
    if (status) stores[id] = status;
  }
  for (const r of results) stores[r.store.id] = r.status;

  const catalogue: CatalogueFile = {
    version: 1,
    generatedAt: now.toISOString(),
    pricedOn: today,
    stores,
    products,
  };

  return {
    catalogue,
    history,
    sanityFailures: runSanityChecks(products, stores, input.previous),
    failedStores: results.filter((r) => !r.status.ok).map((r) => r.store.id),
    changed: input.previous ? productsDiffer(input.previous.products, products) : true,
    placements,
  };
}

function productsDiffer(before: readonly Product[], after: readonly Product[]): boolean {
  if (before.length !== after.length) return true;
  return JSON.stringify(before) !== JSON.stringify(after);
}
