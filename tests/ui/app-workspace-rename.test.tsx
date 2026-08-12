// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceRecord } from "../../src/types";

const { workspace } = vi.hoisted(() => ({
  workspace: {
    id: "workspace-1",
    name: "旧名称",
    type: "format",
    createdAt: "2026-08-11T08:00:00.000Z",
    updatedAt: "2026-08-11T08:00:00.000Z",
    pinned: false,
    sensitiveMode: false,
    snapshot: { kind: "format", text: "{}", format: "json" },
  } as WorkspaceRecord,
}));

vi.mock("../../src/pages/WorkspacesPage", () => ({
  WorkspacesPage: ({
    onOpen,
    onWorkspaceRenamed,
  }: {
    onOpen: (item: WorkspaceRecord) => void;
    onWorkspaceRenamed: (item: WorkspaceRecord) => void;
  }) => (
    <>
      <button onClick={() => { onOpen(workspace); onOpen(workspace); }}>打开测试工作区</button>
      <button onClick={() => onWorkspaceRenamed({ ...workspace, name: "新名称" })}>触发工作区重命名</button>
    </>
  ),
}));

import App from "../../src/App";
import { useAppStore } from "../../src/store/appStore";

const originalState = useAppStore.getState();
const matchMediaMock = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

describe("App workspace rename", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue(matchMediaMock) as typeof window.matchMedia;
    useAppStore.setState({
      workspaces: [workspace],
      settings: { ...originalState.settings, language: "zh-CN" },
      hydrated: true,
      initialize: vi.fn(async () => undefined),
    });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState(originalState);
    vi.restoreAllMocks();
  });

  it("updates every opened tab that references the renamed workspace", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "工作区" }));
    fireEvent.click(await screen.findByRole("button", { name: "打开测试工作区" }));
    expect(screen.getAllByRole("tab", { name: "格式化 - 旧名称" })).toHaveLength(2);

    const workspacesTab = screen.getByRole("tab", { name: "工作区" });
    fireEvent.click(workspacesTab);
    await waitFor(() => expect(workspacesTab.getAttribute("aria-selected")).toBe("true"));
    fireEvent.click(screen.getByText("触发工作区重命名", { selector: "button" }));

    await waitFor(() => expect(screen.getAllByRole("tab", { name: "格式化 - 新名称" })).toHaveLength(2));
    expect(screen.queryByRole("tab", { name: "格式化 - 旧名称" })).toBeNull();
  });
});
