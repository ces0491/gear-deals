/**
 * The watchlist's shape and the arithmetic on it, with no browser or React code, so the
 * server (the products API) and the tests can import it.
 */

/** Enough for anyone's shopping list; stops the stored list growing without bound. */
export const MAX_WATCHED = 200;

export interface WatchItem {
  id: string;
  title: string;
  addedAt: string;
  priceWhenAdded: number;
}

export interface WatchState {
  items: WatchItem[];
  /** Prices as they were the last time the watchlist page was open. */
  lastVisit: { at: string; prices: Record<string, number> } | null;
}

export const EMPTY_WATCHLIST: WatchState = { items: [], lastVisit: null };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Checks stored data by hand rather than with a schema library, which would add to every
 * page's script for one small object.
 */
export function isWatchState(v: unknown): v is WatchState {
  if (!isRecord(v) || !Array.isArray(v.items)) return false;
  const itemsOk = v.items.every(
    (i) =>
      isRecord(i) &&
      typeof i.id === "string" &&
      typeof i.title === "string" &&
      typeof i.addedAt === "string" &&
      typeof i.priceWhenAdded === "number",
  );
  const visit = v.lastVisit;
  const visitOk =
    visit === null ||
    (isRecord(visit) &&
      typeof visit.at === "string" &&
      isRecord(visit.prices) &&
      Object.values(visit.prices).every((p) => typeof p === "number"));
  return itemsOk && visitOk;
}

export interface WatchChange {
  /** Price now minus the price when added; negative is cheaper. */
  sinceAdded: number;
  /** The same against the last visit. Null when there's no earlier visit, or the item was added since. */
  sinceLastVisit: number | null;
}

export function changeFor(item: WatchItem, priceNow: number, lastVisit: WatchState["lastVisit"]): WatchChange {
  const seen = lastVisit?.prices[item.id];
  return {
    sinceAdded: round(priceNow - item.priceWhenAdded),
    sinceLastVisit: seen === undefined ? null : round(priceNow - seen),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
