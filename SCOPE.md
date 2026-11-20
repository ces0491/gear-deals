# SCOPE — gear-deals

## Purpose

Show South African 4x4 and camping gear that's cheaper than usual across the online
stores that publish their catalogues, so a buyer can spot a real deal without checking
each store by hand, and hear about it when something they want drops to their price.

## Done

- [ ] A daily scrape (GitHub Actions, early morning SAST) reads 7 WooCommerce stores:
      Camp and Climb, 4x4 Mega World, Tentco, Opposite Lock, Eezi-Awn, Bushtech and
      National Luna; plus Adventure Inc and Trappers on Shopify. Products with no price,
      or that the store doesn't let you buy, are left out.
- [ ] Price history is kept from the first run: a dated entry whenever a product's price
      or was-price changes.
- [ ] A product counts as a deal for one or more stated reasons, each shown with its evidence:
  - the store shows a was-price (labelled as the store's claim, with how long it's been
    shown)
  - the store lists it in a clearance section
  - its price dropped within the last 14 days, by this site's own tracking
  - another listed store sells the same manufacturer code for more
- [ ] Deals page: search, filters (category, store, brand, deal reason, minimum saving),
      sorting (% saving, rand saving, price), pagination. Turning "deals only" off
      searches the whole catalogue.
- [ ] Product page: price now, the was-price claim, price history, the same item at
      other stores, and a link to buy it at the store.
- [ ] Product pages for items from R1 000 link to Facebook Marketplace's and Gumtree's
      own search for the item, so a used one can be looked for. The site doesn't read
      or check those listings.
- [ ] Watchlist kept in the browser, no sign-in: watched products show what changed
      since they were added and since the last visit.
- [ ] Price alerts: on a product page, an email address and a target price. The alert
      goes live once the address confirms it, emails once when the product is in stock at
      or under the target, then closes. Several alerts hitting the same morning share one
      email. Every email links to a page to see and delete that address's alerts, and has
      one-click unsubscribe. Caps on alerts per address and confirmation emails per day.
- [ ] Privacy page covering what alerts store (email, product, target price), why, how
      long, and how to delete it, in line with POPIA.
- [ ] Stores page: per store, products, deals, when it was last read and whether that
      read failed; plus the stores looked at and left out, with the reason.
- [ ] How-it-works page: what counts as a deal, the matching rule, refresh time, no
      affiliate links, and how a store asks to be removed.
- [ ] A store that fails to scrape keeps its last good data for up to 7 days, with the
      failure shown. Sanity checks refuse to publish a run whose counts collapse or
      whose discounts look broken.
- [ ] Layout holds from 320 px to desktop with no sideways scroll, in light and dark
      (Playwright). Unit tests cover parsers, normalising, history, deal rules and alert
      rules using captured store responses. E2E covers search, the product page, the
      watchlist and the alert sign-up and confirm flow. Lint, typecheck, tests and audit
      pass in CI.
- [ ] Live on Vercel at a sheetsolved.com subdomain, with alert email sent through
      Resend from a verified sheetsolved.com address.

## Out of scope

- Stores whose terms ban scraping (Alpha Accessories, Camp Cover, Flex Adventures, The
  Bakkie Shop, Wild Access, All Outdoor and Home) or that block automated reads (Melvill &
  Moon, Thule Store, Ironman 4x4). Getting past any bot protection.
- Catalogue sites with no prices or checkout (Safari Centre, Snomaster, Alu-Cab,
  Campmaster)
- Stores with no public machine-readable catalogue (Outdoor Warehouse, Cape Union Mart,
  Front Runner, Dometic, Wildebees Outdoor, Sportsmans Warehouse, Due South)
- Tyres, and stores that mostly sell them (Tyres & More)
- Matching products across stores by name. Only identical manufacturer codes match.
- Copying store content beyond name, price, one photo (loaded from the store) and link
- Accounts and sign-in, digests, newsletters or any email that isn't a confirmation or
  an alert someone set
- Checkout, affiliate links, paid placement
- Delivery costs and delivered totals
- Reading second-hand listings (Gumtree, Facebook Marketplace, 4x4 Community): Meta's
  terms ban automated collection, and a used listing has no product code or price
  history to judge a deal by. Product pages only link out to their search.

## Bar

Public production site, held to the wood-wiz bar: strict TypeScript, Zod validation at
every store boundary and every form, tests on every parser and rule, a documented
methodology, visible uncertainty, and a predictable refresh. Scraping stays polite:
honest user agent, one request at a time per store, only the fields needed, no retry
storms. Alert data is the only personal data held; it stays out of the repository and
is deleted when it's no longer needed.

## Decision

Ces, once the site is live and has been used to judge a real purchase.

## Revision history

- 2026-11-18: initial scope, with alerts and the watchlist in v1
- 2026-11-18: added links from product pages to Facebook Marketplace and Gumtree search
- 2026-11-19: added ten stores left out after a wider look at South African stores, and
  put tyres out of scope
- 2026-11-20: Ironman 4x4 out of scope after it refused the daily read on 19 and 20
  November
