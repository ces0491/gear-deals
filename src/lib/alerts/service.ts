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
import type { AlertRecord } from "@/lib/alerts/store";
import { confirmToken, manageToken, normaliseEmail, readConfirmToken } from "@/lib/alerts/tokens";
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

/**
 * Creates an unconfirmed alert and emails a confirmation link. A new alert on a product
 * the address already watches replaces the old one.
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

  const since = new Date(ctx.now.getTime() - DAY_MS);
  const [byEmail, byIp, sitewide, existing] = await Promise.all([
    rt.store.countRequests({ email }, since),
    rt.store.countRequests({ ipHash: ctx.ipHash }, since),
    rt.store.countRequests({}, since),
    rt.store.listByEmail(email),
  ]);
  if (sitewide >= MAX_SITE_EMAILS_PER_DAY) {
    return { ok: false, message: "The site has sent as many emails as it can today. Try again tomorrow." };
  }
  if (byEmail >= MAX_REQUESTS_PER_EMAIL_PER_DAY || byIp >= MAX_REQUESTS_PER_IP_PER_DAY) {
    return { ok: false, message: "That's as many alerts as can be set from here today. Try again tomorrow." };
  }
  const replacing = existing.filter((a) => isOpen(a) && a.productId === product.id);
  if (existing.filter(isOpen).length - replacing.length >= MAX_ALERTS_PER_EMAIL) {
    return {
      ok: false,
      field: "email",
      message: `That address has ${MAX_ALERTS_PER_EMAIL} alerts already. Delete some using the link in any alert email.`,
    };
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
  await rt.store.logRequest({ kind: "alert", email, ipHash: ctx.ipHash }, ctx.now);
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
  // The new alert supersedes any open one on the same product, once it's safely sent.
  for (const old of replacing) await rt.store.delete(old.id, email);
  return { ok: true };
}

export type ConfirmOutcome =
  | { ok: true; alert: AlertRecord }
  | { ok: false; reason: "invalid" | "expired" | "gone" };

export async function confirmAlert(rt: AlertsRuntime, token: string, now: Date): Promise<ConfirmOutcome> {
  const check = readConfirmToken(token, rt.secret, now.getTime());
  if (!check.ok) return check;
  const alert = await rt.store.confirm(check.alertId, now);
  return alert ? { ok: true, alert } : { ok: false, reason: "gone" };
}

/**
 * Emails the manage link to an address that has alerts. Says the same whether or not it
 * has any, so the form can't be used to find out who has alerts.
 */
export async function sendManageLink(
  rt: AlertsRuntime,
  rawEmail: string,
  ctx: { ipHash: string; now: Date; siteUrl: string },
): Promise<RequestOutcome> {
  const email = normaliseEmail(rawEmail);
  const since = new Date(ctx.now.getTime() - DAY_MS);
  const [byEmail, byIp, sitewide] = await Promise.all([
    rt.store.countRequests({ email }, since),
    rt.store.countRequests({ ipHash: ctx.ipHash }, since),
    rt.store.countRequests({}, since),
  ]);
  if (sitewide >= MAX_SITE_EMAILS_PER_DAY || byEmail >= MAX_REQUESTS_PER_EMAIL_PER_DAY || byIp >= MAX_REQUESTS_PER_IP_PER_DAY) {
    return { ok: false, message: "That's as many emails as can be sent from here today. Try again tomorrow." };
  }
  const alerts = await rt.store.listByEmail(email);
  if (alerts.length > 0) {
    await rt.store.logRequest({ kind: "manage-link", email, ipHash: ctx.ipHash }, ctx.now);
    await rt.mailer.send(manageLinkEmail(email, manageUrl(ctx.siteUrl, email, rt.secret)));
  }
  return { ok: true };
}
