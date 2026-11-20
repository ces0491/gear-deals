import { SECOND_HAND_MIN_PRICE_ZAR } from "../src/lib/second-hand";

import { expect, FIXTURE, productPath, test } from "./helpers";

/**
 * Layout checks at phone widths, in both colour schemes: the page never scrolls
 * sideways, and the filter sheet opens and closes. Markup review can't find these;
 * only a real layout engine at a real width shows them.
 */
// One with the price chart, and one priced high enough to show the second-hand links.
const charted = FIXTURE.products.find((p) => p.deal?.reasons.some((r) => r.kind === "price-drop")) ?? FIXTURE.products[0];
const pricey = FIXTURE.products.find((p) => p.priceZar >= SECOND_HAND_MIN_PRICE_ZAR) ?? FIXTURE.products[0];
const PAGES = ["/", productPath(charted), productPath(pricey), "/stores", "/how-it-works", "/privacy", "/watchlist", "/alerts"];

for (const width of [320, 412]) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`${width}px, ${scheme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: scheme });

      for (const path of PAGES) {
        test(`${path} doesn't scroll sideways`, async ({ page }) => {
          await page.goto(path);
          await page.waitForLoadState("networkidle");
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow).toBeLessThanOrEqual(0);
        });
      }
    });
  }
}

test("pages send the security headers and break none of their rules", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) violations.push(m.text());
  });
  for (const path of PAGES) {
    const response = await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(response?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  }
  expect(violations).toEqual([]);
});

test.describe("filter sheet on a phone", () => {
  test.use({ viewport: { width: 375, height: 760 } });

  test("opens from the Filters button and closes from its results button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Cheaper than another store")).toBeHidden();
    await page.getByRole("button", { name: /^Filters/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filters" });
    await expect(sheet).toBeVisible();
    await sheet.getByLabel("Cheaper than another store").check();
    await expect(page).toHaveURL(/reason=cheaper-elsewhere/);
    await sheet.getByRole("button", { name: /^Show \d+ deals?$/ }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: "Filters (1)" })).toBeVisible();
  });

  test("closes with Escape", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeHidden();
  });

  test("takes focus when it opens and gives it back when it closes", async ({ page }) => {
    await page.goto("/");
    const opener = page.getByRole("button", { name: /^Filters/ });
    await opener.click();
    await expect(page.getByRole("button", { name: "Close filters" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
  });

  test("form fields use 16px text, so iOS doesn't zoom on focus", async ({ page }) => {
    await page.goto("/");
    const sizes = await page.$$eval("input, select", (els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => parseFloat(getComputedStyle(e).fontSize)),
    );
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
  });
});
