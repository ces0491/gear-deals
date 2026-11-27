# gear-deals

Deals on 4x4 and camping gear from South African online stores. Every morning the site
reads each store's public catalogue, keeps a price history, and lists the products that
are cheaper than usual, each with what its saving is measured against. Products can be
watched in the browser, and a price alert emails once when a product reaches the price
you set.

It's a public site. `SCOPE.md` is the done-contract.

## Stores

Read on 20 November 2026:

| Store | Platform | Products | Deals in stock |
|---|---|---:|---:|
| Camp and Climb | WooCommerce | 2 155 | 54 |
| 4x4 Mega World | WooCommerce | 987 | 81 |
| Trappers | Shopify | 579 | 27 |
| Adventure Inc | Shopify | 486 | 115 |
| Tentco | WooCommerce | 485 | 39 |
| Opposite Lock | WooCommerce | 301 | 75 |
| Bushtech | WooCommerce | 41 | 0 |
| Eezi-Awn | WooCommerce | 39 | 0 |
| National Luna | WooCommerce | 30 | 0 |

That's 5 103 products and 391 deals in stock. A store is listed when it publishes a
machine-readable catalogue (Shopify's `/products.json` or WooCommerce's Store API), sells
online with prices, and its terms don't ban automated reading. The registry is
`src/lib/stores/registry.ts`, which also lists the stores looked at and left out, with
the reason; the Stores page shows both. In short:

- **Terms ban scraping:** Alpha Accessories, Camp Cover, Flex Adventures, The Bakkie Shop
  and Wild Access use Shopify's default terms, which prohibit "spider, crawl, or scrape".
  All Outdoor and Home's own terms ban robots and spiders.
- **Refuse automated reading:** Melvill & Moon answers a full catalogue page with HTTP 403;
  Thule Store answers with a Cloudflare challenge. Ironman 4x4 answered the daily read with
  HTTP 403 on 19 and 20 November 2026, though it had answered a read from elsewhere on 18
  November, so it was turned off.
- **No prices or no checkout:** Safari Centre, Snomaster, Alu-Cab and Campmaster.
- **No public catalogue:** Outdoor Warehouse, Cape Union Mart, Front Runner, Dometic,
  Wildebees Outdoor, Sportsmans Warehouse and Due South.
- **Not this site's range:** Tyres & More, which is mostly tyres.

Stores were looked at on 18 November 2026, and again more widely on 19 November.
Turning a store off takes `enabled: false` in the registry, an entry in `LEFT_OUT_STORES`,
and `npm run recategorise` to drop its products from the committed catalogue.

A store whose site refuses the scraper isn't worked around. The way back is the store
allowing it.

## What's read, and what's left out

Each store's adapter (`src/lib/stores/woocommerce.ts`, `src/lib/stores/shopify.ts`) has
a header describing the endpoint behaviour it depends on, as observed on 18 November 2026.
Products the store doesn't sell online or lists without a price are left out.

