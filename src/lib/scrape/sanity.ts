/**
 * Checks a run must pass before it's published. Each one guards a failure that would
 * otherwise go out looking like real data: a parser that stopped reading a store, a
 * catalogue that halved overnight, or a price-unit change that turns every product into
 * a 90%-off "deal".
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
/** Share of a store's products showing a was-price that's suspicious when it was low last run. */
export const MARKDOWN_SHARE_CEILING = 0.5;
export const MARKDOWN_SHARE_BEFORE = 0.2;
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

    const was = before.get(storeId);
    if (was && was.length > 0 && previous?.stores[storeId]?.ok && now.length / was.length < COUNT_DROP_FLOOR) {
      failures.push(`${storeId}: products fell from ${was.length} to ${now.length} since the last run`);
    }

    if (was && was.length >= MIN_RAW_FOR_RATIOS && now.length >= MIN_RAW_FOR_RATIOS) {
      const share = markdownShare(now);
      const shareBefore = markdownShare(was);
      if (share > MARKDOWN_SHARE_CEILING && shareBefore < MARKDOWN_SHARE_BEFORE) {
        failures.push(`${storeId}: ${pct(share)} of products now show a was-price, up from ${pct(shareBefore)}`);
      }
    }

    if (was) {
      const lastPrice = new Map(was.map((p) => [p.id, p.priceZar]));
      const collapsed = now.filter((p) => {
        const prior = lastPrice.get(p.id);
        return prior !== undefined && p.priceZar <= prior * (1 - COLLAPSE_FRACTION);
      });
      if (collapsed.length >= COLLAPSE_MIN && collapsed.length > now.length * COLLAPSE_SHARE) {
        failures.push(
          `${storeId}: ${collapsed.length} products fell ${pct(COLLAPSE_FRACTION)} or more in price since the last run, e.g. ${collapsed
            .slice(0, 3)
            .map((p) => `"${p.title}" R${lastPrice.get(p.id)} → R${p.priceZar}`)
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

function markdownShare(products: readonly Product[]): number {
  return products.filter((p) => p.wasZar !== null).length / products.length;
}

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
