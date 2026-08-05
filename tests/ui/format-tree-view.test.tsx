// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DocumentTreeView } from "../../src/pages/format/DocumentTreeView";
import { parseDocument } from "../../src/core/document";

afterEach(cleanup);

describe("DocumentTreeView", () => {
  it("支持折叠和重新展开嵌套对象节点", () => {
    render(<DocumentTreeView value={{ requestId: "req-001", hotel: { name: "示例酒店" } }} />);

    const rootToggle = screen.getByRole("button", { name: "折叠节点 $" });
    expect(rootToggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("requestId")).toBeTruthy();

    fireEvent.click(rootToggle);
    expect(rootToggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("requestId")).toBeNull();

    fireEvent.click(rootToggle);
    const hotelToggle = screen.getByRole("button", { name: "折叠节点 hotel" });
    expect(screen.getByText('"示例酒店"')).toBeTruthy();

    fireEvent.click(hotelToggle);
    expect(hotelToggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText('"示例酒店"')).toBeNull();
  });

  it("支持折叠 XML 解析后的节点", () => {
    const parsed = parseDocument("<root><hotel><name>示例酒店</name></hotel></root>", "xml");
    expect(parsed.valid).toBe(true);

    render(<DocumentTreeView value={parsed.data} />);
    const rootElementToggle = screen.getByRole("button", { name: "折叠节点 root" });
    expect(screen.getByText("hotel")).toBeTruthy();

    fireEvent.click(rootElementToggle);
    expect(screen.queryByText("hotel")).toBeNull();
  });
});
