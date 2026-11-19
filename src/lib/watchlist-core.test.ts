import { describe, expect, it } from "vitest";

import { changeFor, EMPTY_WATCHLIST, isWatchState, recordVisit, visitBaseline } from "@/lib/watchlist-core";

const item = { id: "tentco:1", title: "Chair", addedAt: "2026-11-01T08:00:00Z", priceWhenAdded: 950 };

describe("changeFor", () => {
  it("measures against the price when added and at the last visit", () => {
    expect(changeFor(item, 895, { at: "2026-11-10T08:00:00Z", prices: { "tentco:1": 920 } })).toEqual({
      sinceAdded: -55,
      sinceLastVisit: -25,
    });
  });

  it("has no last-visit change for an item added since that visit", () => {
    expect(changeFor(item, 950, { at: "x", prices: {} }).sinceLastVisit).toBeNull();
    expect(changeFor(item, 950, null)).toEqual({ sinceAdded: 0, sinceLastVisit: null });
  });
});

describe("visits", () => {
  const morning = (day: string, hour: number) => new Date(`${day}T0${hour}:00:00Z`);

  it("compares against the previous day's prices, however often the page is opened on the day", () => {
    const day1 = recordVisit(EMPTY_WATCHLIST, "2026-11-18", { "tentco:1": 950 }, morning("2026-11-18", 6));
    expect(visitBaseline(day1, "2026-11-19")?.prices).toEqual({ "tentco:1": 950 });

    const day2 = recordVisit(day1, "2026-11-19", { "tentco:1": 900 }, morning("2026-11-19", 6));
    const refreshed = recordVisit(day2, "2026-11-19", { "tentco:1": 900 }, morning("2026-11-19", 7));
    expect(visitBaseline(refreshed, "2026-11-19")?.prices).toEqual({ "tentco:1": 950 });
    expect(changeFor(item, 900, visitBaseline(refreshed, "2026-11-19")).sinceLastVisit).toBe(-50);
  });

  it("has nothing to compare on the first day", () => {
    const first = recordVisit(EMPTY_WATCHLIST, "2026-11-18", { "tentco:1": 950 }, morning("2026-11-18", 6));
    expect(visitBaseline(first, "2026-11-18")).toBeNull();
  });

  it("treats a visit saved before days were recorded as an earlier day", () => {
    const old = { items: [item], lastVisit: { at: "2026-11-17T08:00:00Z", prices: { "tentco:1": 990 } } };
    expect(isWatchState(old)).toBe(true);
    expect(visitBaseline(old, "2026-11-19")?.prices).toEqual({ "tentco:1": 990 });
    expect(recordVisit(old, "2026-11-19", { "tentco:1": 900 }, morning("2026-11-19", 6)).earlierVisit).toEqual(old.lastVisit);
  });
});

describe("isWatchState", () => {
  it("accepts a stored list and rejects anything else", () => {
    expect(isWatchState({ items: [item], lastVisit: null })).toBe(true);
    expect(isWatchState({ items: [{ ...item, priceWhenAdded: "950" }], lastVisit: null })).toBe(false);
    expect(isWatchState({ items: [], lastVisit: { at: "x", prices: { a: "1" } } })).toBe(false);
    expect(isWatchState({ items: [], lastVisit: null, earlierVisit: { at: "x", pricedOn: 18, prices: {} } })).toBe(false);
    expect(isWatchState([])).toBe(false);
    expect(isWatchState(null)).toBe(false);
  });
});
