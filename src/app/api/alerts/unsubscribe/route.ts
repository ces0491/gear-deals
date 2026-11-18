import type { NextRequest } from "next/server";

import { alertsRuntime } from "@/lib/alerts/runtime";
import { readManageToken } from "@/lib/alerts/tokens";

/**
 * One-click unsubscribe (RFC 8058). Mail apps POST here from the List-Unsubscribe header;
 * it deletes every alert for the address in the token.
 */
export async function POST(request: NextRequest) {
  const rt = alertsRuntime();
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const email = rt ? readManageToken(token, rt.secret) : null;
  if (!rt || !email) return new Response("This unsubscribe link isn't valid.", { status: 400 });
  await rt.store.deleteAllForEmail(email);
  return new Response("Unsubscribed. No more alerts will be sent to this address.", { status: 200 });
}

/** A person following the link lands on the manage page, which has the delete buttons. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  return Response.redirect(new URL(`/alerts/manage?token=${encodeURIComponent(token)}`, request.nextUrl), 303);
}
