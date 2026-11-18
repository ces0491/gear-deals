import { expect, fixtureProduct, linkIn, productPath, sentEmails, test } from "./helpers";

test.describe("watchlist", () => {
  test("watching a product adds it to the watchlist, and removing it empties it", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("article").first();
    const title = (await card.getByRole("heading", { level: 3 }).textContent()) ?? "";
    await card.getByRole("button", { name: /^Watch/ }).click();
    await expect(card.getByRole("button", { name: /^Watching/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link", { name: /Watchlist, 1 watched/ })).toBeVisible();

    await page.getByRole("link", { name: /Watchlist/ }).click();
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await expect(page.getByText("No change since you added it")).toBeVisible();

    await page.getByRole("button", { name: `Remove ${title} from the watchlist` }).click();
    await expect(page.getByText("Nothing on your watchlist yet.")).toBeVisible();
  });
});

test.describe("price alerts", () => {
  const product = () => fixtureProduct((p) => p.inStock && p.priceZar > 500);

  test("asks for a valid email and a price under the current one", async ({ page }) => {
    await page.goto(productPath(product()));
    const form = page.locator("form", { has: page.getByRole("heading", { name: "Email me when it drops" }) });
    await form.getByLabel("Email").fill("not-an-email");
    await form.getByRole("button", { name: "Set alert" }).click();
    await expect(form.getByRole("alert")).toContainText("Enter an email address");

    await form.getByLabel("Email").fill("someone@example.com");
    await form.getByLabel("At or under (R)").fill(String(product().priceZar + 100));
    await form.getByRole("button", { name: "Set alert" }).click();
    await expect(form.getByRole("alert")).toContainText("Pick a price below that");
  });

  test("an alert goes live only once confirmed, and can be deleted", async ({ page, request }) => {
    const email = `e2e-${Date.now()}@example.com`;
    const p = product();
    await page.goto(productPath(p));
    const form = page.locator("form", { has: page.getByRole("heading", { name: "Email me when it drops" }) });
    await form.getByLabel("Email").fill(email);
    await form.getByRole("button", { name: "Set alert" }).click();
    await expect(page.getByText("Confirm by email")).toBeVisible();

    const confirmation = sentEmails().find((e) => e.to === email);
    expect(confirmation?.subject).toBe(`Confirm your price alert: ${p.title}`);
    await page.goto(linkIn(confirmation!, "/alerts/confirm"));
    await expect(page.getByText(email)).toBeVisible();
    await page.getByRole("button", { name: "Confirm alert" }).click();

    await expect(page).toHaveURL(/\/alerts\/manage\?token=.*done=confirmed/);
    await expect(page.getByText("Alert confirmed.")).toBeVisible();
    await expect(page.getByText("Waiting for the price")).toBeVisible();

    await page.getByRole("button", { name: `Delete the alert on ${p.title}` }).click();
    await expect(page.getByText("Alert deleted.")).toBeVisible();
    await expect(page.getByText("No alerts are held for this address.")).toBeVisible();

    // One-click unsubscribe from the same signed link answers too.
    const manage = linkIn(confirmation!, "/alerts/manage");
    const token = new URL(manage, "http://x").searchParams.get("token");
    const unsubscribe = await request.post(`/api/alerts/unsubscribe?token=${token}`);
    expect(unsubscribe.status()).toBe(200);
    expect((await request.post("/api/alerts/unsubscribe?token=forged.token")).status()).toBe(400);
  });

  test("a tampered manage link is refused", async ({ page }) => {
    await page.goto("/alerts/manage?token=abc.def");
    await expect(page.getByText(/This link isn.t valid\./)).toBeVisible();
  });

  test("the lost-link form doesn't say whether an address has alerts", async ({ page }) => {
    await page.goto("/alerts");
    await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Email me the link" }).click();
    await expect(page.getByText("If that address has alerts, a link to them is on its way.")).toBeVisible();
  });
});
