import { describe, expect, it } from "vitest";

import { dispatchPriceRun, dispatchUrl, type DispatchInput } from "@/lib/scrape/dispatch";

function setup(reply: Response = new Response(null, { status: 204 })) {
  const calls: { url: string; init: RequestInit }[] = [];
  const input: DispatchInput = {
    authorization: "Bearer s3cret",
    cronSecret: "s3cret",
    token: "github-token",
    pricedOn: "2026-11-19",
    today: "2026-11-20",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return reply;
    },
  };
  return { input, calls };
}

describe("dispatchPriceRun", () => {
  it("asks GitHub to start the workflow on main", async () => {
    const { input, calls } = setup();
    expect(await dispatchPriceRun(input)).toMatchObject({ status: 202 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.github.com/repos/ces0491/gear-deals/actions/workflows/prices.yml/dispatches");
    expect(calls[0].init.method).toBe("POST");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer github-token");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ ref: "main" });
  });

  it("refuses a caller without the secret, and does nothing when no secret is set", async () => {
    for (const change of [{ authorization: null }, { authorization: "Bearer wrong" }, { cronSecret: undefined }]) {
      const { input, calls } = setup();
      expect(await dispatchPriceRun({ ...input, ...change })).toEqual({ status: 401, message: "Unauthorized" });
      expect(calls).toHaveLength(0);
    }
  });

  it("skips when today's prices are already in", async () => {
    const { input, calls } = setup();
    expect(await dispatchPriceRun({ ...input, pricedOn: "2026-11-20" })).toMatchObject({ status: 200 });
    expect(calls).toHaveLength(0);
  });

  it("says so when the GitHub token isn't set, or GitHub refuses", async () => {
    const missing = setup();
    expect(await dispatchPriceRun({ ...missing.input, token: undefined })).toMatchObject({ status: 503 });
    expect(missing.calls).toHaveLength(0);

    const refused = setup(new Response("Bad credentials", { status: 401 }));
    expect(await dispatchPriceRun(refused.input)).toEqual({ status: 502, message: "GitHub answered HTTP 401: Bad credentials" });
  });

  it("builds the address from the repository URL", () => {
    expect(dispatchUrl("https://github.com/someone/fork/")).toBe("https://api.github.com/repos/someone/fork/actions/workflows/prices.yml/dispatches");
  });
});
