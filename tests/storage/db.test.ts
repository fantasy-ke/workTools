import { describe, expect, it } from "vitest";
import { applySettingsDefaults } from "../../src/storage/db";

describe("settings defaults", () => {
  it("enables GPU rendering hints for new and older local settings", () => {
    expect(applySettingsDefaults().gpuAcceleration).toBe(true);
    expect(applySettingsDefaults().language).toBe("zh-CN");
    expect(applySettingsDefaults({ theme: "dark" }).gpuAcceleration).toBe(true);
    expect(applySettingsDefaults({ language: "en-US" }).language).toBe("en-US");
  });

  it("preserves an explicit disabled preference", () => {
    expect(applySettingsDefaults({ gpuAcceleration: false }).gpuAcceleration).toBe(false);
  });
});
