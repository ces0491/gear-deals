"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { alertsRuntime } from "@/lib/alerts/runtime";
import { confirmAlert, requestAlert, sendManageLink } from "@/lib/alerts/service";
import { hashAddress, manageToken, readManageToken } from "@/lib/alerts/tokens";
import { productById } from "@/lib/data/catalogue";
import { SITE_URL } from "@/lib/site";

export type FormState =
  | { status: "idle" }
  | { status: "done"; message: string }
  | { status: "error"; message: string; field?: "email" | "targetZar" };

const UNAVAILABLE: FormState = { status: "error", message: "Price alerts aren't available right now." };

const emailField = z.email({ error: "Enter an email address, like name@example.com" }).max(254);

/** The requester's network address, as the platform reports it. Only ever stored hashed. */
async function clientAddress(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

const alertSchema = z.object({
  productId: z.string().min(1).max(200),
  email: emailField,
  targetZar: z.coerce
    .number({ error: "Enter a price in rand" })
    .positive({ error: "Enter a price above R0" })
    .max(10_000_000, { error: "That price is too high" }),
  // A field people never see. Bots that fill every field reveal themselves.
  website: z.string().max(0).optional(),
});

export async function setAlert(_prev: FormState, form: FormData): Promise<FormState> {
  const rt = alertsRuntime();
  if (!rt) return UNAVAILABLE;
  const parsed = alertSchema.safeParse({
    productId: form.get("productId"),
    email: form.get("email"),
    targetZar: String(form.get("targetZar") ?? "").replace(/[R\s ,]/gi, ""),
    website: form.get("website") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue.path[0] === "website") return { status: "done", message: "Check your inbox to confirm the alert." };
    const field = issue.path[0] === "email" || issue.path[0] === "targetZar" ? issue.path[0] : undefined;
    return { status: "error", message: issue.message, field };
  }
  const product = productById(parsed.data.productId);
  if (!product) return { status: "error", message: "That product is no longer listed." };

  const outcome = await requestAlert(
    rt,
    { email: parsed.data.email, targetZar: Math.round(parsed.data.targetZar * 100) / 100, product },
    { ipHash: hashAddress(await clientAddress(), rt.secret), now: new Date(), siteUrl: SITE_URL },
  );
  return outcome.ok
    ? { status: "done", message: `Check ${parsed.data.email.trim()} for an email to confirm the alert. Nothing is sent until you do.` }
    : { status: "error", message: outcome.message, field: outcome.field };
}

export async function confirmAlertAction(_prev: FormState, form: FormData): Promise<FormState> {
  const rt = alertsRuntime();
  if (!rt) return UNAVAILABLE;
  const outcome = await confirmAlert(rt, String(form.get("token") ?? ""), new Date());
  if (outcome.ok) redirect(`/alerts/manage?token=${manageToken(outcome.alert.email, rt.secret)}&done=confirmed`);
  const messages = {
    invalid: "This confirmation link isn't valid. Copy the whole link from the email.",
    expired: "This confirmation link has expired. Set the alert again from the product page.",
    gone: "This alert has been deleted. Set it again from the product page.",
  } as const;
  return { status: "error", message: messages[outcome.reason] };
}

export async function deleteAlertAction(form: FormData): Promise<void> {
  const rt = alertsRuntime();
  const token = String(form.get("token") ?? "");
  const email = rt ? readManageToken(token, rt.secret) : null;
  if (!rt || !email) redirect("/alerts?error=link");
  await rt.store.delete(String(form.get("alertId") ?? ""), email);
  redirect(`/alerts/manage?token=${token}&done=deleted`);
}

export async function deleteEverythingAction(form: FormData): Promise<void> {
  const rt = alertsRuntime();
  const token = String(form.get("token") ?? "");
  const email = rt ? readManageToken(token, rt.secret) : null;
  if (!rt || !email) redirect("/alerts?error=link");
  await rt.store.deleteAllForEmail(email);
  redirect(`/alerts/manage?token=${token}&done=all-deleted`);
}

export async function sendManageLinkAction(_prev: FormState, form: FormData): Promise<FormState> {
  const rt = alertsRuntime();
  if (!rt) return UNAVAILABLE;
  if (String(form.get("website") ?? "") !== "") return { status: "done", message: "If that address has alerts, a link is on its way." };
  const parsed = emailField.safeParse(form.get("email"));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message, field: "email" };
  const outcome = await sendManageLink(rt, parsed.data, {
    ipHash: hashAddress(await clientAddress(), rt.secret),
    now: new Date(),
    siteUrl: SITE_URL,
    defer: (task) => after(task),
  });
  return outcome.ok
    ? { status: "done", message: "If that address has alerts, a link to them is on its way." }
    : { status: "error", message: outcome.message };
}
