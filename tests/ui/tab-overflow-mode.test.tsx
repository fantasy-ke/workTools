// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import { SettingsPage } from "../../src/pages/SettingsPage";
import { useAppStore } from "../../src/store/appStore";
import type { WorktoolsSettings } from "../../src/types";

const originalInitialize = useAppStore.getState().initialize;
const originalUpdateSettings = useAppStore.getState().updateSettings;
const originalSettings = useAppStore.getState().settings;

const matchMediaMock = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue(matchMediaMock) as typeof window.matchMedia;
  useAppStore.setState({
    hydrated: false,
    initialize: vi.fn(async () => undefined),
    settings: { ...originalSettings, language: "zh-CN", tabOverflowMode: "scroll" },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useAppStore.setState({
    initialize: originalInitialize,
    updateSettings: originalUpdateSettings,
    settings: originalSettings,
  });
});

describe("task tab overflow setting", () => {
  it("shows both overflow modes and saves the selected mode", () => {
    const updateSettings = vi.fn(async (patch: Partial<WorktoolsSettings>) => {
      useAppStore.setState((state) => ({ settings: { ...state.settings, ...patch } }));
    });
    useAppStore.setState({ updateSettings });

    render(<SettingsPage />);

    expect(screen.getByText("单行滚动：标签页超出一行时水平滚动显示。")).toBeTruthy();
    expect(screen.getByText("多行平铺：标签页超出一行时自动换行，平铺显示所有标签。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "多行平铺" }));

    expect(updateSettings).toHaveBeenCalledWith({ tabOverflowMode: "wrap" });
  });

  it("applies the saved mode to the application shell and tab list", async () => {
    const { container } = render(<App />);
    const shell = container.querySelector(".app-shell");
    const tabList = screen.getByRole("tablist", { name: "已打开任务" });

    expect(shell?.getAttribute("data-tab-overflow")).toBe("scroll");
    expect(tabList.getAttribute("data-overflow-mode")).toBe("scroll");

    useAppStore.setState((state) => ({
      settings: { ...state.settings, tabOverflowMode: "wrap" },
    }));

    await waitFor(() => {
      expect(shell?.getAttribute("data-tab-overflow")).toBe("wrap");
      expect(tabList.getAttribute("data-overflow-mode")).toBe("wrap");
    });
  });
});
