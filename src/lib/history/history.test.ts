import { describe, expect, it } from "vitest";

import type { HistoryFile } from "@/lib/catalogue/types";
import { emptyHistory, HISTORY_RETENTION_DAYS, historyStats, recordDay } from "@/lib/history/history";
import { addDays } from "@/lib/dates";

const obs = (priceZar: number, wasZar: number | null = null) => [{ id: "s:1", priceZar, wasZar }];

function run(days: [string, number, number | null][]): HistoryFile {
  let h = emptyHistory(days[0][0]);
  for (const [on, price, was] of days) h = recordDay(h, obs(price, was), on);
  return h;
}

describe("recordDay", () => {
  it("records a new product and nothing more while its price holds", () => {
    const h = run([
      ["2026-11-01", 100, null],
      ["2026-11-02", 100, null],
      ["2026-11-03", 100, null],
    ]);
    expect(h.products["s:1"]).toEqual({
      firstSeen: "2026-11-01",
      lastSeen: "2026-11-03",
      points: [{ on: "2026-11-01", priceZar: 100, wasZar: null }],
    });
  });

  it("adds a point when the price or the was-price changes", () => {
    const h = run([
      ["2026-11-01", 100, null],
      ["2026-11-05", 80, null],
      ["2026-11-06", 80, 100],
    ]);
    expect(h.products["s:1"].points.map((p) => [p.on, p.priceZar, p.wasZar])).toEqual([
      ["2026-11-01", 100, null],
      ["2026-11-05", 80, null],
      ["2026-11-06", 80, 100],
    ]);
  });

  it("replaces a point when the same day runs twice, and drops it when it's back to before", () => {
    let h = run([
      ["2026-11-01", 100, null],
      ["2026-11-02", 90, null],
    ]);
    h = recordDay(h, obs(85), "2026-11-02");
    expect(h.products["s:1"].points.map((p) => p.priceZar)).toEqual([100, 85]);
    h = recordDay(h, obs(100), "2026-11-02");
    expect(h.products["s:1"].points.map((p) => p.priceZar)).toEqual([100]);
  });

  it("leaves products it didn't see alone, and forgets them after the retention period", () => {
    let h = recordDay(emptyHistory("2026-01-01"), [{ id: "gone", priceZar: 5, wasZar: null }], "2026-01-01");
    h = recordDay(h, obs(100), "2026-01-02");
    expect(h.products.gone.lastSeen).toBe("2026-01-01");
    h = recordDay(h, obs(100), addDays("2026-01-01", HISTORY_RETENTION_DAYS + 1));
    expect(h.products.gone).toBeUndefined();
    expect(h.startedOn).toBe("2026-01-01");
  });
});

describe("historyStats", () => {
  it("finds the previous price, how long it held, and when the current one began", () => {
    const h = run([
      ["2026-11-01", 120, null],
      ["2026-11-03", 100, null],
      ["2026-11-10", 80, null],
    ]);
    expect(historyStats(h.products["s:1"], "2026-11-12")).toEqual({
      trackedDays: 11,
      lowestZar: 80,
      lowestOn: "2026-11-10",
      previous: { priceZar: 100, heldDays: 7 },
      currentSince: "2026-11-10",
      wasSince: null,
    });
  });

  it("counts a price held across was-price changes as one run", () => {
    const h = run([
      ["2026-11-01", 100, null],
      ["2026-11-04", 100, 150],
      ["2026-11-08", 90, 150],
    ]);
    const stats = historyStats(h.products["s:1"], "2026-11-08");
    expect(stats.previous).toEqual({ priceZar: 100, heldDays: 7 });
    expect(stats.wasSince).toBe("2026-11-04");
  });

  it("has no previous price for a product whose price never changed", () => {
    const h = run([["2026-11-01", 100, 130]]);
    const stats = historyStats(h.products["s:1"], "2026-11-01");
    expect(stats.previous).toBeNull();
    expect(stats.wasSince).toBe("2026-11-01");
  });
});
