"use client";

import { useActionState } from "react";

import { confirmAlertAction, sendManageLinkAction, type FormState } from "@/app/alerts/actions";

const INITIAL: FormState = { status: "idle" };

/**
 * A button rather than confirming on page load: mail scanners open links in emails to
 * check them, and a link that confirmed by itself would be confirmed by the scanner.
 */
export function ConfirmAlertForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmAlertAction, INITIAL);
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="token" value={token} />
      <button type="submit" disabled={pending} className="rounded bg-canvas px-5 py-2.5 font-semibold text-surface disabled:opacity-60">
        {pending ? "Confirming…" : "Confirm alert"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="mt-3 text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function ManageLinkForm() {
  const [state, action, pending] = useActionState(sendManageLinkAction, INITIAL);
  if (state.status === "done") {
    return (
      <p role="status" className="mt-4 rounded-md border border-canvas bg-canvas-wash p-4 text-canvas-strong">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="mt-4 flex max-w-lg flex-wrap items-end gap-3" noValidate>
      <div className="min-w-0 flex-[1_1_16rem]">
        <label htmlFor="manage-email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="manage-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={state.status === "error" || undefined}
          aria-describedby={state.status === "error" ? "manage-error" : undefined}
          className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
        />
      </div>
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="manage-website">Website</label>
        <input id="manage-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <button type="submit" disabled={pending} className="rounded bg-canvas px-4 py-2 font-semibold text-surface disabled:opacity-60">
        {pending ? "Sending…" : "Email me the link"}
      </button>
      {state.status === "error" && (
        <p id="manage-error" role="alert" className="w-full text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
