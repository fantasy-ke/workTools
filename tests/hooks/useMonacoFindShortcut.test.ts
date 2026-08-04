// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMonacoFindShortcut, type MonacoFindTarget } from "../../src/hooks/useMonacoFindShortcut";

afterEach(cleanup);

describe("useMonacoFindShortcut", () => {
  it("opens Monaco search and prevents the browser shortcut on an active page", () => {
    const run = vi.fn();
    const getAction = vi.fn(() => ({ run }));
    const editor: MonacoFindTarget = { getAction };
    renderHook(() => useMonacoFindShortcut(true, () => editor));
    const event = new KeyboardEvent("keydown", { key: "f", ctrlKey: true, cancelable: true });

    window.dispatchEvent(event);

    expect(getAction).toHaveBeenCalledWith("actions.find");
    expect(run).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not intercept browser search for an inactive mounted page", () => {
    const getAction = vi.fn();
    renderHook(() => useMonacoFindShortcut(false, () => ({ getAction })));
    const event = new KeyboardEvent("keydown", { key: "f", ctrlKey: true, cancelable: true });

    window.dispatchEvent(event);

    expect(getAction).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("prevents repeated browser search events without reopening the find widget", () => {
    const run = vi.fn();
    const getAction = vi.fn(() => ({ run }));
    renderHook(() => useMonacoFindShortcut(true, () => ({ getAction })));
    const event = new KeyboardEvent("keydown", { key: "f", ctrlKey: true, repeat: true, cancelable: true });

    window.dispatchEvent(event);

    expect(run).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });
});
