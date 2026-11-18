# gear-deals

Deals on 4x4 and camping gear from South African online stores. Every morning the site
reads each store's public catalogue, keeps a price history, and lists the products that
are cheaper than usual, each with what its saving is measured against. Products can be
watched in the browser, and a price alert emails once when a product reaches the price
you set.

It's a public site. `SCOPE.md` is the done-contract.

## Stores

Read on 18 November 2026:

| Store | Platform | Products | Deals in stock |
|---|---|---:|---:|
| Camp and Climb | WooCommerce | 2 123 | 36 |
| Ironman 4x4 | Shopify | 1 233 | 22 |
| 4x4 Mega World | WooCommerce | 988 | 81 |
| Trappers | Shopify | 574 | 26 |
| Adventure Inc | Shopify | 498 | 116 |
| Tentco | WooCommerce | 485 | 37 |
| Opposite Lock | WooCommerce | 275 | 74 |
| Bushtech | WooCommerce | 41 | 0 |
| Eezi-Awn | WooCommerce | 39 | 0 |
| National Luna | WooCommerce | 30 | 0 |

That's 6 286 products and 392 deals in stock. A store is listed when it publishes a
machine-readable catalogue (Shopify's `/products.json` or WooCommerce's Store API), sells
online with prices, and its terms don't ban automated reading. The registry is
`src/lib/stores/registry.ts`, which also lists the stores looked at and left out, with
the reason; the Stores page shows both. In short:

- **Terms ban scraping:** Alpha Accessories and Camp Cover use Shopify's default terms,
  which prohibit "spider, crawl, or scrape".
- **Refuse automated reading:** Melvill & Moon answers a full catalogue page with HTTP 403.
- **No prices or no checkout:** Safari Centre and Snomaster.
- **No public catalogue:** Outdoor Warehouse, Cape Union Mart, Front Runner, Sportsmans
  Warehouse and Due South.

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

`.github/workflows/prices.yml` runs at 03:00 UTC (05:00 SAST). It:

1. runs `npm run scrape`, which writes `data/catalogue.json` and `data/history.json`
2. commits them, which deploys the site
3. sends the morning's price alerts
4. fails the run if any store couldn't be read

`scripts/scrape.ts` and `src/lib/scrape/run.ts` do the work. Stores on WooCommerce are
read in parallel, one page at a time each with a 1.5-second pause. Shopify stores are read
one after another, because Shopify's edge rate-limits an address across all its stores:
during the research for this site, each Shopify store tried answered HTTP 429 for a while
after a burst of requests. A full run made 75 requests and took 101 seconds on
18 November.

- **History** (`src/lib/history/history.ts`) records a product only on days its price or
  was-price changes, and only for products actually read that day.
- **A store that fails** keeps its last good products for up to 7 days
  (`src/lib/scrape/carry-forward.ts`). The Stores page says so, and those products are
  re-placed under the current category rules.
- **Sanity checks** (`src/lib/scrape/sanity.ts`) refuse to write the files when most of a
  store's catalogue stops parsing, its product count falls by more than 40%, was-prices
  suddenly appear on most of its products, or many of its prices collapse at once. National
  Luna and Trappers have lower parsing floors, explained there.

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
the address confirms it from an email. It sends once when the product is in stock at or
under the target, then closes. Several alerts hitting on one morning share an email.
Every email links to a page listing the address's alerts with delete buttons, and alert
emails carry one-click unsubscribe headers. Limits and retention periods are in
`src/lib/alerts/config.ts`; the privacy page states them.

Alerts need four things, all optional for running the site (without them it says alerts
aren't available):

1. **A Supabase project** with `supabase/migrations/20261118120000_alerts.sql` applied.
   Both tables have row level security with no policies, so only the secret key reaches them.
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
| `npm run scrape` | Read the stores and write `data/`. `-- --only tentco,eeziawn` reads some; `-- --placements <file>` also writes where each product was placed |
| `npm run recategorise` | Re-apply the category rules to `data/catalogue.json` without reading any store |
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
320 and 412 pixels in light and dark, that the phone filter sheet opens and closes, and
that form fields use 16-pixel text.

## Deploy

| | |
|---|---|
| Live | <https://gear-deals.vercel.app>, and <https://geardeals.sheetsolved.com> once its DNS record is set (below) |
| Repository | [`ces0491/gear-deals`](https://github.com/ces0491/gear-deals), public, production branch `main` |
| Project | `gear-deals` in the `cesaires-projects` Vercel team, git-connected, Node 24 |
| Access | Production and the custom domain are public. Each deployment's own URL and preview deployments are behind Vercel Authentication (the project default, `all_except_custom_domains`). |
| Environment variables | None needed; the alert values in `.env.example` turn alerts on |

A push to `main` deploys to production, including the morning's data commit. The
repository is public, so Actions minutes cost nothing.

### Custom domain

`geardeals.sheetsolved.com` is attached to the project. The DNS half goes at GoDaddy,
under **DNS → Manage Zones → sheetsolved.com**:

| Type | Name | Value |
|---|---|---|
| `CNAME` | `geardeals` | `38d8fddbc39b8f2a.vercel-dns-016.com` |

The value is issued per domain. To read it back, or check it once the record is set:

```bash
vercel domains verify geardeals.sheetsolved.com --scope cesaires-projects
```

Until the record exists, metadata, the sitemap and alert emails already name the custom
domain (`PRODUCTION_URL` in `src/lib/site.ts`). Once it resolves, `gear-deals.vercel.app`
should redirect to it, set on that domain in the Vercel project (**Settings → Domains**),
as for camp-finder.

## Layout

```
src/app/                pages: deals (/), product, stores, how-it-works, privacy, watchlist,
                        alerts (request, confirm, manage); API routes for the watchlist and unsubscribe
src/components/         deal card and tag, filters, price chart, alert and watchlist UI
src/lib/stores/         the store registry and the WooCommerce and Shopify adapters
src/lib/catalogue/      types, normalising, categories, brands
src/lib/deals/          deal rules and cross-store matching
src/lib/history/        price history
src/lib/scrape/         the run, HTTP, carry-forward, sanity checks, data files
src/lib/data/           the server's catalogue and the deals page's query
src/lib/alerts/         alert store (Supabase and memory), tokens, emails, rules, the morning job
scripts/                scrape, alerts, recategorise, fixture builders
supabase/migrations/    the alerts tables
data/                   the committed catalogue and history
test/, e2e/             unit-test helpers and fixtures; browser tests
```
