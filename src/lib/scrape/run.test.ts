import { describe, expect, it } from "vitest";

import type { CatalogueFile } from "@/lib/catalogue/types";
import { parseCatalogue, parseHistory, stringifyCatalogue, stringifyHistory } from "@/lib/scrape/files";
import { HttpError } from "@/lib/scrape/http";
import { laneOf, runScrape } from "@/lib/scrape/run";
import { storeById } from "@/lib/stores/registry";
import type { ScrapeResult } from "@/lib/stores/woocommerce";

import { makeScraped } from "../../../test/helpers";

const tentco = storeById("tentco");
const camp = storeById("campandclimb");

const read = (byStore: Record<string, ScrapeResult | Error>) => async (store: { id: string }) => {
  const r = byStore[store.id];
  if (r instanceof Error) throw r;
  return r;
};

const cupboard = (storeId: "tentco" | "campandclimb", priceZar: number) =>
  makeScraped({ storeId, externalId: `${storeId}-cupboard`, title: "Tentco 3 Shelf Deluxe Cupboard", sku: "TEN061", storeCategories: ["Cupboards"], priceZar });

describe("runScrape", () => {
  it("publishes every store's products with deals, and records history for what it read", async () => {
    const out = await runScrape({
      stores: [tentco, camp],
      read: read({
        tentco: { products: [cupboard("tentco", 1150)], rawCount: 1, requests: 1 },
        campandclimb: {
          products: [cupboard("campandclimb", 1095 - 40), makeScraped({ title: "Belay Device", storeCategories: ["Climbing"] })],
          rawCount: 2,
          requests: 1,
        },
      }),
      previous: null,
      history: null,
      now: new Date("2026-11-18T03:00:00Z"),
    });

    expect(out.sanityFailures).toEqual([]);
    expect(out.catalogue.products.map((p) => p.id)).toEqual(["campandclimb:campandclimb-cupboard", "tentco:tentco-cupboard"]);
    const cheaper = out.catalogue.products[0];
    expect(cheaper.deal?.reasons[0]).toMatchObject({ kind: "cheaper-elsewhere", otherStoreId: "tentco", savingZar: 95 });
    expect(cheaper.firstSeen).toBe("2026-11-18");
    expect(out.catalogue.pricedOn).toBe("2026-11-18");
    expect(out.catalogue.stores.campandclimb).toMatchObject({ ok: true, count: 1, rawCount: 2 });
    expect(Object.keys(out.history.products).sort()).toEqual(out.catalogue.products.map((p) => p.id));
    expect(out.changed).toBe(true);
  });

  it("carries a failed store forward without recording history for it", async () => {
    const first = await runScrape({
      stores: [tentco],
      read: read({ tentco: { products: [cupboard("tentco", 1150)], rawCount: 1, requests: 1 } }),
      previous: null,
      history: null,
      now: new Date("2026-11-17T03:00:00Z"),
    });
    const second = await runScrape({
      stores: [tentco],
      read: read({ tentco: new HttpError("https://www.tentco.co.za/x", 503) }),
      previous: first.catalogue,
      history: first.history,
      now: new Date("2026-11-18T03:00:00Z"),
    });
    expect(second.failedStores).toEqual(["tentco"]);
    expect(second.catalogue.products).toHaveLength(1);
    expect(second.catalogue.stores.tentco).toMatchObject({ ok: false, count: 1, lastOkAt: first.catalogue.stores.tentco?.ranAt });
    expect(second.history.products["tentco:tentco-cupboard"].lastSeen).toBe("2026-11-17");
  });

  it("reports no change when only timestamps moved", async () => {
    const input = {
      stores: [tentco],
      read: read({ tentco: { products: [cupboard("tentco", 1150)], rawCount: 1, requests: 1 } }),
      history: null,
    };
    const first = await runScrape({ ...input, previous: null, now: new Date("2026-11-18T03:00:00Z") });
    const again = await runScrape({ ...input, previous: first.catalogue, history: first.history, now: new Date("2026-11-18T05:00:00Z") });
    expect(again.changed).toBe(false);
  });
});

describe("read order", () => {
  it("reads Shopify stores one after another and other stores in parallel", async () => {
    const events: string[] = [];
    const slow = (id: string) => async () => {
      events.push(`start ${id}`);
      await new Promise((r) => setTimeout(r, 5));
      events.push(`end ${id}`);
      return { products: [], rawCount: 0, requests: 1 };
    };
    const stores = [storeById("ironman"), storeById("trappers"), tentco];
    await runScrape({
      stores,
      read: (store) => slow(store.id)(),
      previous: null,
      history: null,
    });
    expect(laneOf(storeById("ironman"))).toBe(laneOf(storeById("adventureinc")));
    expect(laneOf(tentco)).not.toBe(laneOf(camp));
    // Trappers starts only after Ironman ends; Tentco runs alongside Ironman.
    expect(events.indexOf("start trappers")).toBeGreaterThan(events.indexOf("end ironman"));
    expect(events.indexOf("start tentco")).toBeLessThan(events.indexOf("end ironman"));
  });
});

describe("data files", () => {
  it("writes one product per line and reads back the same data", async () => {
    const out = await runScrape({
      stores: [tentco],
      read: read({ tentco: { products: [cupboard("tentco", 1150), makeScraped({ storeId: "tentco", title: "Chair Director", storeCategories: ["Chairs"] })], rawCount: 2, requests: 1 } }),
      previous: null,
      history: null,
      now: new Date("2026-11-18T03:00:00Z"),
    });
    const text = stringifyCatalogue(out.catalogue);
    expect(text.split("\n").filter((l) => l.startsWith('{"id":'))).toHaveLength(2);
    expect(parseCatalogue(text)).toEqual(out.catalogue);
    expect(parseHistory(stringifyHistory(out.history))).toEqual(out.history);
  });

  it("refuses a file that isn't a catalogue", () => {
    expect(() => parseCatalogue(JSON.stringify({ products: [] }))).toThrow();
    const bad: Partial<CatalogueFile> = { version: 1 };
    expect(() => parseCatalogue(JSON.stringify(bad))).toThrow();
  });
});
