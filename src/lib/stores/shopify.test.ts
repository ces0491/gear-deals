import { describe, expect, it } from "vitest";

import { StoreFormatError } from "@/lib/scrape/http";
import { storeById } from "@/lib/stores/registry";
import { PAGE_SIZE, parseShopifyPage, productsUrl, scrapeShopify, shopifyPrice, type ShopifyProduct } from "@/lib/stores/shopify";

import { fixture, json, scriptedHttp } from "../../../test/helpers";

const ironman = storeById("ironman");

/** A product in the shape /products.json returns; only the fields the adapter reads. */
function product(overrides: Partial<ShopifyProduct> = {}): ShopifyProduct {
  return {
    id: 1,
    title: "Foam Cell Pro Shock",
    handle: "foam-cell-pro-shock",
    vendor: "Ironman 4x4",
    product_type: "Suspension",
    tags: ["Hilux"],
    images: [{ src: "https://cdn.shopify.com/s/files/x.jpg" }],
    variants: [{ id: 11, price: "2499.00", compare_at_price: null, available: true, sku: "45700FE" }],
    ...overrides,
  };
}

describe("shopifyPrice", () => {
  it("uses the cheapest variant in stock and its compare-at price", () => {
    const price = shopifyPrice(
      product({
        variants: [
          { id: 1, price: "1999.00", compare_at_price: "2999.00", available: false, sku: "A" },
          { id: 2, price: "2499.00", compare_at_price: "2999.00", available: true, sku: "B" },
          { id: 3, price: "3499.00", compare_at_price: null, available: true, sku: "C" },
        ],
      }),
    );
    expect(price).toEqual({ priceZar: 2499, maxPriceZar: 3499, wasZar: 2999, sku: "B", inStock: true });
  });

  it("falls back to the cheapest variant when none is in stock", () => {
    const price = shopifyPrice(
      product({
        variants: [
          { id: 1, price: "300.00", compare_at_price: null, available: false, sku: null },
          { id: 2, price: "200.00", compare_at_price: "150.00", available: false, sku: null },
        ],
      }),
    );
    expect(price).toEqual({ priceZar: 200, maxPriceZar: 300, wasZar: null, sku: null, inStock: false });
  });

  it("returns null when no variant has a price", () => {
    expect(shopifyPrice(product({ variants: [{ id: 1, price: "0.00", compare_at_price: null, available: true }] }))).toBeNull();
  });
});

describe("parseShopifyPage", () => {
  it("builds the product link from the handle and joins type and tags as categories", () => {
    const { products } = parseShopifyPage({ products: [product()] }, ironman);
    expect(products[0]).toMatchObject({
      storeId: "ironman",
      externalId: "1",
      url: "https://www.ironman4x4.co.za/products/foam-cell-pro-shock",
      brand: "Ironman 4x4",
      storeCategories: ["Suspension", "Hilux"],
      priceZar: 2499,
    });
  });

  it("accepts tags as one comma-separated string", () => {
    const { products } = parseShopifyPage({ products: [{ ...product(), tags: "Sale, Hilux" }] }, ironman);
    expect(products[0].storeCategories).toEqual(["Suspension", "Sale", "Hilux"]);
  });
});

describe("parseShopifyPage on a captured page", () => {
  it("reads Ironman 4x4's catalogue, ignoring compare-at prices equal to the price", () => {
    const { products, rawCount } = parseShopifyPage(fixture("stores/ironman.json"), ironman);
    expect(rawCount).toBe(24);
    expect(products.length).toBeGreaterThan(0);
    const stretcher = products.find((p) => p.title === "Born Free Folding Camp Stretcher");
    expect(stretcher).toMatchObject({ priceZar: 1035, wasZar: null, brand: "Cadac SA" });
    const steps = products.find((p) => p.title === "Side Steps & Rails" && p.wasZar !== null);
    expect(steps?.wasZar).toBeGreaterThan(steps?.priceZar ?? Infinity);
  });

  it("reads Adventure Inc's catalogue, where a zero compare-at price means none", () => {
    const { products } = parseShopifyPage(fixture("stores/adventureinc.json"), storeById("adventureinc"));
    expect(products.every((p) => p.wasZar === null || p.wasZar > p.priceZar)).toBe(true);
    expect(products.find((p) => p.title === "Storm Leather Balm")).toBeUndefined(); // priced at zero
  });
});

describe("scrapeShopify", () => {
  it("checks the currency, then reads pages until a short one", async () => {
    const full = { products: Array.from({ length: PAGE_SIZE }, (_, i) => product({ id: i + 1 })) };
    const { http, urls } = scriptedHttp([json({ currency: "ZAR" }), json(full), json({ products: [product({ id: 999 })] })]);
    const result = await scrapeShopify(ironman, http, 0);
    expect(urls[0]).toBe("https://www.ironman4x4.co.za/meta.json");
    expect(urls[1]).toBe(productsUrl(ironman, 1));
    expect(result.rawCount).toBe(PAGE_SIZE + 1);
    expect(result.requests).toBe(3);
  });

  it("refuses a store that doesn't price in rand", async () => {
    const { http } = scriptedHttp([json({ currency: "USD" })]);
    await expect(scrapeShopify(ironman, http, 0)).rejects.toBeInstanceOf(StoreFormatError);
  });
});
