// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigPage } from "../../src/pages/ConfigPage";

vi.mock("../../src/components/CodeEditor", () => ({
  CodeEditor: ({ label, value }: { label: string; value: string }) => (
    <textarea aria-label={label} value={value} readOnly />
  ),
}));

vi.mock("../../src/hooks/useMonacoFindShortcut", () => ({
  useMonacoFindShortcut: vi.fn(),
}));

afterEach(cleanup);

describe("ConfigPage default conversion direction", () => {
  it("starts with JSON input and Apollo output", () => {
    render(<ConfigPage />);

    const direction = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    expect(direction.value).toBe("json-to-apollo");
    const textareas = screen.getAllByRole("textbox") as HTMLTextAreaElement[];
    expect(textareas[0].value).toContain('"CITHotelSell"');
    expect(textareas[1].value).toContain("CITHotelSell:PushOrderWorkStatusUrl");
  });
});
