import { MISSING_PRODUCT_DAYS } from "@/lib/alerts/config";
import type { AlertRecord } from "@/lib/alerts/store";
import type { Product } from "@/lib/catalogue/types";
import { daysBetween } from "@/lib/dates";

export interface Due {
  /** Hits per email address, so an address gets one email however many alerts hit. */
  send: Map<string, { alert: AlertRecord; product: Product }[]>;
  close: { id: string; reason: string }[];
}

/**
 * Which active alerts to send today: the product is listed, in stock, and at or under the
 * target. An alert whose product hasn't been listed for MISSING_PRODUCT_DAYS is closed.
 * `lastSeen` gives the last day a product was read, from the price history.
 */
export function dueAlerts(
  active: readonly AlertRecord[],
  productById: (id: string) => Product | null,
  lastSeen: (id: string) => string | null,
  today: string,
): Due {
  const send = new Map<string, { alert: AlertRecord; product: Product }[]>();
  const close: Due["close"] = [];
  for (const alert of active) {
    const product = productById(alert.productId);
    if (!product) {
      const seen = lastSeen(alert.productId) ?? alert.createdAt.slice(0, 10);
      if (daysBetween(seen, today) >= MISSING_PRODUCT_DAYS) {
        close.push({ id: alert.id, reason: `The store hasn't listed it since ${seen}.` });
      }
      continue;
    }
    if (product.inStock && product.priceZar <= alert.targetZar) {
      const list = send.get(alert.email) ?? [];
      list.push({ alert, product });
      send.set(alert.email, list);
    }
  }
  return { send, close };
}