Then `src/lib/catalogue/categories.ts` places each product in one of 21 categories, or
leaves it out when it isn't 4x4 or camping gear. That covers climbing and rope-access
hardware, clothing and footwear, books, food and drink, and travel goods such as luggage
and wallets. Trappers and Adventure Inc are mostly clothing and travel, which is why
under half their catalogues are kept. The order the rules run in, and why, is in the
file's header comment. Store categories that mean something particular at one store
(Opposite Lock's "Lighting" is vehicle lighting) are set as `categoryHints` in the
registry.

Each product's store category names are kept in the catalogue, so a rules change is
applied with `npm run recategorise`, which reads no store.

## What counts as a deal

`src/lib/deals/deals.ts` decides. A product is a deal for one or more of these reasons,
and a saving under 5% doesn't count:

- **The store's was-price.** The store's own claim, shown as such. Was-prices implying
  more than 90% off are dropped as data errors (`src/lib/catalogue/normalise.ts`). A
  was-price shown for 60 days or more is flagged as possibly the usual price.
- **A price drop this site tracked.** The price fell within the last 14 days from a
  price that had held for at least 3 days.
- **Cheaper than another store.** The cheapest in-stock listing of an item another store
  also sells, measured against the next cheapest in stock.
- **In a clearance section.** No saving figure (4x4 Mega World's "Clearance - Spring Sale").

The default sort is by rand saved. By percentage, the top deals on 18 November were all
R100 to R200 light filters at about 70% off; by rand they were bull bars and side steps.

### The same item at different stores

Only identical product codes match (`src/lib/deals/match.ts`): names differ too much
between stores. A code is set aside when it's under 5 characters or not a mix of letters
and digits, when one store uses it on several products, when the listings name different
brands (ignoring 4x4 Mega World's house default, Desert Products), or when prices are
more than 2.5 times apart. On 18 November that found 28 cheaper-elsewhere deals, nearly
all Tentco items that Camp and Climb lists under Tentco's own codes, plus an Opposite
Lock roof console R2 489 cheaper than at 4x4 Mega World.

## Data and the daily run

`.github/workflows/prices.yml` has two triggers, because GitHub's own schedule started no
run on 19 or 20 November 2026:

- **GitHub's schedule**, at 03:17 UTC (05:17 SAST). It's off the hour because GitHub
  delays scheduled runs under load and drops some when it's busy enough, and the start of
  the hour is the busiest time.
- **A Vercel schedule** (`vercel.json`) at 03:30 UTC. It calls `/api/cron/prices`, which
  asks GitHub's API to start the workflow (`src/lib/scrape/dispatch.ts`). It needs
  `CRON_SECRET` and `PRICES_DISPATCH_TOKEN` set in the Vercel project (see Deploy, below).

Whichever starts second finds today's prices already in and stops, so the stores are read
once a day. `gh workflow run prices.yml -f force=true` reads them again anyway. A run:

1. stops if today's prices are already in
2. runs `npm run scrape`, which writes `data/catalogue.json` and `data/history.json`
3. commits them, which deploys the site
4. sends the morning's price alerts
5. fails the run if any store couldn't be read or was held back by a sanity check

`scripts/scrape.ts` and `src/lib/scrape/run.ts` do the work. Stores on WooCommerce are
read in parallel, one page at a time each with a 1.5-second pause. Shopify stores are read
one after another, because Shopify's edge rate-limits an address across all its stores:
during the research for this site, each Shopify store tried answered HTTP 429 for a while
after a burst of requests. A full run made 75 requests and took 101 seconds on
18 November.

- **History** (`src/lib/history/history.ts`) records a product only on days its price or
  was-price changes, and only for products actually read that day.
- **A product the adapter can't read** is left out and counted in the run log. When more
  than 5% of a store's catalogue can't be read (`src/lib/stores/parse.ts`), the store
  fails for the day instead.
- **A store that fails** keeps its last good products for up to 7 days
  (`src/lib/scrape/carry-forward.ts`). The Stores page says so, and those products are
  re-placed under the current category rules.
- **Sanity checks** (`src/lib/scrape/sanity.ts`) hold back a store's read when most of its
  catalogue stops parsing, its product count falls by more than 40%, most of its products
  gain a was-price the last run doesn't back, or many of its prices collapse at once. A
  was-price is backed when it's the price or the was-price recorded on the last run, so a
  store-wide sale passes (Camp and Climb took 5% off most of its catalogue on
  27 November 2026) and a misread field or an inflated regular price doesn't. National Luna
  and Trappers have lower parsing floors, explained there.
- **A store that's held back** is treated as one that failed: it keeps its last good
  products, the other stores publish, and the run ends red with what the check found in
  the "Read the stores" log. Each morning's read is checked against those last good
  products, and the hold ends when one passes. After 7 days the carried products lapse
  and the store's products come off the site, but the hold stays: with nothing left to
  compare a read against, it isn't published until someone accepts it.
- **Accepting a held store** publishes its prices as they are. Look at what the check
  found first, then run `gh workflow run prices.yml -f accept=campandclimb` (several
  stores, comma-separated). That run reads only the stores named, skips the sanity checks
  for them, and logs what the checks found. If the check itself is wrong, change it
  instead.
- **A store that isn't read** (a run with `--only`, or `npm run recategorise`) has no
  earlier read to fall back on, so a check failing there stops the files being written.

The files keep one product per line, so a day's commit shows which products changed.

## Second-hand

Product pages for items from R1 000 link to Facebook Marketplace's and Gumtree's own
search for the item (`src/lib/second-hand.ts`). The query is the brand and the product's
name, without variant details such as a vehicle fitment, capped at six words. Neither
site's listings are read: Meta's terms ban automated collection from Facebook, and a used
listing has no product code or price history to judge a deal by. Both search URLs were
checked on 18 November 2026; Facebook's shows a login prompt to a visitor who isn't
signed in.

## Price alerts

An alert is an email address and a target price on one product. It goes live only once
the address confirms it from an email. A new alert on a product the address already has
one on replaces the old one when it's confirmed, not before. An alert sends once when the
product is in stock at or under the target, then closes. Several alerts hitting on one
morning share an email. Every email links to a page listing the address's alerts with
delete buttons, and alert emails carry one-click unsubscribe headers.

Limits and retention periods are in `src/lib/alerts/config.ts`; the privacy page states
them. Each request that can send an email is logged with hashes of the email and network
addresses, and the limits are checked and logged in one database call
(`claim_alert_request`), so requests sent in parallel can't slip past them. Deleting an
address's alerts leaves the log, which expires after two days, so it doesn't reset the
limits.

Alerts need four things, all optional for running the site (without them it says alerts
aren't available):

1. **A Supabase project** with the migrations in `supabase/migrations/` applied, in order.
   Both tables have row level security with no policies, and only the secret key can call
   `claim_alert_request`, so nothing reaches them without it.
2. **A Resend account** with a verified sending domain. The DNS records go on
   sheetsolved.com at GoDaddy, as for the other sheetsolved.com subdomains.
3. **A signing secret**, `ALERTS_SECRET`; `.env.example` shows how to make one.
4. **The same five values** (`ALERTS_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
   `RESEND_API_KEY`, `ALERTS_FROM`) in the Vercel project, for the sign-up form, and as
   GitHub repository secrets, for the morning send.

For local work, `ALERTS_STORE=memory` and `ALERTS_OUTBOX=<file>` stand in for Supabase
and Resend.

## Running it

Needs Node 24 (`.nvmrc`).

```bash
npm install
npm run dev
```

Then open http://localhost:3000. The site reads the committed data files; `npm run scrape`
refreshes them from the stores. No environment variables are needed; `.env.example`
lists the optional ones.

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Next's route types (`next typegen`), then TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright) |
| `npm run scrape` | Read the stores and write `data/`. `-- --only tentco,eeziawn` reads some and keeps the others' last products, with deals matched across all of them; `-- --accept tentco` publishes that store's read whatever the sanity checks find; `-- --placements <file>` also writes where each product was placed |
| `npm run recategorise` | Rebuild `data/catalogue.json` under the current category rules and registry, without reading any store: drops what the rules leave out and the products of stores turned off, and works deals out again |
| `npm run alerts:send` | Send the morning's alerts (needs the alert settings) |
| `npm run fixtures:capture` | Re-capture the store responses the unit tests use; `-- --shopify` for the Shopify stores |
| `npm run fixtures:catalogue` | Rebuild the browser tests' catalogue from `data/` |

The first browser test run needs `npx playwright install chromium`.

## Tests

Unit tests run the store adapters against real responses in `test/fixtures/stores/`,
captured by `npm run fixtures:capture`. They also cover the category and brand rules,
history, deal and match rules, sanity checks, the deals page's filtering, and the alert
rules, tokens and emails.

The browser tests build the site against `test/fixtures/site/`, a fixed set of 33 real
products with made-up history for the tracked-drop and long-running cases, so they don't
change with the morning's prices. Alerts run on the memory store, and the tests read
confirmation links from the outbox file. Every request that isn't to the site is blocked,
so no store sees test traffic. The layout tests check that no page scrolls sideways at
320 and 412 pixels in light and dark, that the phone filter sheet opens and closes, that
form fields use 16-pixel text, and that pages send the security headers without the
content security policy blocking anything they load.

## Deploy

| | |
|---|---|
| Live | <https://geardeals.sheetsolved.com>; <https://gear-deals.vercel.app> redirects (308) to it |
| Repository | [`ces0491/gear-deals`](https://github.com/ces0491/gear-deals), public, production branch `main` |
| Project | `gear-deals` in the `cesaires-projects` Vercel team, git-connected, Node 24 |
| Access | Production and the custom domain are public. Each deployment's own URL and preview deployments are behind Vercel Authentication (the project default, `all_except_custom_domains`). |
| Environment variables | None needed to serve the site. `CRON_SECRET` and `PRICES_DISPATCH_TOKEN` (production) let the Vercel schedule start the daily run; the alert values in `.env.example` turn alerts on |

A push to `main` deploys to production, including the morning's data commit. The
repository is public, so Actions minutes cost nothing.

### Morning trigger

The Vercel schedule in `vercel.json` does nothing until two values are set in the
project's production environment:

1. `CRON_SECRET`: any long random string. Vercel sends it with each scheduled request, and
   `/api/cron/prices` refuses requests without it.
2. `PRICES_DISPATCH_TOKEN`: a fine-grained GitHub token with access to this repository
   only and the **Actions: read and write** permission, which is what starting a workflow
   needs. Fine-grained tokens expire; note the date and replace it before then.

They take effect on the next deployment. Without them the route answers 503 (no token)
or 401 (no secret) and GitHub's own schedule is the only trigger.

### Custom domain

`geardeals.sheetsolved.com` is attached to the project. The DNS half lives at GoDaddy,
under **DNS → Manage Zones → sheetsolved.com**:

| Type | Name | Value |
|---|---|---|
| `CNAME` | `geardeals` | `38d8fddbc39b8f2a.vercel-dns-016.com` |

The value is issued per domain. To read it back or check it:

```bash
vercel domains verify geardeals.sheetsolved.com --scope cesaires-projects
```

Metadata, the sitemap and alert emails name this domain (`PRODUCTION_URL` in
`src/lib/site.ts`). `gear-deals.vercel.app` redirects (308) to it, keeping the path and
query. The redirect is a setting on that domain in the Vercel project (**Settings →
Domains**), not code, so preview deployments keep serving themselves.

## Layout

```
src/app/                pages: deals (/), product, stores, how-it-works, privacy, watchlist,
                        alerts (request, confirm, manage); API routes for the watchlist, unsubscribe
                        and the morning trigger (api/cron/prices)
src/components/         deal card and tag, filters, price chart, alert and watchlist UI
src/lib/stores/         the store registry and the WooCommerce and Shopify adapters
src/lib/catalogue/      types, normalising, categories, brands
src/lib/deals/          deal rules and cross-store matching
src/lib/history/        price history
src/lib/scrape/         the run, HTTP, carry-forward, sanity checks, data files, starting the run
src/lib/data/           the server's catalogue and the deals page's query
src/lib/alerts/         alert store (Supabase and memory), tokens, emails, rules, the morning job
scripts/                scrape, alerts, recategorise, fixture builders
supabase/migrations/    the alerts tables
data/                   the committed catalogue and history
test/, e2e/             unit-test helpers and fixtures; browser tests
```
