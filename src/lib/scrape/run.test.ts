import { describe, expect, it } from "vitest";

import type { CatalogueFile } from "@/lib/catalogue/types";
import { parseCatalogue, parseHistory, stringifyCatalogue, stringifyHistory } from "@/lib/scrape/files";
import { HttpError } from "@/lib/scrape/http";
import { HELD_MESSAGE, laneOf, runScrape } from "@/lib/scrape/run";
import { storeById } from "@/lib/stores/registry";
import type { ScrapeResult } from "@/lib/stores/parse";

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

const shelves = (priceZar: number) =>
  Array.from({ length: 10 }, (_, i) =>
    makeScraped({ storeId: "campandclimb", externalId: `shelf-${i}`, title: `Camp Cupboard ${i}`, storeCategories: ["Cupboards"], priceZar }),
  );

const page = (products: ScrapeResult["products"]): ScrapeResult => ({ products, rawCount: products.length, requests: 1, unreadable: 0 });

/** Both stores read well on 17 November; on the 18th Camp and Climb's prices come back at a hundredth, as a change of units would. */
async function aGoodDayThenAHold() {
  const good = await runScrape({
    stores: [tentco, camp],
    read: read({ tentco: page([cupboard("tentco", 1150)]), campandclimb: page(shelves(1000)) }),
    previous: null,
    history: null,
    now: new Date("2026-11-17T03:00:00Z"),
  });
  const held = await runScrape({
    stores: [tentco, camp],
    read: read({ tentco: page([cupboard("tentco", 1100)]), campandclimb: page(shelves(10)) }),
    previous: good.catalogue,
    history: good.history,
    now: new Date("2026-11-18T03:00:00Z"),
  });
  return { good, held };
}

