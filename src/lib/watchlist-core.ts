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

/** The prices the watchlist page showed on a visit. */
export interface VisitSnapshot {
  at: string;
  /** The day those prices were read. Missing from lists saved before it was recorded. */
  pricedOn?: string;
  prices: Record<string, number>;
}

export interface WatchState {
  items: WatchItem[];
  /** The most recent visit to the watchlist page. */
  lastVisit: VisitSnapshot | null;
  /** The most recent visit before that which saw an earlier day's prices. */
  earlierVisit?: VisitSnapshot | null;
}

export const EMPTY_WATCHLIST: WatchState = { items: [], lastVisit: null };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function isSnapshot(v: unknown): v is VisitSnapshot {
  return (
    isRecord(v) &&
    typeof v.at === "string" &&
    (v.pricedOn === undefined || typeof v.pricedOn === "string") &&
    isRecord(v.prices) &&
    Object.values(v.prices).every((p) => typeof p === "number")
  );
}

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
  const lastOk = v.lastVisit === null || isSnapshot(v.lastVisit);
  const earlierOk = v.earlierVisit === undefined || v.earlierVisit === null || isSnapshot(v.earlierVisit);
  return itemsOk && lastOk && earlierOk;
}

/**
 * What "since your last visit" compares against when the page shows the prices read on
 * `pricedOn`. Prices change once a morning, so a second look the same day, a refresh
 * included, compares against the last visit that saw an earlier day's prices.
 */
export function visitBaseline(state: WatchState, pricedOn: string): VisitSnapshot | null {
  const last = state.lastVisit;
  return last && last.pricedOn === pricedOn ? (state.earlierVisit ?? null) : last;
}

/** The state after a visit that showed `prices`, read on `pricedOn`. */
export function recordVisit(state: WatchState, pricedOn: string, prices: Record<string, number>, now: Date): WatchState {
  const last = state.lastVisit;
  if (last && last.pricedOn === pricedOn) {
    return { ...state, lastVisit: { ...last, at: now.toISOString(), prices: { ...last.prices, ...prices } } };
  }
  return { ...state, earlierVisit: last, lastVisit: { at: now.toISOString(), pricedOn, prices } };
}

export interface WatchChange {
  /** Price now minus the price when added; negative is cheaper. */
  sinceAdded: number;
  /** The same against the last visit. Null when there's no earlier visit, or the item was added since. */
  sinceLastVisit: number | null;
}

export function changeFor(item: WatchItem, priceNow: number, baseline: VisitSnapshot | null): WatchChange {
  const seen = baseline?.prices[item.id];
  return {
    sinceAdded: round(priceNow - item.priceWhenAdded),
    sinceLastVisit: seen === undefined ? null : round(priceNow - seen),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
