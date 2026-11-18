import { describe, expect, it } from "vitest";

import { changeFor, isWatchState } from "@/lib/watchlist-core";

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

describe("isWatchState", () => {
  it("accepts a stored list and rejects anything else", () => {
    expect(isWatchState({ items: [item], lastVisit: null })).toBe(true);
    expect(isWatchState({ items: [{ ...item, priceWhenAdded: "950" }], lastVisit: null })).toBe(false);
    expect(isWatchState({ items: [], lastVisit: { at: "x", prices: { a: "1" } } })).toBe(false);
    expect(isWatchState([])).toBe(false);
    expect(isWatchState(null)).toBe(false);
  });
});
