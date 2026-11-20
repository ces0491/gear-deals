import { describe, expect, it, vi } from "vitest";

import {
  CONFIRM_LINK_HOURS,
  MAX_ALERTS_PER_EMAIL,
  MAX_REQUESTS_PER_EMAIL_PER_DAY,
  MAX_SITE_EMAILS_PER_DAY,
  MISSING_PRODUCT_DAYS,
} from "@/lib/alerts/config";
import { alertEmail, confirmEmail, escapeHtml } from "@/lib/alerts/emails";
import { runAlertJob } from "@/lib/alerts/job";
import type { Email, Mailer } from "@/lib/alerts/mailer";
import { dueAlerts } from "@/lib/alerts/rules";
import type { AlertsRuntime } from "@/lib/alerts/runtime";
import { confirmAlert, requestAlert, sendManageLink } from "@/lib/alerts/service";
import { MemoryAlertStore } from "@/lib/alerts/store";
import { confirmToken, hashAddress, hashEmail, manageToken, readConfirmToken, readManageToken } from "@/lib/alerts/tokens";
import type { Product } from "@/lib/catalogue/types";

import { makeProduct } from "../../../test/helpers";

const SECRET = "x".repeat(40);
const NOW = new Date("2026-11-18T08:00:00Z");
const SITE = "https://gear.test";

class CollectingMailer implements Mailer {
  sent: Email[] = [];
  failFor = new Set<string>();
  async send(email: Email) {
    if (this.failFor.has(email.to)) throw new Error("mailbox unavailable");
    this.sent.push(email);
  }
}

function runtime() {
  const mailer = new CollectingMailer();
  const store = new MemoryAlertStore();
  const rt: AlertsRuntime = { store, mailer, secret: SECRET };
  return { rt, mailer, store };
}

const fridge: Product = makeProduct({ title: "National Luna 40L <Legacy>", storeId: "nationalluna", externalId: "40", priceZar: 12200 });
const ctx = { ipHash: "ip-1", now: NOW, siteUrl: SITE };

function linkFrom(email: Email, path: string): string {
  const match = email.text.match(new RegExp(`${SITE}${path}\\?token=([\\w.-]+)`));
  if (!match) throw new Error(`no ${path} link in ${email.text}`);
  return match[1];
}

describe("tokens", () => {
  it("confirm tokens round-trip and expire", () => {
    const token = confirmToken("alert-1", SECRET, NOW.getTime());
    expect(readConfirmToken(token, SECRET, NOW.getTime())).toEqual({ ok: true, alertId: "alert-1" });
    const later = NOW.getTime() + (CONFIRM_LINK_HOURS + 1) * 3_600_000;
    expect(readConfirmToken(token, SECRET, later)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects tampered tokens, other secrets and the wrong kind", () => {
    const token = manageToken("Someone@Example.com ", SECRET);
    expect(readManageToken(token, SECRET)).toBe("someone@example.com");
    expect(readManageToken(token, "y".repeat(40))).toBeNull();
    const [body, mac] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ kind: "manage", email: "other@example.com" })).toString("base64url");
    expect(readManageToken(`${forged}.${mac}`, SECRET)).toBeNull();
    expect(readManageToken(`${body}.${mac}.x`, SECRET)).toBeNull();
    expect(readConfirmToken(token, SECRET)).toEqual({ ok: false, reason: "invalid" });
  });

  it("hashes network addresses with the secret", () => {
    expect(hashAddress("1.2.3.4", SECRET)).not.toContain("1.2.3.4");
    expect(hashAddress("1.2.3.4", SECRET)).toBe(hashAddress("1.2.3.4", SECRET));
    expect(hashAddress("1.2.3.4", SECRET)).not.toBe(hashAddress("1.2.3.4", "z".repeat(40)));
  });

  it("hashes email addresses the same however they're typed, and apart from network addresses", () => {
    expect(hashEmail(" A@B.co", SECRET)).toBe(hashEmail("a@b.co", SECRET));
    expect(hashEmail("a@b.co", SECRET)).not.toContain("a@b.co");
    expect(hashEmail("a@b.co", SECRET)).not.toBe(hashAddress("a@b.co", SECRET));
  });
});

