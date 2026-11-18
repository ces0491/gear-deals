/**
 * The three emails the site sends: confirm an alert, an alert that hit, and a link to
 * manage an address's alerts. Plain HTML with a text version; product names come from
 * stores, so everything interpolated is escaped.
 */
import type { Email } from "@/lib/alerts/mailer";
import { CONFIRM_LINK_HOURS } from "@/lib/alerts/config";
import { formatRand } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function layout(body: string): string {
  return `<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#e6e8e4;font-family:Arial,Helvetica,sans-serif;color:#1e2325;line-height:1.5">
<div style="max-width:560px;margin:0 auto;background:#f7f8f5;border:1px solid #c6ccc6;border-radius:6px;padding:24px">
<p style="margin:0 0 16px;font-weight:bold;letter-spacing:0.02em">${SITE_NAME.toUpperCase()}</p>
${body}
</div></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#475631;color:#ffffff;padding:10px 16px;border-radius:4px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>`;
}

export interface ConfirmEmailInput {
  to: string;
  productTitle: string;
  storeName: string;
  targetZar: number;
  priceZar: number;
  confirmUrl: string;
  manageUrl: string;
}

export function confirmEmail(i: ConfirmEmailInput): Email {
  const what = `${i.productTitle} at ${i.storeName}`;
  const ask = `You asked to be emailed when ${what} is ${formatRand(i.targetZar)} or less. It's ${formatRand(i.priceZar)} now.`;
  const ignore = "If you didn't ask for this, ignore this email and nothing more will be sent.";
  return {
    to: i.to,
    subject: `Confirm your price alert: ${i.productTitle}`,
    text: `${ask}\n\nConfirm the alert (the link works for ${CONFIRM_LINK_HOURS} hours):\n${i.confirmUrl}\n\n${ignore}\n\nSee or delete your alerts: ${i.manageUrl}\n`,
    html: layout(
      `<p>${escapeHtml(ask)}</p>${button(i.confirmUrl, "Confirm alert")}<p style="color:#545d61;font-size:14px">The link works for ${CONFIRM_LINK_HOURS} hours. ${escapeHtml(ignore)}</p>
<p style="color:#545d61;font-size:14px"><a href="${escapeHtml(i.manageUrl)}" style="color:#475631">See or delete your alerts</a></p>`,
    ),
  };
}

export interface AlertHit {
  productTitle: string;
  storeName: string;
  priceZar: number;
  targetZar: number;
  storeUrl: string;
  pageUrl: string;
}

export function alertEmail(to: string, hits: readonly AlertHit[], manageUrl: string, unsubscribeUrl: string): Email {
  const subject =
    hits.length === 1
      ? `${hits[0].productTitle} is ${formatRand(hits[0].priceZar)} at ${hits[0].storeName}`
      : `${hits.length} of your price alerts hit today`;
  const closing = "Each alert sends once and then closes. Set it again on the product page if you'd like another.";
  const lines = hits.map(
    (h) =>
      `${h.productTitle} at ${h.storeName}: ${formatRand(h.priceZar)}, at or under your ${formatRand(h.targetZar)}.\nBuy at ${h.storeName}: ${h.storeUrl}\nPrice history: ${h.pageUrl}`,
  );
  const items = hits
    .map(
      (h) => `<li style="margin:0 0 16px">
<strong>${escapeHtml(h.productTitle)}</strong> at ${escapeHtml(h.storeName)}<br>
<span style="font-size:20px;font-weight:bold">${formatRand(h.priceZar)}</span>, at or under your ${formatRand(h.targetZar)}<br>
<a href="${escapeHtml(h.storeUrl)}" style="color:#475631">Buy at ${escapeHtml(h.storeName)}</a> &nbsp; <a href="${escapeHtml(h.pageUrl)}" style="color:#475631">Price history</a>
</li>`,
    )
    .join("");
  return {
    to,
    subject,
    text: `${lines.join("\n\n")}\n\n${closing}\n\nSee or delete your alerts: ${manageUrl}\nStop all alerts to this address: ${unsubscribeUrl}\n`,
    html: layout(
      `<ul style="list-style:none;padding:0;margin:0">${items}</ul><p style="color:#545d61;font-size:14px">${escapeHtml(closing)} Prices can change before you buy; the store's page has the price you'll pay.</p>
<p style="color:#545d61;font-size:14px"><a href="${escapeHtml(manageUrl)}" style="color:#475631">See or delete your alerts</a> &nbsp; <a href="${escapeHtml(unsubscribeUrl)}" style="color:#475631">Stop all alerts</a></p>`,
    ),
    // One-click unsubscribe (RFC 8058): mail apps show an Unsubscribe button that POSTs here.
    headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

export function manageLinkEmail(to: string, manageUrl: string): Email {
  const text = "Here's the link to see and delete the price alerts for this address.";
  return {
    to,
    subject: `Your ${SITE_NAME} price alerts`,
    text: `${text}\n\n${manageUrl}\n\nIf you didn't ask for it, ignore this email.\n`,
    html: layout(`<p>${text}</p>${button(manageUrl, "See my alerts")}<p style="color:#545d61;font-size:14px">If you didn't ask for it, ignore this email.</p>`),
  };
}
