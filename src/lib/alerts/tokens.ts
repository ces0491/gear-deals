/**
 * Signed links for alerts, so no secret has to be stored with them:
 *
 * - a confirm token names one alert and expires after CONFIRM_LINK_HOURS
 * - a manage token names an email address and doesn't expire; it opens the page that
 *   lists and deletes that address's alerts, and is in every email sent to it
 *
 * Each is `<base64url payload>.<base64url HMAC-SHA256>`, keyed by ALERTS_SECRET.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { CONFIRM_LINK_HOURS } from "@/lib/alerts/config";

type Payload = { kind: "confirm"; alertId: string; expires: number } | { kind: "manage"; email: string };

const b64 = (buf: Buffer) => buf.toString("base64url");

function sign(body: string, secret: string): string {
  return b64(createHmac("sha256", secret).update(body).digest());
}

function encode(payload: Payload, secret: string): string {
  const body = b64(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body, secret)}`;
}

function decode(token: string, secret: string): Payload | null {
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra !== undefined) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
  } catch {
    return null;
  }
}

export function confirmToken(alertId: string, secret: string, now: number = Date.now()): string {
  return encode({ kind: "confirm", alertId, expires: now + CONFIRM_LINK_HOURS * 3_600_000 }, secret);
}

export type ConfirmTokenCheck = { ok: true; alertId: string } | { ok: false; reason: "invalid" | "expired" };

export function readConfirmToken(token: string, secret: string, now: number = Date.now()): ConfirmTokenCheck {
  const p = decode(token, secret);
  if (!p || p.kind !== "confirm" || typeof p.alertId !== "string") return { ok: false, reason: "invalid" };
  if (p.expires < now) return { ok: false, reason: "expired" };
  return { ok: true, alertId: p.alertId };
}

export function manageToken(email: string, secret: string): string {
  return encode({ kind: "manage", email: normaliseEmail(email) }, secret);
}

export function readManageToken(token: string, secret: string): string | null {
  const p = decode(token, secret);
  return p && p.kind === "manage" && typeof p.email === "string" ? p.email : null;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A network address, hashed with the secret so the request log never holds the address itself. */
export function hashAddress(address: string, secret: string): string {
  return createHash("sha256").update(`${secret}|${address}`).digest("base64url").slice(0, 32);
}
