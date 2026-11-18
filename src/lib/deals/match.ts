/**
 * Finding the same item at more than one store.
 *
 * Only identical manufacturer codes match: names differ too much between stores ("Bow
 * Tent Senior Safari Deluxe" at Tentco is "Tentco Senior Safari Bow Deluxe Tent" at Camp
 * and Climb) for name matching to be trusted. On 18 November 2026, 52 codes were shared
 * across stores, nearly all Tentco items that Camp and Climb lists under Tentco's codes.
 *
 * A code is set aside when:
 * - it appears on more than one product at the same store (then it isn't identifying one item)
 * - the products sharing it name different brands, not counting a store's house default
 * - their prices are more than MAX_PRICE_RATIO apart, which points to different pack sizes
 *   or a code reused for something else
 */
import type { StoreId } from "@/lib/stores/registry";

export const MAX_PRICE_RATIO = 2.5;

/** Codes checked by hand and found to join different items. */
export const NOT_THE_SAME_ITEM: ReadonlySet<string> = new Set<string>([]);

/**
 * Brands a store applies as a house default, so they say nothing about who made the
 * item. 4x4 Mega World tags its own Desert Products range with it, and also, for
 * example, a 4WD Interiors roof console (RC70AB) that Opposite Lock sells as 4WD Interiors.
 */
export const HOUSE_DEFAULT_BRANDS: ReadonlySet<string> = new Set(["desert products"]);

export interface Matchable {
  id: string;
  storeId: StoreId;
  brand: string | null;
  matchKey: string | null;
  priceZar: number;
}

/** Product id → the ids of the same item at other stores. Products without a match are absent. */
export function findMatches(products: readonly Matchable[]): Map<string, string[]> {
  const perStore = new Map<string, number>();
  for (const p of products) {
    if (!p.matchKey) continue;
    const k = `${p.storeId}|${p.matchKey}`;
    perStore.set(k, (perStore.get(k) ?? 0) + 1);
  }

  const groups = new Map<string, Matchable[]>();
  for (const p of products) {
    if (!p.matchKey || NOT_THE_SAME_ITEM.has(p.matchKey)) continue;
    if ((perStore.get(`${p.storeId}|${p.matchKey}`) ?? 0) > 1) continue;
    const group = groups.get(p.matchKey) ?? [];
    group.push(p);
    groups.set(p.matchKey, group);
  }

  const matches = new Map<string, string[]>();
  for (const group of groups.values()) {
    if (new Set(group.map((p) => p.storeId)).size < 2) continue;
    const brands = new Set(
      group.map((p) => p.brand?.toLowerCase()).filter((b) => b !== undefined && !HOUSE_DEFAULT_BRANDS.has(b)),
    );
    if (brands.size > 1) continue;
    const prices = group.map((p) => p.priceZar);
    if (Math.max(...prices) / Math.min(...prices) > MAX_PRICE_RATIO) continue;
    for (const p of group) {
      matches.set(
        p.id,
        group.filter((o) => o.id !== p.id).map((o) => o.id),
      );
    }
  }
  return matches;
}
