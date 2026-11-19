import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { deleteAlertAction, deleteEverythingAction } from "@/app/alerts/actions";
import type { AlertRecord } from "@/lib/alerts/store";
import { alertsRuntime } from "@/lib/alerts/runtime";
import { readManageToken } from "@/lib/alerts/tokens";
import { productById } from "@/lib/data/catalogue";
import { formatDisplayDate, todayInSouthAfrica } from "@/lib/dates";
import { formatRand } from "@/lib/format";
import { productPath } from "@/lib/paths";
import { storeById } from "@/lib/stores/registry";

export const metadata: Metadata = { title: "Your price alerts", robots: { index: false } };

const DONE: Record<string, string> = {
  confirmed: "Alert confirmed. You'll get one email when it hits your price.",
  deleted: "Alert deleted.",
  "all-deleted": "Every alert for this address has been deleted.",
};

function status(a: AlertRecord): string {
  const day = (iso: string) => formatDisplayDate(todayInSouthAfrica(new Date(iso)));
  if (a.closedReason) return `Closed: ${a.closedReason}`;
  if (a.firedAt) return `Sent ${day(a.firedAt)}, when it was ${formatRand(a.firedPriceZar ?? 0)}`;
  if (a.confirmedAt) return "Waiting for the price";
  return "Waiting for you to confirm it from the email";
}

async function Manage({ searchParams }: { searchParams: PageProps<"/alerts/manage">["searchParams"] }) {
  const { token, done } = await searchParams;
  const rt = alertsRuntime();
  if (!rt) return <p className="text-ink-muted">Price alerts aren&rsquo;t available right now.</p>;
  const email = typeof token === "string" ? readManageToken(token, rt.secret) : null;
  if (!email) {
    return (
      <p role="alert" className="text-danger">
        This link isn&rsquo;t valid.{" "}
        <Link href="/alerts" className="underline">
          Get a new one
        </Link>
        .
      </p>
    );
  }
  const alerts = await rt.store.listByEmail(email);
  const message = typeof done === "string" ? DONE[done] : undefined;
  return (
    <div className="space-y-6">
      {message && (
        <p role="status" className="rounded-md border border-canvas bg-canvas-wash p-4 font-medium text-canvas-strong">
          {message}
        </p>
      )}
      <p className="text-lg">
        Alerts for <strong>{email}</strong>
      </p>
      {alerts.length === 0 ? (
        <p className="text-ink-muted">
          No alerts are held for this address. Set one from any product&rsquo;s page.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {alerts.map((a) => {
            const product = productById(a.productId);
            return (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div className="min-w-0 space-y-1">
                  {product ? (
                    <Link href={productPath(product)} className="font-medium underline-offset-2 hover:underline">
                      {a.productTitle}
                    </Link>
                  ) : (
                    <span className="font-medium">{a.productTitle}</span>
                  )}
                  <p className="text-sm text-ink-muted">
                    At {storeById(a.storeId).name}, at or under {formatRand(a.targetZar)}
                    {product && <>, {formatRand(product.priceZar)} now</>}
                  </p>
                  <p className="text-sm">{status(a)}</p>
                </div>
                <form action={deleteAlertAction}>
                  <input type="hidden" name="token" value={token as string} />
                  <input type="hidden" name="alertId" value={a.id} />
                  <button type="submit" className="rounded border border-line bg-surface px-3 py-1.5 text-sm hover:border-danger hover:text-danger">
                    Delete<span className="sr-only"> the alert on {a.productTitle}</span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
      {alerts.length > 0 && (
        <form action={deleteEverythingAction} className="border-t border-line pt-6">
          <input type="hidden" name="token" value={token as string} />
          <p className="mb-3 max-w-prose text-ink-muted">
            Deletes every alert for this address. Nothing more will be sent to it.
          </p>
          <button type="submit" className="rounded border border-danger px-4 py-2 font-semibold text-danger">
            Delete all alerts for this address
          </button>
        </form>
      )}
    </div>
  );
}

export default function ManagePage({ searchParams }: PageProps<"/alerts/manage">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
      <h1 className="narrow mb-4 text-4xl font-extrabold sm:text-5xl">Your price alerts</h1>
      <Suspense fallback={<p className="text-ink-muted">Loading your alerts…</p>}>
        <Manage searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
