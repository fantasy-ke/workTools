// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import { useAppStore } from "../../src/store/appStore";

const matchMediaMock = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

function openFormatAndDiffTabs() {
  fireEvent.doubleClick(screen.getByRole("button", { name: /^格式化/ }));
  fireEvent.doubleClick(screen.getByRole("button", { name: /^对比/ }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("task tab context menu", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue(matchMediaMock) as typeof window.matchMedia;
    useAppStore.setState({
      hydrated: false,
      initialize: vi.fn(async () => undefined),
      settings: { ...useAppStore.getState().settings, language: "zh-CN" },
    });
  });

  it("closes the tab that opened the context menu", () => {
    render(<App />);
    openFormatAndDiffTabs();

    fireEvent.contextMenu(screen.getByRole("tab", { name: "格式化 - 未命名" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "关闭当前页" }));

    expect(screen.queryByRole("tab", { name: "格式化 - 未命名" })).toBeNull();
    expect(screen.getByRole("tab", { name: "对比 - 未命名" })).toBeTruthy();
  });

  it("closes other tabs and activates the tab that opened the context menu", () => {
    render(<App />);
    openFormatAndDiffTabs();

    fireEvent.contextMenu(screen.getByRole("tab", { name: "格式化 - 未命名" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "关闭其他页" }));

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "首页" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tab", { name: "格式化 - 未命名" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("tab", { name: "对比 - 未命名" })).toBeNull();
  });

  it("closes all closable tabs and returns to Home", () => {
    render(<App />);
    openFormatAndDiffTabs();

    fireEvent.contextMenu(screen.getByRole("tab", { name: "对比 - 未命名" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "关闭全部" }));

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "首页" }).getAttribute("aria-selected")).toBe("true");
  });
});
