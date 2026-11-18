import type { CatalogueFile, Product, StoreRunStatus } from "@/lib/catalogue/types";
import type { StoreId } from "@/lib/stores/registry";

/** How long a failed store's last good products stay on the site. */
export const MAX_CARRY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What to publish for a store whose scrape failed this run: its products from the last
 * catalogue, as long as its last good read is recent enough. Without this, one failed
 * morning would empty a store from the site until the next good one.
 */
export function carryForward(
  storeId: StoreId,
  error: string,
  ranAt: string,
  previous: CatalogueFile | null,
): { products: Product[]; status: StoreRunStatus } {
  const before = previous?.stores[storeId];
  const lastOkAt = before?.ok ? before.ranAt : before?.lastOkAt;
  const fresh = lastOkAt !== undefined && Date.parse(ranAt) - Date.parse(lastOkAt) <= MAX_CARRY_DAYS * DAY_MS;
  const products = fresh ? (previous?.products ?? []).filter((p) => p.storeId === storeId) : [];
  return { products, status: { ok: false, count: products.length, error, ranAt, lastOkAt } };
}
