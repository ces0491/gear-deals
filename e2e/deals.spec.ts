import { expect, FIXTURE, test } from "./helpers";

const inStockDeals = FIXTURE.products.filter((p) => p.deal && p.inStock);

test.describe("deals page", () => {
  test("lists in-stock deals, biggest rand saving first, each with its tag", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Deals on 4x4 and camping gear");
    await expect(page.locator("#results-heading")).toContainText(`${inStockDeals.length} deals`);

    const top = [...inStockDeals].sort((a, b) => (b.deal?.savingZar ?? -1) - (a.deal?.savingZar ?? -1))[0];
    const first = page.getByRole("article").first();
    await expect(first.getByRole("heading", { level: 3 })).toHaveText(top.title);
    await expect(first.locator(".deal-tag")).toBeVisible();
  });

  test("filters by deal type and store, and the URL keeps the filters", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Cheaper than another store").check();
    await expect(page).toHaveURL(/reason=cheaper-elsewhere/);
    const cheaper = inStockDeals.filter((p) => p.deal?.reasons.some((r) => r.kind === "cheaper-elsewhere"));
    await expect(page.locator("#results-heading")).toContainText(`${cheaper.length} deal`);
    for (const article of await page.getByRole("article").all()) {
      await expect(article.locator(".deal-tag")).toContainText("vs ");
    }

    await page.reload();
    await expect(page.getByLabel("Cheaper than another store")).toBeChecked();
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("searches by word start", async ({ page }) => {
    const target = inStockDeals[0];
    const word = target.title.split(/\s+/).find((w) => w.length > 4) ?? target.title.split(" ")[0];
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search" }).fill(word);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(word)}`));
    await expect(page.getByRole("heading", { level: 3, name: target.title })).toBeVisible();
  });

  test("offers ways out of an empty result", async ({ page }) => {
    await page.goto("/?q=zzzznothing");
    await expect(page.getByText("Nothing matches these filters.")).toBeVisible();
    // The pages use typographic apostrophes (’), so text with one is matched loosely.
    await page.getByRole("link", { name: /Include products that aren.t deals/ }).click();
    await expect(page).toHaveURL(/all=1/);
  });

  test("shows products that aren't deals when asked", async ({ page }) => {
    await page.goto("/?all=1&stock=any");
    await expect(page.locator("#results-heading")).toContainText(`${FIXTURE.products.length} products`);
  });

  test("sorts by percentage", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Sort").selectOption("saving");
    await expect(page).toHaveURL(/sort=saving/);
    const top = [...inStockDeals].sort((a, b) => (b.deal?.savingPct ?? -1) - (a.deal?.savingPct ?? -1))[0];
    await expect(page.getByRole("article").first().getByRole("heading", { level: 3 })).toHaveText(top.title);
  });
});

test.describe("stores and method pages", () => {
  test("stores page lists each store read and the ones left out", async ({ page }) => {
    await page.goto("/stores");
    await expect(page.getByRole("rowheader")).toHaveCount(Object.keys(FIXTURE.stores).length);
    await expect(page.getByText("Its terms of service ban spidering, crawling and scraping the site.").first()).toBeVisible();
  });

  test("how-it-works states the thresholds the code uses", async ({ page }) => {
    await page.goto("/how-it-works");
    await expect(page.getByText(/A saving under 5% doesn.t count\./)).toBeVisible();
    await expect(page.locator("#matching")).toBeVisible();
  });
});
