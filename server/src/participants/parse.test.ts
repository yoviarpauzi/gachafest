import { describe, expect, test } from "bun:test";
import { zipSync } from "fflate";
import writeExcelFile from "write-excel-file/node";
import { MAX_ROWS, ParticipantsFileError, parseParticipantsFile } from "./parse";

const bytes = (text: string) => new TextEncoder().encode(text);
const csv = (text: string, fileName = "guests.csv") => parseParticipantsFile(fileName, bytes(text));

const cell = (value: string | number | boolean) => ({ value });
async function xlsx(sheets: { sheet: string; data: ReturnType<typeof cell>[][] }[]) {
  return (await (writeExcelFile(sheets as never) as { toBuffer(): Promise<Uint8Array> }).toBuffer());
}
const header = [cell("Name"), cell("Email")];

const rejects = async (promise: Promise<unknown>, code: string) => {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ParticipantsFileError);
  expect((error as ParticipantsFileError).code).toBe(code);
};

describe("CSV", () => {
  test("reads name and email and numbers rows like Excel", async () => {
    const parsed = await csv("name,email\nRina,rina@x.example\nBudi,budi@x.example\n");
    expect(parsed.rows).toEqual([
      { row: 2, name: "Rina", email: "rina@x.example" },
      { row: 3, name: "Budi", email: "budi@x.example" },
    ]);
    expect(parsed.problems).toEqual([]);
    expect(parsed.rowsRead).toBe(2);
  });

  test("ignores other columns and matches headers case-insensitively with spaces", async () => {
    const parsed = await csv("id,  NAME ,Email,Notes\n1,Rina,rina@x.example,vip\n");
    expect(parsed.rows).toEqual([{ row: 2, name: "Rina", email: "rina@x.example" }]);
  });

  test("detects semicolon and tab delimiters", async () => {
    for (const d of [";", "\t"]) {
      const parsed = await csv(`name${d}email\nRina${d}rina@x.example\n`);
      expect(parsed.rows).toEqual([{ row: 2, name: "Rina", email: "rina@x.example" }]);
    }
  });

  test("accepts a UTF-8 BOM and CRLF", async () => {
    const parsed = await csv("﻿name,email\r\nRina,rina@x.example\r\n");
    expect(parsed.rows).toEqual([{ row: 2, name: "Rina", email: "rina@x.example" }]);
  });

  test("keeps a multi-line quoted cell as one row", async () => {
    const parsed = await csv('name,email\n"Rina\nPratama",rina@x.example\nBudi,budi@x.example\n');
    expect(parsed.rows.map((r) => [r.row, r.name])).toEqual([
      [2, "Rina\nPratama"],
      [3, "Budi"],
    ]);
  });

  test("skips fully empty rows but keeps later row numbers", async () => {
    const parsed = await csv("name,email\nRina,rina@x.example\n\nBudi,budi@x.example\n");
    expect(parsed.rows.map((r) => [r.row, r.name])).toEqual([
      [2, "Rina"],
      [4, "Budi"],
    ]);
    expect(parsed.rowsRead).toBe(2);
  });

  test("trims cell values", async () => {
    const parsed = await csv("name,email\n  Rina  ,  rina@x.example  \n");
    expect(parsed.rows).toEqual([{ row: 2, name: "Rina", email: "rina@x.example" }]);
  });

  test("keeps formula-like and non-Latin cells as text", async () => {
    const parsed = await csv("name,email\n=1+1,a@x.example\n山田 太郎,b@x.example\nÑandú,c@x.example\n");
    expect(parsed.rows.map((r) => r.name)).toEqual(["=1+1", "山田 太郎", "Ñandú"]);
  });

  test("reports one reason per row in priority order", async () => {
    const long = "x".repeat(201);
    const parsed = await csv(
      [
        "id,name,email",
        "1,,", // name and email missing -> Name is missing
        "2,Rina,", // Email is missing
        "3,Budi,not-an-email", // Email format is not valid
        `4,${long},not-an-email`, // email format wins over name too long
        `5,${long},ok@x.example`, // Name is too long
        `6,Maya,${"a".repeat(245)}@x.example`, // 255 chars: Email format is not valid
        "7,Fine,fine@x.example",
      ].join("\n"),
    );
    expect(parsed.problems).toEqual([
      { row: 2, reason: "Name is missing" },
      { row: 3, reason: "Email is missing" },
      { row: 4, reason: "Email format is not valid" },
      { row: 5, reason: "Email format is not valid" },
      { row: 6, reason: "Name is too long" },
      { row: 7, reason: "Email format is not valid" },
    ]);
    expect(parsed.rows).toEqual([{ row: 8, name: "Fine", email: "fine@x.example" }]);
    expect(parsed.rowsRead).toBe(7);
  });

  test("throws missing_columns for an empty file and for a header without email", async () => {
    await rejects(csv(""), "missing_columns");
    await rejects(csv("name,mail\nRina,r@x.example\n"), "missing_columns");
  });

  test("accepts exactly 10,000 data rows and throws too_many_rows at 10,001", async () => {
    const rows = (n: number) =>
      "name,email\n" + Array.from({ length: n }, (_, i) => `G${i},g${i}@x.example`).join("\n");
    expect((await csv(rows(MAX_ROWS))).rowsRead).toBe(MAX_ROWS);
    await rejects(csv(rows(MAX_ROWS + 1)), "too_many_rows");
  });

  test("throws unsupported_file for an unknown extension, binary bytes, invalid UTF-8, and an unterminated quote", async () => {
    await rejects(csv("name,email\nRina,r@x.example\n", "notes.txt"), "unsupported_file");
    await rejects(
      parseParticipantsFile("guests.csv", new Uint8Array([0, 1, 2, 0xff, 0xfe])),
      "unsupported_file",
    );
    await rejects(
      parseParticipantsFile("guests.csv", new Uint8Array([0x6e, 0x61, 0x6d, 0x65, 0x2c, 0xff, 0x0a])),
      "unsupported_file",
    );
    await rejects(csv('name,email\n"Rina,rina@x.example\n'), "unsupported_file");
  });
});

