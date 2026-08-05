// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveWorkspaceTarget, useWorkspaceSaveShortcut } from "../../src/hooks/useWorkspaceSaveShortcut";
import type { WorkspaceRecord, WorkspaceSnapshot } from "../../src/types";

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

  it("prompts only on first save and updates the same workspace afterward", async () => {
    const firstSnapshot: WorkspaceSnapshot = { kind: "format", text: "first", format: "json", sourceName: "demo.json" };
    const secondSnapshot: WorkspaceSnapshot = { kind: "format", text: "second", format: "json", sourceName: "demo.json" };
    const record: WorkspaceRecord = {
      id: "workspace-1",
      name: "renamed",
      type: "format",
      createdAt: "2026-08-04T00:00:00.000Z",
      updatedAt: "2026-08-04T00:00:00.000Z",
      pinned: false,
      sensitiveMode: false,
      snapshot: firstSnapshot,
    };
    const requestName = vi.fn(() => "renamed");
    const createWorkspace = vi.fn(async () => record);
    const updateWorkspace = vi.fn(async (_id: string, snapshot: WorkspaceSnapshot) => ({ ...record, snapshot, updatedAt: "2026-08-04T00:01:00.000Z" }));

    let workspaceId: string | undefined;
    let snapshot = firstSnapshot;
    const saveCurrent = vi.fn(async () => {
      const saved = await saveWorkspaceTarget({ workspaceId, requestName, snapshot, createWorkspace, updateWorkspace });
      workspaceId = saved?.workspace.id;
    });
    renderHook(() => useWorkspaceSaveShortcut(true, saveCurrent));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true }));
    await waitFor(() => expect(createWorkspace).toHaveBeenCalledOnce());
    snapshot = secondSnapshot;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true }));
    await waitFor(() => expect(updateWorkspace).toHaveBeenCalledOnce());

    expect(saveCurrent).toHaveBeenCalledTimes(2);
    expect(workspaceId).toBe("workspace-1");
    expect(requestName).toHaveBeenCalledOnce();
    expect(updateWorkspace).toHaveBeenCalledWith("workspace-1", secondSnapshot, false);
  });
});