describe("requestAlert and confirmAlert", () => {
  it("creates an unconfirmed alert, emails a link, and confirms it", async () => {
    const { rt, mailer, store } = runtime();
    expect(await requestAlert(rt, { email: " Ces@Example.com", targetZar: 11000, product: fridge }, ctx)).toEqual({ ok: true });
    const [alert] = await store.listByEmail("ces@example.com");
    expect(alert).toMatchObject({ productId: fridge.id, targetZar: 11000, priceWhenSetZar: 12200, confirmedAt: null });
    expect(await store.active()).toEqual([]);

    expect(mailer.sent).toHaveLength(1);
    const outcome = await confirmAlert(rt, linkFrom(mailer.sent[0], "/alerts/confirm"), NOW);
    expect(outcome).toMatchObject({ ok: true, alert: { id: alert.id } });
    expect(await store.active()).toHaveLength(1);
  });

  it("refuses a target at or above the current price", async () => {
    const { rt } = runtime();
    expect(await requestAlert(rt, { email: "a@b.co", targetZar: 12200, product: fridge }, ctx)).toMatchObject({ ok: false, field: "targetZar" });
  });

  it("keeps a confirmed alert until a new one on the same product is confirmed", async () => {
    const { rt, mailer, store } = runtime();
    await requestAlert(rt, { email: "a@b.co", targetZar: 11000, product: fridge }, ctx);
    await confirmAlert(rt, linkFrom(mailer.sent[0], "/alerts/confirm"), NOW);

    // Anyone can ask with the address; the confirmed alert stays live until the owner confirms.
    const later = new Date(NOW.getTime() + 60_000);
    await requestAlert(rt, { email: "a@b.co", targetZar: 10000, product: fridge }, { ...ctx, ipHash: "someone-else", now: later });
    expect((await store.active()).map((a) => a.targetZar)).toEqual([11000]);
    expect(await store.listByEmail("a@b.co")).toHaveLength(2);

    await confirmAlert(rt, linkFrom(mailer.sent[1], "/alerts/confirm"), later);
    expect((await store.listByEmail("a@b.co")).map((a) => a.targetZar)).toEqual([10000]);
    expect(await store.active()).toHaveLength(1);
  });

  it("keeps the newer target when the emails are confirmed out of order or at once", async () => {
    const later = new Date(NOW.getTime() + 60_000);
    for (const order of ["older first", "together"] as const) {
      const { rt, mailer, store } = runtime();
      await requestAlert(rt, { email: "a@b.co", targetZar: 11000, product: fridge }, ctx);
      await requestAlert(rt, { email: "a@b.co", targetZar: 10000, product: fridge }, { ...ctx, now: later });
      const [older, newer] = mailer.sent.map((e) => linkFrom(e, "/alerts/confirm"));
      if (order === "older first") {
        await confirmAlert(rt, older, later);
        await confirmAlert(rt, newer, later);
      } else {
        await Promise.all([confirmAlert(rt, older, later), confirmAlert(rt, newer, later)]);
      }
      expect((await store.active()).map((a) => a.targetZar), order).toEqual([10000]);
    }
  });

  it("counts open alerts by product, so a pending replacement doesn't use up the cap", async () => {
    const { rt, store } = runtime();
    for (let i = 0; i < MAX_ALERTS_PER_EMAIL - 1; i++) {
      await store.create({ email: "a@b.co", productId: `p${i}`, productTitle: "x", storeId: "tentco", targetZar: 1, priceWhenSetZar: 2 }, NOW);
    }
    await store.create({ email: "a@b.co", productId: fridge.id, productTitle: "x", storeId: "nationalluna", targetZar: 1, priceWhenSetZar: 2 }, NOW);
    expect((await requestAlert(rt, { email: "a@b.co", targetZar: 11000, product: fridge }, ctx)).ok).toBe(true);
  });

  it("limits requests per address per day", async () => {
    const { rt } = runtime();
    for (let i = 0; i < MAX_REQUESTS_PER_EMAIL_PER_DAY; i++) {
      const p = makeProduct({ title: `Item ${i}`, priceZar: 500 });
      expect((await requestAlert(rt, { email: "a@b.co", targetZar: 400, product: p }, { ...ctx, ipHash: `ip-${i}` })).ok).toBe(true);
    }
    expect((await requestAlert(rt, { email: "a@b.co", targetZar: 11000, product: fridge }, { ...ctx, ipHash: "ip-new" })).ok).toBe(false);
  });

  it("keeps the daily limit after the address's alerts are deleted", async () => {
    const { rt, store } = runtime();
    for (let i = 0; i < MAX_REQUESTS_PER_EMAIL_PER_DAY; i++) {
      await requestAlert(rt, { email: "a@b.co", targetZar: 400, product: makeProduct({ title: `Item ${i}`, priceZar: 500 }) }, ctx);
    }
    // What one-click unsubscribe and "delete all" do, with the token from any email.
    await store.deleteAllForEmail("a@b.co");
    expect((await requestAlert(rt, { email: "a@b.co", targetZar: 11000, product: fridge }, ctx)).ok).toBe(false);
  });

  it("holds the limit when requests arrive together", async () => {
    const { rt, mailer } = runtime();
    const outcomes = await Promise.all(
      Array.from({ length: 3 * MAX_REQUESTS_PER_EMAIL_PER_DAY }, (_, i) =>
        requestAlert(rt, { email: "a@b.co", targetZar: 400, product: makeProduct({ title: `Item ${i}`, priceZar: 500 }) }, ctx),
      ),
    );
    expect(outcomes.filter((o) => o.ok)).toHaveLength(MAX_REQUESTS_PER_EMAIL_PER_DAY);
    expect(mailer.sent).toHaveLength(MAX_REQUESTS_PER_EMAIL_PER_DAY);
  });

  it("limits open alerts per address", async () => {
    const { rt, store } = runtime();
    for (let i = 0; i < MAX_ALERTS_PER_EMAIL; i++) {
      await store.create({ email: "a@b.co", productId: `p${i}`, productTitle: "x", storeId: "tentco", targetZar: 1, priceWhenSetZar: 2 }, NOW);
    }
    expect(await requestAlert(rt, { email: "a@b.co", targetZar: 11000, product: fridge }, ctx)).toMatchObject({ ok: false, field: "email" });
  });

  it("stops sending once the site's daily email budget is spent", async () => {
    const { rt, store } = runtime();
    const roomy = { since: new Date(0), perEmail: 1_000, perNetwork: 1_000, sitewide: 1_000 };
    for (let i = 0; i < MAX_SITE_EMAILS_PER_DAY; i++) {
      await store.claimRequest({ kind: "alert", emailHash: `e${i}`, ipHash: `ip${i}` }, roomy, NOW);
    }
    expect(await requestAlert(rt, { email: "new@b.co", targetZar: 11000, product: fridge }, ctx)).toMatchObject({ ok: false });
  });

  it("removes the alert when the confirmation email can't be sent", async () => {
    const { rt, mailer, store } = runtime();
    mailer.failFor.add("a@b.co");
    expect((await requestAlert(rt, { email: "a@b.co", targetZar: 11000, product: fridge }, ctx)).ok).toBe(false);
    expect(await store.listByEmail("a@b.co")).toEqual([]);
  });

  it("says a deleted alert's link has nothing to confirm", async () => {
    const { rt } = runtime();
    expect(await confirmAlert(rt, confirmToken("missing", SECRET, NOW.getTime()), NOW)).toEqual({ ok: false, reason: "gone" });
  });
});

