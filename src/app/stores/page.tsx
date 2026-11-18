import type { Metadata } from "next";
import Link from "next/link";

import { catalogue } from "@/lib/data/catalogue";
import { DEFAULT_QUERY, queryHref } from "@/lib/data/query";
import { formatDisplayDate, formatTimeInSouthAfrica, todayInSouthAfrica } from "@/lib/dates";
import { formatCount, plural } from "@/lib/format";
import { LEFT_OUT_STORES, STORES } from "@/lib/stores/registry";

export const metadata: Metadata = {
  title: "Stores",
  description: "The South African online stores whose catalogues are checked every morning, and the ones left out.",
};

function when(iso: string): string {
  return `${formatDisplayDate(todayInSouthAfrica(new Date(iso)))} at ${formatTimeInSouthAfrica(iso)}`;
}

export default function StoresPage() {
  const { products, stores } = catalogue();
  const listed = STORES.filter((s) => stores[s.id]);
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <h1 className="narrow text-4xl font-extrabold sm:text-5xl">Stores</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-muted">
        {plural(listed.length, "store")} publish a catalogue this site can read, and each is checked once every morning.
        Stores don&rsquo;t pay to be listed.
      </p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left">
          <thead>
            <tr className="border-b-2 border-ink text-sm">
              <th scope="col" className="py-2 pr-4 font-semibold">
                Store
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                Products
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                Deals
              </th>
              <th scope="col" className="py-2 font-semibold">
                Last read
              </th>
            </tr>
          </thead>
          <tbody>
            {listed.map((s) => {
              const status = stores[s.id]!;
              const own = products.filter((p) => p.storeId === s.id);
              const deals = own.filter((p) => p.deal && p.inStock).length;
              return (
                <tr key={s.id} className="border-b border-line align-top">
                  <th scope="row" className="py-3 pr-4 font-medium">
                    <a href={s.url} rel="noopener" className="underline-offset-2 hover:underline">
                      {s.name}
                    </a>
                  </th>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    <Link href={queryHref(DEFAULT_QUERY, { stores: [s.id], all: true })} className="text-canvas underline">
                      {formatCount(own.length)}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    <Link href={queryHref(DEFAULT_QUERY, { stores: [s.id] })} className="text-canvas underline">
                      {deals}
                    </Link>
                  </td>
                  <td className="py-3">
                    {status.ok ? (
                      when(status.ranAt)
                    ) : (
                      <span className="text-danger">
                        Failed {when(status.ranAt)}: {status.error}{" "}
                        {status.count > 0 && status.lastOkAt
                          ? `Showing its prices from ${when(status.lastOkAt)}.`
                          : "Its products are left out until it reads again."}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="narrow mt-12 text-3xl font-bold">Looked at and left out</h2>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Checked on 18 November 2026. A store whose site refuses automated reading isn&rsquo;t worked around: the way back is
        the store allowing it.
      </p>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {LEFT_OUT_STORES.map((s) => (
          <li key={s.name} className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
            <a href={s.url} rel="noopener" className="font-medium underline-offset-2 hover:underline">
              {s.name}
            </a>
            <span className="text-ink-muted">{s.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
