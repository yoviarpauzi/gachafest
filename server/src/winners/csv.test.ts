import { describe, expect, test } from "bun:test";
import { sanitizeCell, toCsv } from "./csv";
import type { ExportRow } from "./repository";

const row = (extra: Partial<ExportRow> = {}): ExportRow => ({
  prizeName: "Grand Prize",
  prizeValue: 10_000_000,
  participantName: "Rina Pratama",
  participantEmail: "rina@x.example",
  drawnAt: "2026-11-08T13:00:00.000Z",
  cancelledAt: null,
  status: "valid",
  ...extra,
});

const HEADER = '"Prize","Value","Winner","Email","Drawn at","Status","Cancelled at"';
const lines = (csv: string) => csv.slice(1).split("\r\n");

describe("sanitizeCell", () => {
  test("puts a quote in front of anything a spreadsheet would run as a formula", () => {
    for (const text of ["=1+1", "+1", "-1", "@SUM(A1)", "\tcmd", "\rcmd"]) {
      expect(sanitizeCell(text)).toBe(`'${text}`);
    }
  });

  test("leaves ordinary text alone, an empty cell, and text that only has a dangerous character later", () => {
    for (const text of ["Rina", "", " =1", "a=b", "O'Neil", "1+1"]) {
      expect(sanitizeCell(text)).toBe(text);
    }
  });
});

describe("toCsv", () => {
  test("starts with the byte order mark, then the header, and every line ends with CRLF", () => {
    const csv = toCsv([row()]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines(csv)).toEqual([
      HEADER,
      '"Grand Prize","10000000","Rina Pratama","rina@x.example","2026-11-08T13:00:00.000Z","Valid",""',
      "",
    ]);
  });

  test("is only the header when there are no rows", () => {
    expect(lines(toCsv([]))).toEqual([HEADER, ""]);
  });

  test("writes Cancelled and the cancel time, and an empty cell for a prize without a value", () => {
    const csv = toCsv([row({ status: "cancelled", cancelledAt: "2026-11-08T13:05:00.000Z", prizeValue: null })]);
    expect(lines(csv)[1]).toBe(
      '"Grand Prize","","Rina Pratama","rina@x.example","2026-11-08T13:00:00.000Z","Cancelled","2026-11-08T13:05:00.000Z"',
    );
  });

  test("doubles a quote inside a name and keeps a comma or a newline inside one cell", () => {
    const csv = toCsv([
      row({ participantName: 'Rina "Ri" Pratama' }),
      row({ participantName: "Pratama, Rina" }),
      row({ participantName: "Rina\nPratama" }),
    ]);
    expect(csv).toContain('"Rina ""Ri"" Pratama"');
    expect(csv).toContain('"Pratama, Rina"');
    expect(csv).toContain('"Rina\nPratama"');
  });

  test("keeps a non-Latin name intact", () => {
    expect(toCsv([row({ participantName: "王小明 Ωmega" })])).toContain('"王小明 Ωmega"');
  });

  test("neutralises a name, an email and a prize that start like a formula", () => {
    const csv = toCsv([
      row({
        participantName: '=HYPERLINK("http://evil.example")',
        participantEmail: "+cmd@x.example",
        prizeName: "@SUM(A1)",
      }),
    ]);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"")"`);
    expect(csv).toContain(`"'+cmd@x.example"`);
    expect(csv).toContain(`"'@SUM(A1)"`);
    expect(csv).not.toContain(',"=');
    expect(csv).not.toContain(',"@');
    expect(csv).not.toContain(',"+');
  });
});