describe("sendManageLink", () => {
  it("sends only to an address with alerts, answering the same either way", async () => {
    const { rt, mailer } = runtime();
    await requestAlert(rt, { email: "a@b.co", targetZar: 11000, product: fridge }, ctx);
    mailer.sent = [];
    expect(await sendManageLink(rt, "nobody@b.co", ctx)).toEqual({ ok: true });
    expect(mailer.sent).toHaveLength(0);
    expect(await sendManageLink(rt, "A@B.co", ctx)).toEqual({ ok: true });
    expect(readManageToken(linkFrom(mailer.sent[0], "/alerts/manage"), SECRET)).toBe("a@b.co");
  });

  it("can answer before looking the address up, and send afterwards", async () => {
    const { rt, mailer, store } = runtime();
    await store.create({ email: "has@b.co", productId: fridge.id, productTitle: "x", storeId: "nationalluna", targetZar: 1, priceWhenSetZar: 2 }, NOW);
    const later: (() => Promise<void>)[] = [];
    const defer = (task: () => Promise<void>) => void later.push(task);

    expect(await sendManageLink(rt, "has@b.co", { ...ctx, defer })).toEqual({ ok: true });
    expect(mailer.sent).toHaveLength(0);
    await later[0]();
    expect(mailer.sent).toHaveLength(1);

    // A send that fails after the answer is logged, not thrown.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mailer.failFor.add("has@b.co");
    await sendManageLink(rt, "has@b.co", { ...ctx, defer });
    await expect(later[1]()).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("reaches the daily limit at the same point whether or not the address has alerts", async () => {
    const { rt, store } = runtime();
    await store.create({ email: "has@b.co", productId: fridge.id, productTitle: "x", storeId: "nationalluna", targetZar: 1, priceWhenSetZar: 2 }, NOW);
    const okUntilRefused = async (email: string) => {
      const outcomes = [];
      for (let i = 0; i <= MAX_REQUESTS_PER_EMAIL_PER_DAY; i++) outcomes.push((await sendManageLink(rt, email, ctx)).ok);
      return outcomes;
    };
    expect(await okUntilRefused("has@b.co")).toEqual(await okUntilRefused("none@b.co"));
    expect((await okUntilRefused("other@b.co")).at(-1)).toBe(false);
  });
});

describe("dueAlerts and runAlertJob", () => {
  const cheap = { ...fridge, priceZar: 10500 };

  async function activeAlert(store: MemoryAlertStore, email: string, productId: string, targetZar: number) {
    const a = await store.create({ email, productId, productTitle: "x", storeId: "nationalluna", targetZar, priceWhenSetZar: 12200 }, NOW);
    await store.confirm(a.id, NOW);
    return a;
  }

  it("sends when the product is in stock at or under the target, grouping by address", async () => {
    const { store } = runtime();
    const tent = makeProduct({ title: "Tent", storeId: "tentco", externalId: "t", priceZar: 900 });
    await activeAlert(store, "a@b.co", fridge.id, 11000);
    await activeAlert(store, "a@b.co", tent.id, 900);
    await activeAlert(store, "c@d.co", fridge.id, 10000);
    const products = new Map([
      [fridge.id, cheap],
      [tent.id, tent],
    ]);
    const due = dueAlerts(await store.active(), (id) => products.get(id) ?? null, () => "2026-11-18", "2026-11-18");
    expect([...due.send.keys()]).toEqual(["a@b.co"]);
    expect(due.send.get("a@b.co")).toHaveLength(2);
  });

  it("doesn't send for an out-of-stock product", async () => {
    const { store } = runtime();
    await activeAlert(store, "a@b.co", fridge.id, 11000);
    const due = dueAlerts(await store.active(), () => ({ ...cheap, inStock: false }), () => null, "2026-11-18");
    expect(due.send.size).toBe(0);
  });

  it("closes an alert once its product has been gone long enough", async () => {
    const { store } = runtime();
    await activeAlert(store, "a@b.co", fridge.id, 11000);
    const active = await store.active();
    expect(dueAlerts(active, () => null, () => "2026-11-10", "2026-11-18").close).toEqual([]);
    const later = new Date(Date.parse("2026-11-10") + MISSING_PRODUCT_DAYS * 86_400_000).toISOString().slice(0, 10);
    expect(dueAlerts(active, () => null, () => "2026-11-10", later).close).toHaveLength(1);
  });

  it("emails once per address, marks alerts sent, and retries failed addresses tomorrow", async () => {
    const { rt, mailer, store } = runtime();
    await activeAlert(store, "a@b.co", fridge.id, 11000);
    await activeAlert(store, "fails@b.co", fridge.id, 11000);
    mailer.failFor.add("fails@b.co");
    const result = await runAlertJob(rt, { productById: () => cheap, lastSeen: () => "2026-11-18", today: "2026-11-18" }, { now: NOW, siteUrl: SITE });
    expect(result).toMatchObject({ emailsSent: 1, alertsSent: 1, failedAddresses: 1 });
    expect(mailer.sent[0].subject).toBe("National Luna 40L <Legacy> is R10 500 at National Luna");
    expect((await store.active()).map((a) => a.email)).toEqual(["fails@b.co"]);
  });
});

describe("emails", () => {
  it("escapes store-supplied text in HTML", () => {
    expect(escapeHtml(`<b>"Tom's" & co</b>`)).toBe("&lt;b&gt;&quot;Tom&#39;s&quot; &amp; co&lt;/b&gt;");
    const email = confirmEmail({
      to: "a@b.co",
      productTitle: "<script>x</script>",
      storeName: "Tentco",
      targetZar: 1,
      priceZar: 2,
      confirmUrl: `${SITE}/c`,
      manageUrl: `${SITE}/m`,
    });
    expect(email.html).not.toContain("<script>");
  });

  it("carries one-click unsubscribe headers on alert emails", () => {
    const email = alertEmail("a@b.co", [], `${SITE}/m`, `${SITE}/u`);
    expect(email.headers).toEqual({ "List-Unsubscribe": `<${SITE}/u>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
  });
});
