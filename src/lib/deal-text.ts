/** Plain-language wording for deals, shared by cards, the product page and alert emails. */
import type { Deal, DealReason } from "@/lib/catalogue/types";
import { daysBetween, formatDisplayDate } from "@/lib/dates";
import { formatPct, formatRand } from "@/lib/format";
import { storeById } from "@/lib/stores/registry";

/** A was-price shown this long is worth flagging: it may be the usual price. */
export const LONG_RUNNING_WAS_DAYS = 60;
/**
 * Below this many days since tracking began, "shown since at least <date>" says nothing
 * useful (on the first day it would name today), so the date is left off.
 */
const MIN_DAYS_TO_DATE_A_WAS_PRICE = 7;

/** The reason the headline saving comes from, else the first reason. */
export function headlineReason(deal: Deal): DealReason {
  return (
    deal.reasons.find((r) => r.kind !== "clearance" && r.savingPct === deal.savingPct) ?? deal.reasons[0]
  );
}

/** The tag's two lines: the saving, and what it's measured against. */
export function tagText(deal: Deal): { big: string; small: string } {
  const r = headlineReason(deal);
  switch (r.kind) {
    case "was-price":
      return { big: `−${formatPct(r.savingPct)}`, small: "on its was-price" };
    case "price-drop":
      return { big: `−${formatPct(r.savingPct)}`, small: "price drop" };
    case "cheaper-elsewhere":
      return { big: `−${formatPct(r.savingPct)}`, small: `vs ${storeById(r.otherStoreId).name}` };
    case "clearance":
      return { big: "Clearance", small: "no was-price given" };
  }
}

/** One line of evidence per reason. `today` is the day prices were read. */
export function reasonText(reason: DealReason, today: string): string {
  switch (reason.kind) {
    case "was-price": {
      const days = daysBetween(reason.since, today);
      const base = `The store's was-price is ${formatRand(reason.wasZar)}`;
      if (reason.sinceTrackingBegan && days < MIN_DAYS_TO_DATE_A_WAS_PRICE) return `${base}.`;
      const shown = reason.sinceTrackingBegan
        ? `shown since at least ${formatDisplayDate(reason.since)}`
        : `first shown ${formatDisplayDate(reason.since)}`;
      const long = days >= LONG_RUNNING_WAS_DAYS ? `, ${days} days ago, so it may be the usual price` : "";
      return `${base} (${shown}${long}).`;
    }
    case "price-drop":
      return `Down ${formatRand(reason.savingZar)} from ${formatRand(reason.fromZar)} on ${formatDisplayDate(reason.on)}, by our own tracking.`;
    case "cheaper-elsewhere":
      return `${formatRand(reason.savingZar)} less than ${storeById(reason.otherStoreId).name}, which sells the same item for ${formatRand(reason.otherPriceZar)}.`;
    case "clearance":
      return `Listed in the store's “${reason.section}” section. The store gives no was-price to measure against.`;
  }
}
