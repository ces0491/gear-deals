import { SENT_RETENTION_DAYS, REQUEST_LOG_RETENTION_DAYS, UNCONFIRMED_RETENTION_DAYS } from "@/lib/alerts/config";
import { alertEmail } from "@/lib/alerts/emails";
import { dueAlerts } from "@/lib/alerts/rules";
import type { AlertsRuntime } from "@/lib/alerts/runtime";
import { manageUrl, productUrl, unsubscribeUrl } from "@/lib/alerts/service";
import type { Product } from "@/lib/catalogue/types";
import { storeById } from "@/lib/stores/registry";

const DAY_MS = 86_400_000;

export interface AlertJobResult {
  emailsSent: number;
  alertsSent: number;
  closed: number;
  failedAddresses: number;
  purged: Record<string, number>;
}

/**
 * The morning run after prices are published: email each address whose alerts hit (one
 * email per address), mark those alerts sent, close alerts on products no longer listed,
 * and delete what's past its retention. A failed send leaves that address's alerts
 * active, so they're tried again the next morning.
 */
export async function runAlertJob(
  rt: AlertsRuntime,
  catalogue: { productById: (id: string) => Product | null; lastSeen: (id: string) => string | null; today: string },
  ctx: { now: Date; siteUrl: string; log?: (line: string) => void },
): Promise<AlertJobResult> {
  const log = ctx.log ?? (() => {});
  const due = dueAlerts(await rt.store.active(), catalogue.productById, catalogue.lastSeen, catalogue.today);

  let emailsSent = 0;
  let alertsSent = 0;
  let failedAddresses = 0;
  for (const [email, hits] of due.send) {
    const message = alertEmail(
      email,
      hits.map(({ alert, product }) => ({
        productTitle: product.title,
        storeName: storeById(product.storeId).name,
        priceZar: product.priceZar,
        targetZar: alert.targetZar,
        storeUrl: product.url,
        pageUrl: productUrl(ctx.siteUrl, product),
      })),
      manageUrl(ctx.siteUrl, email, rt.secret),
      unsubscribeUrl(ctx.siteUrl, email, rt.secret),
    );
    try {
      await rt.mailer.send(message);
    } catch (error) {
      failedAddresses += 1;
      log(`send failed for one address: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    await rt.store.markFired(
      hits.map(({ alert, product }) => ({ id: alert.id, priceZar: product.priceZar })),
      ctx.now,
    );
    emailsSent += 1;
    alertsSent += hits.length;
  }

  for (const c of due.close) await rt.store.close([c.id], c.reason, ctx.now);

  const purged = await rt.store.purge({
    unconfirmedBefore: new Date(ctx.now.getTime() - UNCONFIRMED_RETENTION_DAYS * DAY_MS),
    sentBefore: new Date(ctx.now.getTime() - SENT_RETENTION_DAYS * DAY_MS),
    requestsBefore: new Date(ctx.now.getTime() - REQUEST_LOG_RETENTION_DAYS * DAY_MS),
  });

  return { emailsSent, alertsSent, closed: due.close.length, failedAddresses, purged };
}
