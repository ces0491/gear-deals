/**
 * Sends the morning's price alerts: `npm run alerts:send`. Run by the scrape workflow
 * after the new prices are committed, with ALERTS_SECRET, SUPABASE_URL,
 * SUPABASE_SECRET_KEY, RESEND_API_KEY and ALERTS_FROM set (see .env.example).
 *
 * Exits 1 when alerts aren't configured or any address couldn't be emailed, so the
 * workflow run shows it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runAlertJob } from "../src/lib/alerts/job";
import { alertsRuntime } from "../src/lib/alerts/runtime";
import { parseCatalogue, parseHistory } from "../src/lib/scrape/files";
import { SITE_URL } from "../src/lib/site";

async function main() {
  const rt = alertsRuntime();
  if (!rt) {
    console.error("Alerts aren't configured: ALERTS_SECRET, a store and a mailer are all needed.");
    process.exit(1);
  }
  const catalogue = parseCatalogue(readFileSync(join(process.cwd(), "data", "catalogue.json"), "utf8"));
  const history = parseHistory(readFileSync(join(process.cwd(), "data", "history.json"), "utf8"));
  const byId = new Map(catalogue.products.map((p) => [p.id, p]));

  const result = await runAlertJob(
    rt,
    {
      productById: (id) => byId.get(id) ?? null,
      lastSeen: (id) => history.products[id]?.lastSeen ?? null,
      today: catalogue.pricedOn,
    },
    { now: new Date(), siteUrl: SITE_URL, log: (line) => console.log(`  ${line}`) },
  );

  console.log(
    `Sent ${result.emailsSent} emails covering ${result.alertsSent} alerts; closed ${result.closed}; purged ${JSON.stringify(result.purged)}.`,
  );
  if (result.failedAddresses > 0) {
    console.error(`${result.failedAddresses} addresses couldn't be emailed; their alerts stay active for tomorrow.`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
