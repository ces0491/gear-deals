import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";

import { ConfirmAlertForm } from "@/components/alert-forms";
import { alertsRuntime } from "@/lib/alerts/runtime";
import { readConfirmToken } from "@/lib/alerts/tokens";
import { productById } from "@/lib/data/catalogue";
import { formatRand } from "@/lib/format";
import { productPath } from "@/lib/paths";
import { storeById } from "@/lib/stores/registry";

export const metadata: Metadata = { title: "Confirm your price alert", robots: { index: false } };

async function Confirm({ searchParams }: { searchParams: PageProps<"/alerts/confirm">["searchParams"] }) {
  const { token } = await searchParams;
  const rt = alertsRuntime();
  if (!rt) return <p className="text-ink-muted">Price alerts aren&rsquo;t available right now.</p>;
  // The expiry check reads the clock, which Cache Components only allows after io().
  await io();
  const check = typeof token === "string" ? readConfirmToken(token, rt.secret) : ({ ok: false, reason: "invalid" } as const);
  if (!check.ok) {
    return (
      <p role="alert" className="text-danger">
        {check.reason === "expired"
          ? "This confirmation link has expired. Set the alert again from the product page."
          : "This confirmation link isn't valid. Copy the whole link from the email."}
      </p>
    );
  }
  const alert = await rt.store.get(check.alertId);
  if (!alert) return <p className="text-danger">This alert has been deleted. Set it again from the product page.</p>;
  const product = productById(alert.productId);
  return (
    <div className="max-w-prose">
      <p className="text-lg">
        Email <strong>{alert.email}</strong> once when{" "}
        {product ? (
          <Link href={productPath(product)} className="text-canvas underline">
            {alert.productTitle}
          </Link>
        ) : (
          alert.productTitle
        )}{" "}
        at {storeById(alert.storeId).name} is in stock at <strong>{formatRand(alert.targetZar)}</strong> or less.
      </p>
      {alert.confirmedAt ? <p className="mt-4 font-medium text-canvas-strong">This alert is already confirmed.</p> : <ConfirmAlertForm token={token as string} />}
    </div>
  );
}

export default function ConfirmPage({ searchParams }: PageProps<"/alerts/confirm">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
      <h1 className="narrow mb-4 text-4xl font-extrabold sm:text-5xl">Confirm your price alert</h1>
      <Suspense fallback={<p className="text-ink-muted">Loading the alert…</p>}>
        <Confirm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
