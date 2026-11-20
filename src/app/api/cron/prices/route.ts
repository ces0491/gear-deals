import type { NextRequest } from "next/server";

import { catalogue } from "@/lib/data/catalogue";
import { todayInSouthAfrica } from "@/lib/dates";
import { dispatchPriceRun } from "@/lib/scrape/dispatch";

/** Called each morning by the schedule in vercel.json; see src/lib/scrape/dispatch.ts. */
export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const outcome = await dispatchPriceRun({
    authorization,
    cronSecret: process.env.CRON_SECRET,
    token: process.env.PRICES_DISPATCH_TOKEN,
    pricedOn: catalogue().pricedOn,
    today: todayInSouthAfrica(),
    fetch,
  });
  if (outcome.status >= 500) console.error(`[cron/prices] ${outcome.message}`);
  return new Response(outcome.message, { status: outcome.status, headers: { "Cache-Control": "no-store" } });
}
