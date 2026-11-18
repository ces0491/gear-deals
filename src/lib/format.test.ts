import { describe, expect, it } from "vitest";

import { formatPct, formatRand, plural } from "@/lib/format";

describe("formatRand", () => {
  it("groups thousands with a non-breaking space and drops zero cents", () => {
    expect(formatRand(12499)).toBe("R12 499");
    expect(formatRand(195)).toBe("R195");
  });

  it("keeps cents when there are some", () => {
    expect(formatRand(1069.99)).toBe("R1 069.99");
    expect(formatRand(2195.01)).toBe("R2 195.01");
  });
});

describe("formatPct", () => {
  it("rounds down so a saving is never overstated", () => {
    expect(formatPct(0.299)).toBe("29%");
    expect(formatPct(0.75)).toBe("75%");
  });
});

describe("plural", () => {
  it("picks the form by count", () => {
    expect(plural(1, "deal")).toBe("1 deal");
    expect(plural(2, "deal")).toBe("2 deals");
    expect(plural(3986, "product")).toBe("3 986 products");
  });
});
