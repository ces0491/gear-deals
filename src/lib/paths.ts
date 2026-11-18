import type { Product } from "@/lib/catalogue/types";

/** A product page's path: /product/<store id>/<store's own id>. */
export function productPath(p: Pick<Product, "storeId" | "externalId">): string {
  return `/product/${p.storeId}/${encodeURIComponent(p.externalId)}`;
}
