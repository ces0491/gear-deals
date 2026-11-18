import { describe, expect, it } from "vitest";

import { addDays, daysBetween, formatDisplayDate, isIsoDate, todayInSouthAfrica } from "@/lib/dates";

describe("todayInSouthAfrica", () => {
  it("rolls over at midnight South African time, two hours before UTC", () => {
    expect(todayInSouthAfrica(new Date("2026-11-18T21:59:00Z"))).toBe("2026-11-18");
    expect(todayInSouthAfrica(new Date("2026-11-18T22:01:00Z"))).toBe("2026-11-19");
  });
});

describe("date arithmetic", () => {
  it("counts and adds whole days", () => {
    expect(daysBetween("2026-11-01", "2026-11-18")).toBe(17);
    expect(daysBetween("2026-11-18", "2026-11-01")).toBe(-17);
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("validates ISO dates", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("18/11/2026")).toBe(false);
  });

  it("formats for display", () => {
    expect(formatDisplayDate("2026-11-18")).toBe("18 Nov 2026");
  });
});
