import { describe, expect, it } from "vitest";
import { detectFormat, escapeText, formatDocument, parseJsonDocument, parseXmlDocument, removeEscapes, unescapeText } from "../../src/core/document";

describe("document core", () => {
  it("parses JSONC and reports duplicate keys", () => {
    const parsed = parseJsonDocument('{ // comment\n "id": 1, "id": 2, }');
    expect(parsed.valid).toBe(true);
    expect(parsed.duplicatePaths).toEqual(["$.id"]);
    expect(parsed.issues[0]?.severity).toBe("warning");
  });

  it("formats detected JSON without changing values", () => {
    const source = '{"b":2,"a":[1,true]}';
    expect(detectFormat(source)).toBe("json");
    const result = formatDocument(source, "json");
    expect(result.parsed.valid).toBe(true);
    expect(JSON.parse(result.text)).toEqual({ b: 2, a: [1, true] });
    expect(result.text).toContain("\n");
  });

  it("rejects XML entity declarations and excessive nesting", () => {
    expect(parseXmlDocument('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>').valid).toBe(false);
    const deep = "<n>".repeat(257) + "x" + "</n>".repeat(257);
    expect(parseXmlDocument(deep).issues[0]?.message).toContain("256");
  });

  it("formats XML repeatedly without accumulating blank lines", () => {
    const source = "<root>\n  <a>1</a>\n\n  <b>2</b>\n</root>";
    const first = formatDocument(source, "xml");
    const second = formatDocument(first.text, "xml");

    expect(first.parsed.valid).toBe(true);
    expect(second.text).toBe(first.text);
    expect(first.text).not.toMatch(/\n\s*\n/);
  });

  it("formats multiple XML documents separated by pipes", () => {
    const source = '<?xml version="1.0"?><root><value>A|B</value></root> | <?xml version="1.0"?><root><value>C</value></root>';
    const result = formatDocument(source, "xml");

    expect(result.parsed.valid).toBe(true);
    expect(result.text).toContain("<value>A|B</value>");
    expect(result.text.split("\n|\n")).toHaveLength(2);
    expect(result.text.split("\n|\n").every((block) => parseXmlDocument(block).valid)).toBe(true);
    expect(parseXmlDocument(result.text).valid).toBe(true);
    expect(formatDocument(result.text, "xml").text).toBe(result.text);
  });

  it("adds one JSON escaping layer and can restore the original text", () => {
    const source = 'line 1\n"quoted"\\path';
    const escaped = escapeText(source);

    expect(escaped).toBe('line 1\\n\\"quoted\\"\\\\path');
    expect(unescapeText(escaped)).toBe(source);
  });

  it("unescapes JSON control and unicode sequences", () => {
    expect(unescapeText('{\\"name\\":\\"\\u4e2d\\u6587\\",\\"note\\":\\"a\\nb\\"}')).toBe(`{"name":"${"\u4e2d\u6587"}","note":"a\nb"}`);
    expect(unescapeText('"{\\"ok\\":true}"')).toBe('{"ok":true}');
  });

  it("removes one transport escaping layer without expanding control characters", () => {
    expect(removeEscapes('{\\"note\\":\\"a\\\\nb\\"}')).toBe('{"note":"a\\nb"}');
  });
});
