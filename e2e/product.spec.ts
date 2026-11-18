import { addDays } from "../src/lib/dates";
import { LONG_RUNNING_WAS_DAYS } from "../src/lib/deal-text";
import { SECOND_HAND_MIN_PRICE_ZAR, secondHandLinks, secondHandQuery } from "../src/lib/second-hand";

import { expect, FIXTURE, fixtureProduct, productPath, test } from "./helpers";

test.describe("product page", () => {
  test("shows the price, the deal's evidence and a link to buy", async ({ page }) => {
    const p = fixtureProduct((x) => x.inStock && (x.deal?.reasons.some((r) => r.kind === "was-price") ?? false));
    await page.goto(productPath(p));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.title);
    await expect(page.getByText(/The store's was-price is R/)).toBeVisible();
    await expect(page.getByRole("link", { name: /^Buy at / })).toHaveAttribute("href", p.url);
  });

  test("compares the same item at another store", async ({ page }) => {
    const p = fixtureProduct((x) => x.deal?.reasons.some((r) => r.kind === "cheaper-elsewhere") ?? false);
    await page.goto(productPath(p));
    await expect(page.getByRole("heading", { name: "Same item at other stores" })).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(3); // header, this store, the other
    await expect(page.getByText(/less than .*, which sells the same item for R/)).toBeVisible();
  });

  test("charts a tracked price drop, with the figures as a table", async ({ page }) => {
    const p = fixtureProduct((x) => x.deal?.reasons.some((r) => r.kind === "price-drop") ?? false);
    await page.goto(productPath(p));
    await expect(page.getByText(/by our own tracking/)).toBeVisible();
    const chart = page.getByRole("img", { name: /^Price at / });
    await expect(chart).toBeVisible();

    await chart.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("status")).toContainText("R");

    await page.getByText("Price changes as a table").click();
    await expect(page.getByRole("table").last().getByRole("row")).toHaveCount(3);
  });

  test("flags a was-price shown for a long time", async ({ page }) => {
    const longAgo = addDays(FIXTURE.pricedOn, -LONG_RUNNING_WAS_DAYS);
    const p = fixtureProduct((x) => x.deal?.reasons.some((r) => r.kind === "was-price" && r.since <= longAgo) ?? false);
    await page.goto(productPath(p));
    await expect(page.getByText(/so it may be the usual price/)).toBeVisible();
  });

  test("links to second-hand searches for items from R1 000", async ({ page }) => {
    const big = fixtureProduct((x) => x.priceZar >= SECOND_HAND_MIN_PRICE_ZAR);
    await page.goto(productPath(big));
    const query = secondHandQuery(big);
    await expect(page.getByText(`own search for “${query}”`)).toBeVisible();
    for (const link of secondHandLinks(query)) {
      const a = page.getByRole("link", { name: `Search ${link.site}` });
      await expect(a).toHaveAttribute("href", link.url);
      await expect(a).toHaveAttribute("rel", "noopener noreferrer");
    }

    const small = fixtureProduct((x) => x.priceZar < SECOND_HAND_MIN_PRICE_ZAR);
    await page.goto(productPath(small));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(small.title);
    await expect(page.getByRole("heading", { name: "Look for a used one" })).toHaveCount(0);
  });

  test("answers 404 for a product that isn't listed", async ({ page }) => {
    await page.goto("/product/tentco/does-not-exist");
    await expect(page.getByRole("heading", { name: "Not here" })).toBeVisible();
  });
});
