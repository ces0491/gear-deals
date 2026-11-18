import type { Metadata } from "next";
import Link from "next/link";

import { MIN_SKU_LENGTH, MAX_CREDIBLE_DISCOUNT } from "@/lib/catalogue/normalise";
import { historyStartedOn } from "@/lib/data/catalogue";
import { formatDisplayDate } from "@/lib/dates";
import { formatRand } from "@/lib/format";
import { SECOND_HAND_MIN_PRICE_ZAR } from "@/lib/second-hand";
import { LONG_RUNNING_WAS_DAYS } from "@/lib/deal-text";
import { MIN_SAVING_PCT, PRICE_DROP_MIN_HELD_DAYS, PRICE_DROP_WINDOW_DAYS } from "@/lib/deals/deals";
import { MAX_PRICE_RATIO } from "@/lib/deals/match";
import { MAX_CARRY_DAYS } from "@/lib/scrape/carry-forward";
import { USER_AGENT } from "@/lib/scrape/http";
import { REPO_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "How it works",
  description: "Where the prices come from, what counts as a deal, how the same item is found at different stores, and how alerts work.",
};

const pct = (f: number) => `${Math.round(f * 100)}%`;

function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="narrow mt-10 scroll-mt-6 text-3xl font-bold">
      {children}
    </h2>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
      <h1 className="narrow text-4xl font-extrabold sm:text-5xl">How it works</h1>
      <div className="mt-4 space-y-4 text-lg leading-relaxed [&_a]:text-canvas [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_p]:max-w-prose">
        <H2>Where the prices come from</H2>
        <p>
          Early every morning the site reads each listed store&rsquo;s public catalogue: the same product data the store&rsquo;s own
          pages load, from Shopify&rsquo;s product feed or WooCommerce&rsquo;s Store API. It asks each store for one page at a
          time, with a pause between pages. The <Link href="/stores">Stores</Link> page lists what&rsquo;s read and what
          isn&rsquo;t.
        </p>
        <p>
          Products the store doesn&rsquo;t sell online, or lists without a price, are left out, and so is what isn&rsquo;t 4x4 or
          camping gear: climbing hardware, clothing, footwear and books. The store&rsquo;s own page always has the final price and
          stock.
        </p>

        <H2>What counts as a deal</H2>
        <p>A product is a deal when one or more of these holds. A saving under {pct(MIN_SAVING_PCT)} doesn&rsquo;t count.</p>
        <ul className="space-y-3">
          <li>
            <strong>The store shows a was-price.</strong> That&rsquo;s the store&rsquo;s claim about what it used to sell for, and
            this site can&rsquo;t check it. Each deal says how long the was-price has been shown. One that&rsquo;s been up for{" "}
            {LONG_RUNNING_WAS_DAYS} days or more may just be the usual price, and the deal says so. A was-price implying more than{" "}
            {pct(MAX_CREDIBLE_DISCOUNT)} off is treated as a data error and ignored.
          </li>
          <li>
            <strong>The price dropped, by this site&rsquo;s own tracking.</strong> It fell within the last {PRICE_DROP_WINDOW_DAYS}{" "}
            days from a price that had held for at least {PRICE_DROP_MIN_HELD_DAYS} days, so a one-day spike coming back down
            doesn&rsquo;t count. Tracking began on {formatDisplayDate(historyStartedOn())}, so these build up over time.
          </li>
          <li>
            <strong>Another store sells the same item for more.</strong> This one is the cheapest in stock, and the next cheapest
            in stock is the comparison. See matching, below.
          </li>
          <li>
            <strong>It&rsquo;s in the store&rsquo;s clearance section.</strong> The store gives no was-price, so there&rsquo;s no
            saving figure, and these sort after the deals that have one.
          </li>
        </ul>
        <p>
          The yellow tag on a deal shows its biggest saving and what that&rsquo;s measured against. The sorting and the
          &ldquo;saving&rdquo; filter use the same figure.
        </p>

        <H2 id="matching">Finding the same item at other stores</H2>
        <p>
          Two stores&rsquo; listings count as the same item only when they carry the same product code: the maker&rsquo;s code
          that stores copy into their catalogues, such as Tentco&rsquo;s TEN061 for its three-shelf cupboard. Names differ too
          much between stores to match on. Codes are compared as letters and digits only, and a code is set aside when:
        </p>
        <ul>
          <li>it&rsquo;s shorter than {MIN_SKU_LENGTH} characters, or isn&rsquo;t a mix of letters and digits</li>
          <li>one store uses it on more than one product</li>
          <li>the listings name different brands</li>
          <li>their prices are more than {MAX_PRICE_RATIO} times apart, which usually means different pack sizes</li>
        </ul>
        <p>
          Most matches are between a maker&rsquo;s own shop and a retailer that uses the maker&rsquo;s codes, so most items have
          no match. A missing match doesn&rsquo;t mean another store is dearer.
        </p>

        <H2>Price history</H2>
        <p>
          Each morning&rsquo;s price is recorded, keeping the days it changed. When a store can&rsquo;t be read, its last good
          prices stay up for up to {MAX_CARRY_DAYS} days, the Stores page says so, and nothing is recorded for that day.
        </p>

        <H2>Watchlist and price alerts</H2>
        <p>
          The watchlist is kept in your browser and goes nowhere else. A price alert emails you once, when the product is in
          stock at or under the price you set, and then closes. It only goes live after you confirm it from the email, and
          every email has a link to see and delete your alerts. The <Link href="/privacy">privacy page</Link> says what&rsquo;s
          kept. Lost the link? <Link href="/alerts">Get it again</Link>.
        </p>

        <H2>Second-hand</H2>
        <p>
          Product pages for items from {formatRand(SECOND_HAND_MIN_PRICE_ZAR)} up link to Facebook Marketplace&rsquo;s and
          Gumtree&rsquo;s own search for the item. Those listings aren&rsquo;t read or checked here: a used item has no product
          code or price history to measure a deal against.
        </p>

        <H2>No affiliate links</H2>
        <p>
          Stores don&rsquo;t pay to be listed or placed, and links to stores are plain links: this site earns nothing when you
          buy. Ranking is by the saving figure alone.
        </p>

        <H2 id="stores">For stores</H2>
        <p>
          The site identifies itself in each request as <code className="rounded bg-surface px-1 text-base break-all">{USER_AGENT}</code>.
          To have a store left out, or to report a wrong price or category, <a href={`${REPO_URL}/issues`}>open an issue</a>.
        </p>
      </div>
    </div>
  );
}
