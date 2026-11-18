import { Suspense } from "react";

import { DealsResults } from "@/components/deals-results";
import { catalogue } from "@/lib/data/catalogue";
import { formatDisplayDate, formatTimeInSouthAfrica } from "@/lib/dates";
import { plural } from "@/lib/format";

function ResultsFallback() {
  return (
    <div aria-busy="true" className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-8">
      <div className="hidden h-96 rounded-md bg-surface lg:block" />
      <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="h-96 rounded-md border border-line bg-surface" />
        ))}
      </ul>
    </div>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  const { products, stores, generatedAt, pricedOn } = catalogue();
  const deals = products.filter((p) => p.deal && p.inStock).length;
  const storeCount = Object.keys(stores).length;
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8">
      <div className="mb-6 max-w-3xl">
        <h1 className="narrow text-4xl leading-none font-extrabold sm:text-5xl">Deals on 4x4 and camping gear</h1>
        <p className="mt-3 text-lg text-ink-muted">
          {plural(deals, "deal")} in stock across {plural(storeCount, "store")}, from prices read on {formatDisplayDate(pricedOn)}{" "}
          at {formatTimeInSouthAfrica(generatedAt)}. Each one says what its saving is measured against.
        </p>
      </div>
      <Suspense fallback={<ResultsFallback />}>
        <DealsResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