describe("XLSX", () => {
  test("reads only the first sheet", async () => {
    const file = await xlsx([
      { sheet: "One", data: [header, [cell("First"), cell("first@x.example")]] },
      { sheet: "Two", data: [header, [cell("Second"), cell("second@x.example")]] },
    ]);
    const parsed = await parseParticipantsFile("guests.xlsx", file);
    expect(parsed.rows).toEqual([{ row: 2, name: "First", email: "first@x.example" }]);
  });

  test("converts numeric and boolean cells to text", async () => {
    const file = await xlsx([
      {
        sheet: "One",
        data: [header, [cell(12345), cell("num@x.example")], [cell("Flag"), cell(true)]],
      },
    ]);
    const parsed = await parseParticipantsFile("guests.xlsx", file);
    expect(parsed.rows).toEqual([{ row: 2, name: "12345", email: "num@x.example" }]);
    expect(parsed.problems).toEqual([{ row: 3, reason: "Email format is not valid" }]);
  });

  test("keeps an empty row in the middle and numbers later rows accordingly", async () => {
    const file = await xlsx([
      {
        sheet: "One",
        data: [
          header,
          [cell("Rina"), cell("rina@x.example")],
          [cell(""), cell("")],
          [cell("Budi"), cell("budi@x.example")],
        ],
      },
    ]);
    const parsed = await parseParticipantsFile("guests.xlsx", file);
    expect(parsed.rows.map((r) => [r.row, r.name])).toEqual([
      [2, "Rina"],
      [4, "Budi"],
    ]);
    expect(parsed.rowsRead).toBe(2);
  });

  test("throws unsupported_file for a truncated zip and for a zip declaring more than 50 MiB uncompressed", async () => {
    await rejects(
      parseParticipantsFile("guests.xlsx", new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3])),
      "unsupported_file",
    );
    const bomb = zipSync({ "xl/worksheets/sheet1.xml": [new Uint8Array(60 * 1024 * 1024), { level: 9 }] });
    await rejects(parseParticipantsFile("guests.xlsx", bomb), "unsupported_file");
    await rejects(parseParticipantsFile("guests.xlsx", bytes("not a zip at all")), "unsupported_file");
  });
});
