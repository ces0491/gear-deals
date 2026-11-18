/**
 * Price history: for each product, the days its price or was-price changed. A product
 * that keeps its price adds nothing, so the file grows with price changes rather than
 * with days.
 *
 * Only products read today update the history. A store whose scrape failed has its last
 * good products carried forward for display, but nothing is recorded for them, so a
 * failed day never reads as "the price held".
 */
import { addDays, daysBetween } from "@/lib/dates";
import type { HistoryFile, PricePoint, ProductHistory } from "@/lib/catalogue/types";

/** A product unseen for this long is dropped from the history. */
export const HISTORY_RETENTION_DAYS = 180;

export function emptyHistory(today: string): HistoryFile {
  return { version: 1, startedOn: today, products: {} };
}

export interface Observation {
  id: string;
  priceZar: number;
  wasZar: number | null;
}

function samePrice(a: PricePoint, b: Observation): boolean {
  return a.priceZar === b.priceZar && a.wasZar === b.wasZar;
}

/** Returns a new history with today's observations recorded. */
export function recordDay(history: HistoryFile, observed: readonly Observation[], today: string): HistoryFile {
  const products: Record<string, ProductHistory> = { ...history.products };
  for (const o of observed) {
    const point: PricePoint = { on: today, priceZar: o.priceZar, wasZar: o.wasZar };
    const existing = products[o.id];
    if (!existing) {
      products[o.id] = { firstSeen: today, lastSeen: today, points: [point] };
      continue;
    }
    let points = existing.points;
    const last = points.at(-1);
    if (last?.on === today) {
      // A second run on the same day replaces that day's point, and drops it when the
      // price is back to what it was before today.
      const before = points.slice(0, -1);
      const previous = before.at(-1);
      points = previous && samePrice(previous, o) ? before : [...before, point];
    } else if (!last || !samePrice(last, o)) {
      points = [...points, point];
    }
    products[o.id] = { ...existing, lastSeen: today, points };
  }

  const cutoff = addDays(today, -HISTORY_RETENTION_DAYS);
  for (const [id, entry] of Object.entries(products)) {
    if (entry.lastSeen < cutoff) delete products[id];
  }

  const startedOn = history.startedOn <= today ? history.startedOn : today;
  return { version: 1, startedOn, products };
}

export interface HistoryStats {
  /** Days from the first record to today. */
  trackedDays: number;
  lowestZar: number;
  /** The most recent day the lowest price was first seen. */
  lowestOn: string;
  /** The price before the latest change, and how many days it held. Null when the price never changed. */
  previous: { priceZar: number; heldDays: number } | null;
  /** The day the current price was first seen. */
  currentSince: string;
  /** The first day of the current, unbroken run of the current was-price. Null without one. */
  wasSince: string | null;
}

export function historyStats(entry: ProductHistory, today: string): HistoryStats {
  const points = entry.points;
  const current = points[points.length - 1];

  let lowest = points[0];
  for (const p of points) if (p.priceZar <= lowest.priceZar) lowest = p;

  // The latest point with a different price marks where the current price began.
  let start = points.length - 1;
  while (start > 0 && points[start - 1].priceZar === current.priceZar) start -= 1;
  const previousPoint = start > 0 ? points[start - 1] : null;
  // How long the previous price held: from the first point of its own run to the change.
  let previousStart = start - 1;
  while (previousPoint && previousStart > 0 && points[previousStart - 1].priceZar === previousPoint.priceZar) {
    previousStart -= 1;
  }

  let wasSince: string | null = null;
  if (current.wasZar !== null) {
    let i = points.length - 1;
    while (i > 0 && points[i - 1].wasZar === current.wasZar) i -= 1;
    wasSince = points[i].on;
  }

  return {
    trackedDays: daysBetween(entry.firstSeen, today),
    lowestZar: lowest.priceZar,
    lowestOn: lowest.on,
    previous: previousPoint
      ? { priceZar: previousPoint.priceZar, heldDays: daysBetween(points[previousStart].on, points[start].on) }
      : null,
    currentSince: points[start].on,
    wasSince,
  };
}
