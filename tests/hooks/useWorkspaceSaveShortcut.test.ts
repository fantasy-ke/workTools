// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceSaveShortcut } from "../../src/hooks/useWorkspaceSaveShortcut";

afterEach(cleanup);

describe("useWorkspaceSaveShortcut", () => {
  it("saves and prevents the browser shortcut when the page is active", () => {
    const onSave = vi.fn();
    renderHook(() => useWorkspaceSaveShortcut(true, onSave));
    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true });

    window.dispatchEvent(event);

    expect(onSave).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not save from an inactive mounted page", () => {
    const onSave = vi.fn();
    renderHook(() => useWorkspaceSaveShortcut(false, onSave));
    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true });

    window.dispatchEvent(event);

    expect(onSave).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores repeated keydown events", () => {
    const onSave = vi.fn();
    renderHook(() => useWorkspaceSaveShortcut(true, onSave));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, repeat: true }));

    expect(onSave).not.toHaveBeenCalled();
  });
});