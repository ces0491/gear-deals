import { describe, expect, it } from "vitest";

import { HttpError, StoreFormatError } from "@/lib/scrape/http";
import { storeById } from "@/lib/stores/registry";
import { FIELDS, parseWooPage, PER_PAGE, productsUrl, scrapeWooCommerce, wooPrice, type WooProduct } from "@/lib/stores/woocommerce";

import { fixture, json, scriptedHttp } from "../../../test/helpers";

const oppositeLock = storeById("oppositelock");
const campAndClimb = storeById("campandclimb");
const megaWorld = storeById("megaworld");

type RawWoo = Record<string, unknown> & { id: number; prices: Record<string, unknown> };

describe("productsUrl", () => {
  it("asks for one page of the Store API with only the fields used", () => {
    const url = new URL(productsUrl(oppositeLock, 3));
    expect(url.origin + url.pathname).toBe("https://oppositelock.co.za/wp-json/wc/store/v1/products");
    expect(url.searchParams.get("per_page")).toBe(String(PER_PAGE));
    expect(url.searchParams.get("page")).toBe("3");
    expect(url.searchParams.get("_fields")).toBe(FIELDS);
  });
});

describe("parseWooPage", () => {
  it("reads a sale price and the store's was-price", () => {
    const { products } = parseWooPage(fixture("stores/oppositelock.json"), oppositeLock);
    const viper = products.find((p) => p.externalId === "4491");
    expect(viper).toMatchObject({
      storeId: "oppositelock",
      title: "Viper 40 Inch Amber Single Row LED Light Bar",
      priceZar: 5495,
      wasZar: 7995,
      maxPriceZar: null,
      sku: "LFLB40SA",
      storeCategories: ["Light bars", "Lighting"],
    });
    expect(viper?.url).toMatch(/^https:\/\/oppositelock\.co\.za\//);
  });

  it("leaves out products the store doesn't sell online, even when marked on sale", () => {
    const { products, rawCount } = parseWooPage(fixture("stores/oppositelock.json"), oppositeLock);
    expect(rawCount).toBe(24);
    expect(products.find((p) => p.externalId === "19497")).toBeUndefined(); // bull bar, not purchasable
    expect(products.find((p) => p.externalId === "4510")).toBeUndefined();
  });

  it("reads a product with options as a price range with no was-price", () => {
    const { products } = parseWooPage(fixture("stores/oppositelock.json"), oppositeLock);
    expect(products.find((p) => p.externalId === "4405")).toMatchObject({ priceZar: 185, maxPriceZar: 320, wasZar: null });
  });

  it("leaves out products priced at zero", () => {
    const { products } = parseWooPage(fixture("stores/campandclimb.json"), campAndClimb);
    expect(products.every((p) => p.priceZar > 0)).toBe(true);
    expect(products.find((p) => p.externalId === "89833")).toBeUndefined();
  });

  it("takes the catalogue-sized image and the brand field when the store has one", () => {
    const { products } = parseWooPage(fixture("stores/megaworld.json"), megaWorld);
    const engel = products.find((p) => p.externalId === "900512");
    expect(engel?.priceZar).toBe(12299);
    expect(engel?.image).toMatch(/^https:\/\//);
    expect(engel?.brand).not.toBeNull();
  });

  it("refuses a catalogue priced in another currency", () => {
    const page = fixture<RawWoo[]>("stores/tentco.json").slice(0, 1);
    page[0].prices = { ...page[0].prices, currency_code: "USD" };
    expect(() => parseWooPage(page, storeById("tentco"))).toThrow(StoreFormatError);
  });

  it("rejects a page that isn't a product list", () => {
    expect(() => parseWooPage({ code: "rest_no_route" }, oppositeLock)).toThrow();
  });

  it("leaves out a malformed product and counts it, keeping the rest of the page", () => {
    const page = fixture<RawWoo[]>("stores/tentco.json");
    const whole = parseWooPage(page, storeById("tentco"));
    const result = parseWooPage([{ ...page[0], prices: undefined }, ...page.slice(1)], storeById("tentco"));
    expect(result).toMatchObject({ rawCount: page.length, unreadable: 1 });
    expect(result.firstProblem).toMatch(new RegExp(`^product ${page[0].id}: prices`));
    expect(result.products).toEqual(whole.products.filter((p) => p.externalId !== String(page[0].id)));
  });
});

describe("wooPrice", () => {
  const base = {
    id: 1,
    name: "x",
    permalink: "https://x.test/p",
    type: "simple",
    images: [],
    categories: [],
    brands: [],
    is_in_stock: true,
    is_purchasable: true,
  } satisfies Partial<WooProduct>;
  const prices = (p: Partial<WooProduct["prices"]>) => ({
    price: "0",
    regular_price: "0",
    currency_code: "ZAR",
    currency_minor_unit: 2,
    price_range: null,
    ...p,
  });

  it("ignores a regular price at or below the price", () => {
    expect(wooPrice({ ...base, prices: prices({ price: "10000", regular_price: "10000" }) })?.wasZar).toBeNull();
  });

  it("falls back from an empty range minimum on a variable product", () => {
    const p = { ...base, type: "variable", prices: prices({ price: "0", regular_price: "25000", price_range: { min_amount: "", max_amount: "" } }) };
    expect(wooPrice(p)).toEqual({ priceZar: 250, maxPriceZar: null, wasZar: null });
  });

  it("handles a store with no minor unit", () => {
    expect(wooPrice({ ...base, prices: prices({ price: "450", currency_minor_unit: 0 }) })?.priceZar).toBe(450);
  });
});

describe("scrapeWooCommerce", () => {
  const fullPage = () => Array.from({ length: PER_PAGE }, () => fixture<RawWoo[]>("stores/tentco.json")[0]);

  it("reads pages until a short one, pausing between them", async () => {
    const { http, urls, sleeps } = scriptedHttp([json(fullPage()), json(fixture("stores/tentco.json"))]);
    const result = await scrapeWooCommerce(storeById("tentco"), http, 1500);
    expect(urls).toHaveLength(2);
    expect(result.rawCount).toBe(PER_PAGE + 24);
    expect(result.requests).toBe(2);
    expect(sleeps).toEqual([1500]);
  });

  it("stops at an HTTP 400 past the first page", async () => {
    const { http } = scriptedHttp([json(fullPage()), new Response("bad page", { status: 400 })]);
    const result = await scrapeWooCommerce(storeById("tentco"), http, 0);
    expect(result.rawCount).toBe(PER_PAGE);
  });

  it("fails on an HTTP 400 for the first page", async () => {
    const { http } = scriptedHttp([new Response("no", { status: 400 })]);
    await expect(scrapeWooCommerce(storeById("tentco"), http, 0)).rejects.toBeInstanceOf(HttpError);
  });

  it("reads the store when one product can't be read, and fails it when several can't", async () => {
    const page = fixture<RawWoo[]>("stores/tentco.json");
    const breakFirst = (n: number) => page.map((p, i) => (i < n ? { ...p, prices: undefined } : p));

    const one = await scrapeWooCommerce(storeById("tentco"), scriptedHttp([json(breakFirst(1))]).http, 0);
    expect(one).toMatchObject({ rawCount: page.length, unreadable: 1 });

    await expect(scrapeWooCommerce(storeById("tentco"), scriptedHttp([json(breakFirst(3))]).http, 0)).rejects.toThrow(
      new RegExp(`3 of ${page.length} products in Tentco's catalogue couldn't be read`),
    );
  });
});
