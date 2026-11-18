"use client";

import { BellRing } from "lucide-react";
import Link from "next/link";
import { useActionState, useId } from "react";

import { setAlert, type FormState } from "@/app/alerts/actions";
import { cn } from "@/lib/cn";
import { formatRand } from "@/lib/format";

const INITIAL: FormState = { status: "idle" };

/** A suggested target: about 10% under the price now, rounded to a tidy figure. */
export function suggestedTarget(priceZar: number): number {
  const step = priceZar >= 2000 ? 100 : priceZar >= 200 ? 10 : 1;
  return Math.max(step, Math.floor((priceZar * 0.9) / step) * step);
}

export function AlertForm({ productId, priceZar }: { productId: string; priceZar: number }) {
  const [state, action, pending] = useActionState(setAlert, INITIAL);
  const id = useId();
  const errorId = `${id}-error`;
  const fieldError = (field: "email" | "targetZar") => state.status === "error" && state.field === field;

  if (state.status === "done") {
    return (
      <div role="status" className="rounded-md border border-canvas bg-canvas-wash p-4 text-canvas-strong">
        <p className="font-semibold">Confirm by email</p>
        <p className="mt-1">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-md border border-line bg-surface p-4" noValidate>
      <h2 className="narrow flex items-center gap-2 text-xl font-bold">
        <BellRing aria-hidden className="size-5" />
        Email me when it drops
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        One email when it&rsquo;s in stock at or under your price, then the alert closes. You confirm it first.{" "}
        <Link href="/privacy" className="underline">
          What&rsquo;s kept
        </Link>
      </p>
      <input type="hidden" name="productId" value={productId} />
      <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div>
          <label htmlFor={`${id}-target`} className="block text-sm font-medium">
            At or under (R)
          </label>
          <input
            id={`${id}-target`}
            name="targetZar"
            inputMode="decimal"
            defaultValue={suggestedTarget(priceZar)}
            aria-invalid={fieldError("targetZar") || undefined}
            aria-describedby={fieldError("targetZar") ? errorId : undefined}
            className={cn("mt-1 w-full rounded border bg-surface px-3 py-2 tabular-nums", fieldError("targetZar") ? "border-danger" : "border-line")}
          />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className="block text-sm font-medium">
            Email
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={fieldError("email") || undefined}
            aria-describedby={fieldError("email") ? errorId : undefined}
            className={cn("mt-1 w-full rounded border bg-surface px-3 py-2", fieldError("email") ? "border-danger" : "border-line")}
          />
        </div>
      </div>
      {/* Hidden from people; a bot that fills it in is ignored. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state.status === "error" && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-danger">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded bg-canvas px-4 py-2 font-semibold text-surface disabled:opacity-60"
      >
        {pending ? "Setting the alert…" : "Set alert"}
      </button>
      <p className="mt-2 text-xs text-ink-muted">It&rsquo;s {formatRand(priceZar)} now.</p>
    </form>
  );
}
