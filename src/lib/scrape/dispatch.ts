/**
 * Starting the daily price run from outside GitHub. GitHub's own schedule for
 * .github/workflows/prices.yml started no run on 19 or 20 November 2026, so a Vercel
 * schedule (vercel.json) also calls /api/cron/prices each morning, which asks GitHub to
 * start the workflow. Either trigger can fire first: this skips when the deployed
 * catalogue already has today's prices, and the workflow skips itself for the same reason.
 */
import { timingSafeEqual } from "node:crypto";

import { REPO_URL } from "@/lib/site";

export const WORKFLOW_FILE = "prices.yml";

export function dispatchUrl(repoUrl: string = REPO_URL): string {
  const repo = new URL(repoUrl).pathname.replace(/^\/|\/$/g, "");
  return `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
}

export interface DispatchInput {
  /** The request's Authorization header. Vercel sends `Bearer <CRON_SECRET>`. */
  authorization: string | null;
  cronSecret: string | undefined;
  /** A GitHub token allowed to start workflows in this repository (Actions: write). */
  token: string | undefined;
  /** The day the deployed catalogue's prices were read, and today, both in South Africa. */
  pricedOn: string;
  today: string;
  fetch: typeof fetch;
}

export interface DispatchOutcome {
  status: number;
  message: string;
}

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function dispatchPriceRun(input: DispatchInput): Promise<DispatchOutcome> {
  // Checked first, so a stranger learns nothing, and can't start a run.
  if (!input.cronSecret || !sameSecret(input.authorization ?? "", `Bearer ${input.cronSecret}`)) {
    return { status: 401, message: "Unauthorized" };
  }
  if (input.pricedOn === input.today) return { status: 200, message: `Prices for ${input.today} are already in.` };
  if (!input.token) return { status: 503, message: "PRICES_DISPATCH_TOKEN isn't set, so the run can't be started." };

  const response = await input.fetch(dispatchUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "gear-deals",
    },
    body: JSON.stringify({ ref: "main" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (response.ok) return { status: 202, message: "Asked GitHub to start the daily price run." };
  const detail = await response.text().catch(() => "");
  return { status: 502, message: `GitHub answered HTTP ${response.status}: ${detail.slice(0, 200)}` };
}
