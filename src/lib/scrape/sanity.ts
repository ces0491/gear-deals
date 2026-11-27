/**
 * Checks a run must pass before it's published. Each one guards a failure that would
 * otherwise go out looking like real data: a parser that stopped reading a store, a
 * catalogue that halved overnight, or a price-unit change that turns every product into
 * a 90%-off "deal".
 *
 * A store-wide sale also puts a was-price on most of a store's products. On 27 November
 * 2026 (Black Friday) 2 027 of Camp and Climb's 2 152 products gained one overnight, most
 * at 5% off, each equal to the price recorded the day before. The was-price check lets
 * those through and counts the was-prices the last run doesn't back.
 */
import type { CatalogueFile, Product, StoreRunStatus } from "@/lib/catalogue/types";
import type { StoreId } from "@/lib/stores/registry";

/** A store whose product count falls below this share of its last count fails the run. */
export const COUNT_DROP_FLOOR = 0.6;
/** Fewer raw products than this can't support a ratio. */
export const MIN_RAW_FOR_RATIOS = 20;
/** Below this share of raw products surviving the adapter and normaliser, parsing has likely broken. */
export const MIN_YIELD = 0.3;
/** Stores whose catalogue legitimately yields less. */
export const YIELD_FLOORS: Partial<Record<StoreId, number>> = {
  // National Luna lists its whole range but prices only its fridges and freezers: 30 of
  // 175 products on 18 November 2026.
  nationalluna: 0.1,
  // Trappers is mostly clothing and footwear, which are left out; about 30% of a page of
  // its catalogue was equipment on 18 November 2026.
  trappers: 0.15,
};
/** More than this share of a store's products showing a was-price the last run doesn't back fails the run. */
export const UNBACKED_WAS_CEILING = 0.5;
/** A fall this large since the last run is a "collapse". */
export const COLLAPSE_FRACTION = 0.7;
/** More collapses than this share of a store's products (and at least COLLAPSE_MIN) fails the run. */
export const COLLAPSE_SHARE = 0.1;
export const COLLAPSE_MIN = 5;

export function runSanityChecks(
  products: readonly Product[],
  stores: Partial<Record<StoreId, StoreRunStatus>>,
  previous: CatalogueFile | null,
): string[] {
  const failures: string[] = [];
  const byStore = groupByStore(products);
  const before = previous ? groupByStore(previous.products) : new Map<StoreId, Product[]>();

  for (const [storeId, status] of Object.entries(stores) as [StoreId, StoreRunStatus][]) {
    if (!status.ok) continue;
    const now = byStore.get(storeId) ?? [];
    const raw = status.rawCount ?? 0;

    const floor = YIELD_FLOORS[storeId] ?? MIN_YIELD;
    if (raw >= MIN_RAW_FOR_RATIOS && now.length / raw < floor) {
      failures.push(
        `${storeId}: ${now.length} of ${raw} catalogue products survived (${pct(now.length / raw)}, floor ${pct(floor)})`,
      );
    }

    // After a failed run, `was` is what was carried forward: still the last good read.
    const was = before.get(storeId);
    if (was && was.length > 0 && now.length / was.length < COUNT_DROP_FLOOR) {
      failures.push(`${storeId}: products fell from ${was.length} to ${now.length} since the last run`);
    }

    const last = new Map((was ?? []).map((p) => [p.id, p]));

    if (was && was.length >= MIN_RAW_FOR_RATIOS && now.length >= MIN_RAW_FOR_RATIOS) {
      const unbacked = now.filter((p) => p.wasZar !== null && !backedByLastRun(p.wasZar, last.get(p.id)));
      if (unbacked.length > now.length * UNBACKED_WAS_CEILING) {
        failures.push(
          `${storeId}: ${pct(unbacked.length / now.length)} of products show a was-price that is neither the price nor the was-price recorded last run, e.g. ${unbacked
            .slice(0, 3)
            .map((p) => {
              const prior = last.get(p.id);
              return `"${p.title}" was R${p.wasZar}, ${prior ? `R${prior.priceZar} last run` : "not seen last run"}`;
            })
            .join("; ")}`,
        );
      }
    }

    if (was) {
      const collapsed = now.filter((p) => {
        const prior = last.get(p.id);
        return prior !== undefined && p.priceZar <= prior.priceZar * (1 - COLLAPSE_FRACTION);
      });
      if (collapsed.length >= COLLAPSE_MIN && collapsed.length > now.length * COLLAPSE_SHARE) {
        failures.push(
          `${storeId}: ${collapsed.length} products fell ${pct(COLLAPSE_FRACTION)} or more in price since the last run, e.g. ${collapsed
            .slice(0, 3)
            .map((p) => `"${p.title}" R${last.get(p.id)?.priceZar} → R${p.priceZar}`)
            .join("; ")}`,
        );
      }
    }
  }

  return failures;
}

function groupByStore(products: readonly Product[]): Map<StoreId, Product[]> {
  const map = new Map<StoreId, Product[]>();
  for (const p of products) {
    const list = map.get(p.storeId) ?? [];
    list.push(p);
    map.set(p.storeId, list);
  }
  return map;
}

/**
 * Whether the last run backs a was-price: the product sold for that then, so this site
 * saw the price itself, or the store already showed the same was-price. A was-price with
 * neither behind it rests on the store's field alone, and a misread field or a
 * regular price raised to dress up a sale looks the same.
 */
function backedByLastRun(wasZar: number, prior: Product | undefined): boolean {
  if (!prior) return false;
  return sameAmount(wasZar, prior.priceZar) || (prior.wasZar !== null && sameAmount(wasZar, prior.wasZar));
}

/** Equal to the cent. */
function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
