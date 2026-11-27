/**
 * What makes a product a deal. Each reason carries its own evidence, and the site says
 * which kind it is, because they're not equally strong:
 *
 * - "was-price": the store shows a higher price it says the product used to sell for.
 *   That's the store's claim; the site records how long it has been shown.
 * - "clearance": the store lists the product in a clearance or sale section, with no
 *   was-price to measure against.
 * - "price-drop": this site saw the price fall within the last PRICE_DROP_WINDOW_DAYS,
 *   from a price that had held for at least PRICE_DROP_MIN_HELD_DAYS. The holding rule
 *   stops a one-day spike and its reversal reading as a drop.
 * - "cheaper-elsewhere": another listed store sells the same manufacturer code, in stock,
 *   for more, and this is the cheapest in-stock listing.
 *
 * Savings under MIN_SAVING_PCT aren't counted: 2% off isn't a deal.
 */
import { daysBetween } from "@/lib/dates";
import type { Deal, DealReason, ProductHistory } from "@/lib/catalogue/types";
import { historyStats } from "@/lib/history/history";
import type { StoreId } from "@/lib/stores/registry";

export const MIN_SAVING_PCT = 0.05;
export const PRICE_DROP_WINDOW_DAYS = 14;
export const PRICE_DROP_MIN_HELD_DAYS = 3;

export interface DealInput {
  id: string;
  storeId: StoreId;
  priceZar: number;
  wasZar: number | null;
  inStock: boolean;
  clearance: string | null;
}

function saving(reference: number, price: number) {
  const savingZar = Math.round((reference - price) * 100) / 100;
  return { savingZar, savingPct: savingZar / reference };
}

/**
 * Whether a saving reaches MIN_SAVING_PCT. The slack is for floating point: R265.05
 * against R279 is 5% off and divides to 0.04999….
 */
function countsAsSaving(savingPct: number): boolean {
  return savingPct >= MIN_SAVING_PCT - 1e-9;
}

export function dealFor(
  product: DealInput,
  history: ProductHistory | null,
  sameItemElsewhere: readonly DealInput[],
  today: string,
): Deal | null {
  const reasons: DealReason[] = [];
  const stats = history ? historyStats(history, today) : null;

  if (product.wasZar !== null && product.wasZar > product.priceZar) {
    const s = saving(product.wasZar, product.priceZar);
    if (countsAsSaving(s.savingPct)) {
      const since = stats?.wasSince ?? today;
      reasons.push({
        kind: "was-price",
        wasZar: product.wasZar,
        ...s,
        since,
        sinceTrackingBegan: since <= (history?.firstSeen ?? today),
      });
    }
  }

  if (product.clearance) reasons.push({ kind: "clearance", section: product.clearance });

  const previous = stats?.previous;
  if (
    stats &&
    previous &&
    previous.priceZar > product.priceZar &&
    previous.heldDays >= PRICE_DROP_MIN_HELD_DAYS &&
    daysBetween(stats.currentSince, today) <= PRICE_DROP_WINDOW_DAYS
  ) {
    const s = saving(previous.priceZar, product.priceZar);
    if (countsAsSaving(s.savingPct)) {
      reasons.push({ kind: "price-drop", fromZar: previous.priceZar, ...s, on: stats.currentSince });
    }
  }

  if (product.inStock) {
    const others = sameItemElsewhere.filter((o) => o.inStock && o.storeId !== product.storeId);
    if (others.length > 0 && others.every((o) => o.priceZar > product.priceZar)) {
      const next = others.reduce((a, b) => (b.priceZar < a.priceZar ? b : a));
      const s = saving(next.priceZar, product.priceZar);
      if (countsAsSaving(s.savingPct)) {
        reasons.push({
          kind: "cheaper-elsewhere",
          otherStoreId: next.storeId,
          otherProductId: next.id,
          otherPriceZar: next.priceZar,
          ...s,
        });
      }
    }
  }

  if (reasons.length === 0) return null;
  let best: { savingPct: number; savingZar: number } | null = null;
  for (const r of reasons) {
    if (r.kind === "clearance") continue;
    if (!best || r.savingPct > best.savingPct) best = { savingPct: r.savingPct, savingZar: r.savingZar };
  }
  return { reasons, savingPct: best?.savingPct ?? null, savingZar: best?.savingZar ?? null };
}
