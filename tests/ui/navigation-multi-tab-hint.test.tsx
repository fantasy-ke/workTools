// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import { useAppStore } from "../../src/store/appStore";

const matchMediaMock = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("side navigation multi-tab hints", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue(matchMediaMock) as typeof window.matchMedia;
    useAppStore.setState({
      hydrated: false,
      initialize: vi.fn(async () => undefined),
    });
  });

  it("shows the double-click hint only for Format and Compare", () => {
    render(<App />);

    const hint = "双击可新建多个标签";
    expect(screen.getAllByText(hint)).toHaveLength(2);
    expect(within(screen.getByRole("button", { name: /^格式化/ })).getByText(hint)).toBeTruthy();
    expect(within(screen.getByRole("button", { name: /^对比/ })).getByText(hint)).toBeTruthy();
    expect(within(screen.getByRole("button", { name: "配置处理" })).queryByText(hint)).toBeNull();
    expect(within(screen.getByRole("button", { name: "字符串长度" })).queryByText(hint)).toBeNull();
  });

  it("keeps command shortcuts tied to their original navigation positions", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /搜索工具或命令/ }));
    const palette = screen.getByRole("dialog", { name: "命令面板" });

    expect(within(within(palette).getByRole("button", { name: /打开 字符串长度/ })).getByText("Alt 6")).toBeTruthy();
    expect(within(within(palette).getByRole("button", { name: /打开 设置/ })).queryByText(/^Alt /)).toBeNull();
  });
});
