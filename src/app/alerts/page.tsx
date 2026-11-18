import type { Metadata } from "next";
import { Suspense } from "react";

import { ManageLinkForm } from "@/components/alert-forms";
import { alertsRuntime } from "@/lib/alerts/runtime";

export const metadata: Metadata = {
  title: "Your price alerts",
  description: "Get the link to see and delete your price alerts.",
  robots: { index: false },
};

async function LinkError({ searchParams }: { searchParams: PageProps<"/alerts">["searchParams"] }) {
  const { error } = await searchParams;
  return error === "link" ? (
    <p role="alert" className="mt-4 text-danger">
      That alerts link isn&rsquo;t valid. Ask for a new one below.
    </p>
  ) : null;
}

export default function AlertsPage({ searchParams }: PageProps<"/alerts">) {
  const available = alertsRuntime() !== null;
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
      <h1 className="narrow text-4xl font-extrabold sm:text-5xl">Your price alerts</h1>
      <Suspense>
        <LinkError searchParams={searchParams} />
      </Suspense>
      <p className="mt-3 max-w-prose text-lg text-ink-muted">
        Every alert email has a link to a page listing your alerts, where you can delete them. Lost it? Enter your email and,
        if it has alerts, the link is sent to it.
      </p>
      {available ? <ManageLinkForm /> : <p className="mt-4 text-ink-muted">Price alerts aren&rsquo;t available right now.</p>}
    </div>
  );
}
