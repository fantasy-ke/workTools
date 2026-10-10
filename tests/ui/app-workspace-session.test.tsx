// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceRecord } from "../../src/types";

const { loadWorkspaceTabSession, saveWorkspaceTabSession, workspace } = vi.hoisted(() => ({
  loadWorkspaceTabSession: vi.fn(async (): Promise<unknown> => undefined),
  saveWorkspaceTabSession: vi.fn(async (): Promise<void> => undefined),
  workspace: {
    id: "workspace-1",
    name: "订单工作区",
    type: "format",
    createdAt: "2026-08-11T08:00:00.000Z",
    updatedAt: "2026-08-11T08:00:00.000Z",
    pinned: false,
    sensitiveMode: false,
    snapshot: { kind: "format", text: "{}", format: "json" },
  } as WorkspaceRecord,
}));

vi.mock("../../src/storage/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/storage/db")>();
  return { ...actual, loadWorkspaceTabSession, saveWorkspaceTabSession };
});
vi.mock("../../src/pages/HomePage", () => ({ HomePage: () => null }));
vi.mock("../../src/pages/FormatPage", () => ({ FormatPage: () => null }));

import App from "../../src/App";
import { useAppStore } from "../../src/store/appStore";

const originalState = useAppStore.getState();
const matchMediaMock = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

describe("saved workspace tabs", () => {
  beforeEach(() => {
    loadWorkspaceTabSession.mockReset().mockResolvedValue({
      id: "open-workspaces",
      workspaceIds: [workspace.id, "deleted-workspace"],
      activeWorkspaceId: workspace.id,
    });
    saveWorkspaceTabSession.mockReset().mockResolvedValue(undefined);
    window.matchMedia = vi.fn().mockReturnValue(matchMediaMock) as typeof window.matchMedia;
    useAppStore.setState({
      workspaces: [workspace],
      hydrated: true,
      initialize: vi.fn(async () => undefined),
      settings: { ...originalState.settings, language: "zh-CN" },
    });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState(originalState);
    vi.restoreAllMocks();
  });

  it("restores open saved workspaces after startup and drops missing workspaces", async () => {
    render(<App />);

    const savedTab = await screen.findByRole("tab", { name: "格式化 - 订单工作区" });
    expect(savedTab.getAttribute("aria-selected")).toBe("true");
    expect(loadWorkspaceTabSession).toHaveBeenCalledOnce();
    await waitFor(() => expect(saveWorkspaceTabSession).toHaveBeenCalledWith({
      workspaceIds: [workspace.id],
      activeWorkspaceId: workspace.id,
    }));
  });
});
