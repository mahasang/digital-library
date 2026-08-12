import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

interface Row {
  name: string;
  note: string;
  count: number | null;
}

describe("toCsv", () => {
  it("starts with a UTF-8 BOM so Excel opens Thai text correctly", () => {
    const csv = toCsv<Row>([], [{ key: "name", label: "ชื่อ" }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("quotes and escapes values containing commas, quotes, or newlines", () => {
    const rows: Row[] = [{ name: 'Say "hi", ok', note: "line1\nline2", count: 1 }];
    const csv = toCsv(rows, [
      { key: "name", label: "name" },
      { key: "note", label: "note" },
      { key: "count", label: "count" },
    ]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toBe('"Say ""hi"", ok","line1\nline2",1');
  });

  it("renders null/undefined as an empty field, not the string 'null'", () => {
    const rows: Row[] = [{ name: "a", note: "b", count: null }];
    const csv = toCsv(rows, [{ key: "count", label: "count" }]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toBe("");
  });

  it("leaves plain values unquoted", () => {
    const rows: Row[] = [{ name: "plain", note: "value", count: 5 }];
    const csv = toCsv(rows, [
      { key: "name", label: "name" },
      { key: "count", label: "count" },
    ]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toBe("plain,5");
  });
});