describe("runScrape", () => {
  it("publishes every store's products with deals, and records history for what it read", async () => {
    const out = await runScrape({
      stores: [tentco, camp],
      read: read({
        tentco: { products: [cupboard("tentco", 1150)], rawCount: 1, requests: 1, unreadable: 0 },
        campandclimb: {
          products: [cupboard("campandclimb", 1095 - 40), makeScraped({ title: "Belay Device", storeCategories: ["Climbing"] })],
          rawCount: 2,
          unreadable: 0,
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
      read: read({ tentco: { products: [cupboard("tentco", 1150)], rawCount: 1, requests: 1, unreadable: 0 } }),
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
    expect(second.heldStores).toEqual([]);
    expect(second.catalogue.products).toHaveLength(1);
    expect(second.catalogue.stores.tentco).toMatchObject({ ok: false, count: 1, lastOkAt: first.catalogue.stores.tentco?.ranAt });
    expect(second.catalogue.stores.tentco).not.toHaveProperty("held");
    expect(second.history.products["tentco:tentco-cupboard"].lastSeen).toBe("2026-11-17");
  });

  it("holds back a store whose read fails a check, and publishes the others", async () => {
    const { good, held } = await aGoodDayThenAHold();
    expect(held.heldStores).toEqual([{ storeId: "campandclimb", failures: [expect.stringMatching(/^10 products fell 70% or more/)] }]);
    expect(held.failedStores).toEqual([]);
    expect(held.sanityFailures).toEqual([]);

    const atCamp = held.catalogue.products.filter((p) => p.storeId === "campandclimb");
    expect(atCamp.map((p) => p.priceZar)).toEqual(Array(10).fill(1000));
    expect(held.catalogue.stores.campandclimb).toMatchObject({
      ok: false,
      held: true,
      count: 10,
      error: HELD_MESSAGE,
      lastOkAt: good.catalogue.stores.campandclimb?.ranAt,
    });
    expect(held.history.products["campandclimb:shelf-0"]).toMatchObject({ lastSeen: "2026-11-17", points: [{ priceZar: 1000 }] });

    expect(held.catalogue.products.find((p) => p.storeId === "tentco")?.priceZar).toBe(1100);
    expect(held.catalogue.stores.tentco).toMatchObject({ ok: true, count: 1 });
  });

  it("keeps holding a store against its last good read", async () => {
    const { good, held } = await aGoodDayThenAHold();
    const nextDay = await runScrape({
      stores: [camp],
      read: read({ campandclimb: page(shelves(10)) }),
      previous: held.catalogue,
      history: held.history,
      now: new Date("2026-11-19T03:00:00Z"),
    });
    expect(nextDay.heldStores.map((h) => h.storeId)).toEqual(["campandclimb"]);
    expect(nextDay.catalogue.stores.campandclimb).toMatchObject({ count: 10, lastOkAt: good.catalogue.stores.campandclimb?.ranAt });
  });

  it("lets a held store go once a read passes the checks", async () => {
    const { held } = await aGoodDayThenAHold();
    const nextDay = await runScrape({
      stores: [camp],
      read: read({ campandclimb: page(shelves(950)) }),
      previous: held.catalogue,
      history: held.history,
      now: new Date("2026-11-19T03:00:00Z"),
    });
    expect(nextDay.heldStores).toEqual([]);
    expect(nextDay.catalogue.stores.campandclimb).toMatchObject({ ok: true, count: 10 });
    expect(nextDay.catalogue.stores.campandclimb).not.toHaveProperty("held");
    expect(nextDay.catalogue.products.every((p) => p.priceZar === 950)).toBe(true);
  });

  it("publishes an accepted store's read whatever the checks find, and says what they found", async () => {
    const { held } = await aGoodDayThenAHold();
    const log: string[] = [];
    const accepted = await runScrape({
      stores: [camp],
      read: read({ campandclimb: page(shelves(10)) }),
      previous: held.catalogue,
      history: held.history,
      keep: ["tentco"],
      accept: ["campandclimb"],
      now: new Date("2026-11-18T09:00:00Z"),
      log: (line) => log.push(line),
    });
    expect(accepted.heldStores).toEqual([]);
    expect(accepted.failedStores).toEqual([]);
    expect(accepted.catalogue.stores.campandclimb).toMatchObject({ ok: true, count: 10 });
    expect(accepted.catalogue.stores.campandclimb).not.toHaveProperty("held");
    expect(accepted.catalogue.products.filter((p) => p.storeId === "campandclimb").every((p) => p.priceZar === 10)).toBe(true);
    expect(accepted.catalogue.products.find((p) => p.storeId === "tentco")?.priceZar).toBe(1100);
    expect(accepted.history.products["campandclimb:shelf-0"]).toMatchObject({ lastSeen: "2026-11-18", points: [{ priceZar: 1000 }, { priceZar: 10 }] });
    expect(log.filter((line) => line.includes("ACCEPTED"))).toEqual([expect.stringMatching(/^campandclimb: ACCEPTED: 10 products fell 70% or more/)]);
  });

  it("keeps a store held after its carried products lapse, until it's accepted", async () => {
    const { good } = await aGoodDayThenAHold();
    const longAgo: CatalogueFile = {
      ...good.catalogue,
      stores: { ...good.catalogue.stores, campandclimb: { ok: true, count: 10, rawCount: 10, ranAt: "2026-11-01T03:00:00Z" } },
    };
    const cheap = { stores: [camp], read: read({ campandclimb: page(shelves(10)) }) };

    const lapsed = await runScrape({ ...cheap, previous: longAgo, history: good.history });
    expect(lapsed.catalogue.stores.campandclimb).toMatchObject({ ok: false, held: true, count: 0, lastOkAt: "2026-11-01T03:00:00Z" });

    // Nothing is left to compare the read with, and that alone doesn't publish it.
    const stillHeld = await runScrape({ ...cheap, previous: lapsed.catalogue, history: lapsed.history });
    expect(stillHeld.heldStores).toEqual([
      { storeId: "campandclimb", failures: [expect.stringMatching(/^its last good prices \(read 2026-11-01\) lapsed while it was held/)] },
    ]);
    expect(stillHeld.catalogue.stores.campandclimb).toMatchObject({ ok: false, held: true, count: 0 });
    expect(stillHeld.catalogue.products).toEqual([]);

    const accepted = await runScrape({ ...cheap, previous: stillHeld.catalogue, history: stillHeld.history, accept: ["campandclimb"] });
    expect(accepted.heldStores).toEqual([]);
    expect(accepted.catalogue.stores.campandclimb).toMatchObject({ ok: true, count: 10 });
    expect(accepted.catalogue.products.every((p) => p.priceZar === 10)).toBe(true);
  });

  it("keeps a store held through a day it can't be read", async () => {
    const { good } = await aGoodDayThenAHold();
    const longAgo: CatalogueFile = {
      ...good.catalogue,
      stores: { ...good.catalogue.stores, campandclimb: { ok: true, count: 10, rawCount: 10, ranAt: "2026-11-01T03:00:00Z" } },
    };
    const lapsed = await runScrape({ stores: [camp], read: read({ campandclimb: page(shelves(10)) }), previous: longAgo, history: good.history });

    const unreadable = await runScrape({
      stores: [camp],
      read: read({ campandclimb: new HttpError("https://campandclimb.co.za/x", 503) }),
      previous: lapsed.catalogue,
      history: lapsed.history,
    });
    expect(unreadable.failedStores).toEqual(["campandclimb"]);
    expect(unreadable.heldStores).toEqual([]);
    expect(unreadable.catalogue.stores.campandclimb).toMatchObject({ ok: false, held: true, error: "The store answered with an error (HTTP 503)." });

    const readAgain = await runScrape({
      stores: [camp],
      read: read({ campandclimb: page(shelves(10)) }),
      previous: unreadable.catalogue,
      history: unreadable.history,
    });
    expect(readAgain.heldStores.map((h) => h.storeId)).toEqual(["campandclimb"]);
  });

  it("reports a kept store that fails a check as a reason not to write the files", async () => {
    const first = await runScrape({
      stores: [tentco, camp],
      read: read({ tentco: page([cupboard("tentco", 1150)]), campandclimb: page([cupboard("campandclimb", 1055)]) }),
      previous: null,
      history: null,
      now: new Date("2026-11-17T03:00:00Z"),
    });
    // As if today's category rules had dropped all but one of a hundred products.
    const previous: CatalogueFile = {
      ...first.catalogue,
      stores: { ...first.catalogue.stores, campandclimb: { ok: true, count: 1, rawCount: 100, ranAt: "2026-11-17T03:00:00Z" } },
    };
    const partial = await runScrape({
      stores: [tentco],
      read: read({ tentco: page([cupboard("tentco", 1150)]) }),
      previous,
      history: first.history,
      keep: ["campandclimb"],
      now: new Date("2026-11-18T03:00:00Z"),
    });
    expect(partial.sanityFailures).toEqual([expect.stringMatching(/^campandclimb: 1 of 100 catalogue products survived/)]);
    expect(partial.heldStores).toEqual([]);
  });

  it("keeps the stores a partial run didn't read, and matches against them", async () => {
    const first = await runScrape({
      stores: [tentco, camp],
      read: read({
        tentco: { products: [cupboard("tentco", 1150)], rawCount: 1, requests: 1, unreadable: 0 },
        campandclimb: { products: [cupboard("campandclimb", 1055)], rawCount: 1, requests: 1, unreadable: 0 },
      }),
      previous: null,
      history: null,
      now: new Date("2026-11-17T03:00:00Z"),
    });
    // Only Tentco is read; it's now the cheaper of the two.
    const partial = await runScrape({
      stores: [tentco],
      read: read({ tentco: { products: [cupboard("tentco", 1000)], rawCount: 1, requests: 1, unreadable: 0 } }),
      previous: first.catalogue,
      history: first.history,
      keep: ["campandclimb"],
      now: new Date("2026-11-18T03:00:00Z"),
    });
    const [atCamp, atTentco] = partial.catalogue.products;
    expect(atCamp).toMatchObject({ id: "campandclimb:campandclimb-cupboard", priceZar: 1055, deal: null });
    expect(atTentco.deal?.reasons[0]).toMatchObject({ kind: "cheaper-elsewhere", otherStoreId: "campandclimb", savingZar: 55 });
    expect(partial.catalogue.stores.campandclimb).toEqual(first.catalogue.stores.campandclimb);
    expect(partial.history.products["campandclimb:campandclimb-cupboard"].lastSeen).toBe("2026-11-17");
    expect(partial.sanityFailures).toEqual([]);
  });

  it("reports no change when only timestamps moved", async () => {
    const input = {
      stores: [tentco],
      read: read({ tentco: { products: [cupboard("tentco", 1150)], rawCount: 1, requests: 1, unreadable: 0 } }),
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
      return { products: [], rawCount: 0, requests: 1, unreadable: 0 };
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
      read: read({ tentco: { products: [cupboard("tentco", 1150), makeScraped({ storeId: "tentco", title: "Chair Director", storeCategories: ["Chairs"] })], rawCount: 2, requests: 1, unreadable: 0 } }),
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
