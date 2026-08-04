import { describe, expect, it } from "vitest";
import { analyzeCron, buildCronExpression, parseCronFields } from "../../src/core/cron";

describe("cron core", () => {
  it("parses and rebuilds supported dialects", () => {
    expect(buildCronExpression(parseCronFields("*/5 * * * *", "unix"), "unix")).toBe("*/5 * * * *");
    expect(parseCronFields("0 0 9 * * *", "spring").second).toBe("0");
    expect(parseCronFields("0 0 9 ? * MON-FRI 2027", "quartz").year).toBe("2027");
  });

  it("returns deterministic next runs", () => {
    const result = analyzeCron("0 9 * * *", "unix", "UTC", 3, new Date("2026-08-03T08:30:00.000Z"));
    expect(result.valid).toBe(true);
    expect(result.nextRuns.map((item) => item.toISOString())).toEqual([
      "2026-08-03T09:00:00.000Z",
      "2026-08-04T09:00:00.000Z",
      "2026-08-05T09:00:00.000Z",
    ]);
  });

  it("explains invalid field counts", () => {
    const result = analyzeCron("0 0", "unix", "UTC");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("5 个字段");
  });
});
