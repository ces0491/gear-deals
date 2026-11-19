/**
 * Asking for, confirming and managing alerts. Server actions and the alert job call
 * these with an AlertsRuntime; the tests call them with the memory store and a mailer
 * that collects emails.
 */
import {
  MAX_ALERTS_PER_EMAIL,
  MAX_REQUESTS_PER_EMAIL_PER_DAY,
  MAX_REQUESTS_PER_IP_PER_DAY,
  MAX_SITE_EMAILS_PER_DAY,
} from "@/lib/alerts/config";
import { confirmEmail, manageLinkEmail } from "@/lib/alerts/emails";
import type { AlertsRuntime } from "@/lib/alerts/runtime";
import type { AlertRecord, RequestLimits } from "@/lib/alerts/store";
import { confirmToken, hashEmail, manageToken, normaliseEmail, readConfirmToken } from "@/lib/alerts/tokens";
import type { Product } from "@/lib/catalogue/types";
import { formatRand } from "@/lib/format";
import { productPath } from "@/lib/paths";
import { storeById } from "@/lib/stores/registry";

const DAY_MS = 86_400_000;

export function confirmUrl(siteUrl: string, alertId: string, secret: string, now: Date): string {
  return `${siteUrl}/alerts/confirm?token=${confirmToken(alertId, secret, now.getTime())}`;
}

export function manageUrl(siteUrl: string, email: string, secret: string): string {
  return `${siteUrl}/alerts/manage?token=${manageToken(email, secret)}`;
}

export function unsubscribeUrl(siteUrl: string, email: string, secret: string): string {
  return `${siteUrl}/api/alerts/unsubscribe?token=${manageToken(email, secret)}`;
}

export function productUrl(siteUrl: string, product: Pick<Product, "storeId" | "externalId">): string {
  return `${siteUrl}${productPath(product)}`;
}

export type RequestOutcome = { ok: true } | { ok: false; field?: "email" | "targetZar"; message: string };

const isOpen = (a: AlertRecord) => !a.firedAt && !a.closedReason;

function dailyLimits(now: Date): RequestLimits {
  return {
    since: new Date(now.getTime() - DAY_MS),
    perEmail: MAX_REQUESTS_PER_EMAIL_PER_DAY,
    perNetwork: MAX_REQUESTS_PER_IP_PER_DAY,
    sitewide: MAX_SITE_EMAILS_PER_DAY,
  };
}

/**
 * Creates an unconfirmed alert and emails a confirmation link. An open alert the address
 * already has on the product stays until the new one is confirmed (see confirmAlert), so
 * someone else asking with that address can't cancel it.
 */
export async function requestAlert(
  rt: AlertsRuntime,
  input: { email: string; targetZar: number; product: Product },
  ctx: { ipHash: string; now: Date; siteUrl: string },
): Promise<RequestOutcome> {
  const email = normaliseEmail(input.email);
  const { product, targetZar } = input;
  if (targetZar >= product.priceZar) {
    return { ok: false, field: "targetZar", message: `It's already ${formatRand(product.priceZar)}. Pick a price below that.` };
  }

  // Counted by product: alerts waiting to replace one on the same product don't add to the total.
  const watched = new Set((await rt.store.listByEmail(email)).filter(isOpen).map((a) => a.productId));
  watched.delete(product.id);
  if (watched.size >= MAX_ALERTS_PER_EMAIL) {
    return {
      ok: false,
      field: "email",
      message: `That address has ${MAX_ALERTS_PER_EMAIL} alerts already. Delete some using the link in any alert email.`,
    };
  }

  const claim = await rt.store.claimRequest(
    { kind: "alert", emailHash: hashEmail(email, rt.secret), ipHash: ctx.ipHash },
    dailyLimits(ctx.now),
    ctx.now,
  );
  if (!claim.ok) {
    return claim.limit === "sitewide"
      ? { ok: false, message: "The site has sent as many emails as it can today. Try again tomorrow." }
      : { ok: false, message: "That's as many alerts as can be set from here today. Try again tomorrow." };
  }

  const alert = await rt.store.create(
    {
      email,
      productId: product.id,
      productTitle: product.title,
      storeId: product.storeId,
      targetZar,
      priceWhenSetZar: product.priceZar,
    },
    ctx.now,
  );
  try {
    await rt.mailer.send(
      confirmEmail({
        to: email,
        productTitle: product.title,
        storeName: storeById(product.storeId).name,
        targetZar,
        priceZar: product.priceZar,
        confirmUrl: confirmUrl(ctx.siteUrl, alert.id, rt.secret, ctx.now),
        manageUrl: manageUrl(ctx.siteUrl, email, rt.secret),
      }),
    );
  } catch (error) {
    console.error("[alerts] confirmation email failed", error);
    await rt.store.delete(alert.id, email);
    return { ok: false, message: "The confirmation email couldn't be sent. Try again in a few minutes." };
  }
  return { ok: true };
}

export type ConfirmOutcome =
  | { ok: true; alert: AlertRecord }
  | { ok: false; reason: "invalid" | "expired" | "gone" };

/** Makes the alert live. It replaces any other open alert the address has on the same product. */
export async function confirmAlert(rt: AlertsRuntime, token: string, now: Date): Promise<ConfirmOutcome> {
  const check = readConfirmToken(token, rt.secret, now.getTime());
  if (!check.ok) return check;
  const alert = await rt.store.confirm(check.alertId, now);
  if (!alert) return { ok: false, reason: "gone" };
  const replaced = (await rt.store.listByEmail(alert.email)).filter(
    (a) => a.id !== alert.id && a.productId === alert.productId && isOpen(a),
  );
  for (const old of replaced) await rt.store.delete(old.id, alert.email);
  return { ok: true, alert };
}

/**
 * Emails the manage link to an address that has alerts. Says the same whether or not it
 * has any, and counts the request against the limits either way, so neither the answer
 * nor reaching a limit shows who has alerts.
 */
export async function sendManageLink(
  rt: AlertsRuntime,
  rawEmail: string,
  ctx: { ipHash: string; now: Date; siteUrl: string },
): Promise<RequestOutcome> {
  const email = normaliseEmail(rawEmail);
  const claim = await rt.store.claimRequest(
    { kind: "manage-link", emailHash: hashEmail(email, rt.secret), ipHash: ctx.ipHash },
    dailyLimits(ctx.now),
    ctx.now,
  );
  if (!claim.ok) {
    return { ok: false, message: "That's as many emails as can be sent from here today. Try again tomorrow." };
  }
  const alerts = await rt.store.listByEmail(email);
  if (alerts.length > 0) await rt.mailer.send(manageLinkEmail(email, manageUrl(ctx.siteUrl, email, rt.secret)));
  return { ok: true };
}
