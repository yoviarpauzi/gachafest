import { parse as parseCsv } from "csv-parse/sync";
import { Unzip, UnzipInflate, UnzipPassThrough } from "fflate";
import { readSheet } from "read-excel-file/node";
import { z } from "zod";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 10_000;
/** Physical lines in a CSV, empty ones included: the row limit only counts non-empty rows. */
export const MAX_LINES = 50_000;
/** 10,000 rows of name and email are 1-3 MiB of sheet XML; anything past this is not a guest list. */
const MAX_UNCOMPRESSED_BYTES = 10 * 1024 * 1024;

export type Problem = { row: number; reason: string };
export type ParsedFile = {
  rowsRead: number;
  rows: { row: number; name: string; email: string }[];
  problems: Problem[];
};

type ErrorCode = "unsupported_file" | "too_many_rows" | "missing_columns";

export class ParticipantsFileError extends Error {
  code: ErrorCode;

  constructor(code: ErrorCode) {
    super(code);
    this.name = "ParticipantsFileError";
    this.code = code;
  }
}

const fail = (code: ErrorCode): never => {
  throw new ParticipantsFileError(code);
};

const nameSchema = z.string().min(1, "Name is missing").max(200, "Name is too long");
const emailSchema = z
  .string()
  .min(1, "Email is missing")
  .max(254, "Email format is not valid")
  .pipe(z.email("Email format is not valid"));

// One reason per row, the first of these that applies.
const REASON_PRIORITY = [
  "Name is missing",
  "Email is missing",
  "Email format is not valid",
  "Name is too long",
];

function reasonFor(name: string, email: string): string | null {
  const reasons = new Set<string>();
  for (const result of [nameSchema.safeParse(name), emailSchema.safeParse(email)]) {
    if (!result.success) for (const issue of result.error.issues) reasons.add(issue.message);
  }
  return REASON_PRIORITY.find((reason) => reasons.has(reason)) ?? null;
}

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return (value instanceof Date ? value.toISOString() : String(value)).trim();
};

function readCsv(bytes: Uint8Array): unknown[][] {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail("unsupported_file");
  }
  if (text.includes("\0")) return fail("unsupported_file");

  // Blank lines are cheap to write and expensive to parse (5 MiB of them froze the server for ~45 s), and
  // the row limit does not count them, so physical lines are capped before parsing.
  if (countLines(text) > MAX_LINES) return fail("too_many_rows");

  // Excel with Indonesian regional settings writes semicolons; pick the delimiter by the header line.
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => ({ d, n: firstLine.split(d).length - 1 }));
  const best = counts.reduce((a, b) => (b.n > a.n ? b : a));

  try {
    return parseCsv(text, {
      bom: true,
      delimiter: best.n > 0 ? best.d : ",",
      skip_empty_lines: false,
      relax_column_count: true,
    }) as unknown[][];
  } catch {
    return fail("unsupported_file");
  }
}

async function readXlsx(bytes: Uint8Array): Promise<unknown[][]> {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4;
  if (!isZip) return fail("unsupported_file");

  if (!inflatesWithinBudget(bytes)) return fail("unsupported_file");
  try {
    return (await readSheet(Buffer.from(bytes))) as unknown[][];
  } catch {
    return fail("unsupported_file");
  }
}

/**
 * Inflates the archive the way read-excel-file will (entry by entry from the local headers) and gives up
 * once more than the budget has come out. The sizes the zip directory declares are only a claim and can be
 * forged, so they are not trusted; the bytes actually produced are counted instead.
 *
 * The input is pushed in small slices: one push inflates everything it is given before `ondata` can
 * stop it (a 302 KB bomb took 4 s and 300 MB), while a slice of N input bytes can produce at most about
 * 1032 * N output bytes, so the work stays near the budget.
 */
const PUSH_SLICE_BYTES = 8 * 1024;

function inflatesWithinBudget(bytes: Uint8Array): boolean {
  let total = 0;
  let ok = true;
  const unzip = new Unzip((file) => {
    file.ondata = (error, chunk) => {
      total += chunk?.length ?? 0;
      if (error || total > MAX_UNCOMPRESSED_BYTES) {
        ok = false;
        file.terminate();
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  try {
    for (let at = 0; at < bytes.length && ok; at += PUSH_SLICE_BYTES) {
      const end = Math.min(at + PUSH_SLICE_BYTES, bytes.length);
      unzip.push(bytes.subarray(at, end), end === bytes.length);
    }
  } catch {
    return false;
  }
  return ok;
}

function countLines(text: string): number {
  // Both \n and \r end a line; CRLF counts once through \n, so the larger of the two is the line count.
  const count = (char: string) => {
    let n = 0;
    for (let i = text.indexOf(char); i !== -1; i = text.indexOf(char, i + 1)) {
      if (++n > MAX_LINES) break;
    }
    return n;
  };
  return Math.max(count("\n"), count("\r")) + 1;
}

export async function parseParticipantsFile(fileName: string, bytes: Uint8Array): Promise<ParsedFile> {
  const lower = fileName.toLowerCase();
  let records: unknown[][];
  if (lower.endsWith(".csv")) records = readCsv(bytes);
  else if (lower.endsWith(".xlsx")) records = await readXlsx(bytes);
  else return fail("unsupported_file");

  const headers = (records[0] ?? []).map((cell) => asText(cell).toLowerCase());
  const nameAt = headers.indexOf("name");
  const emailAt = headers.indexOf("email");
  if (nameAt < 0 || emailAt < 0) return fail("missing_columns");

  const parsed: ParsedFile = { rowsRead: 0, rows: [], problems: [] };
  for (let i = 1; i < records.length; i++) {
    const cells = (records[i] ?? []).map(asText);
    if (cells.every((cell) => cell === "")) continue;

    parsed.rowsRead++;
    if (parsed.rowsRead > MAX_ROWS) return fail("too_many_rows");

    const row = i + 1; // the header is row 1, as in Excel
    const name = cells[nameAt] ?? "";
    const email = cells[emailAt] ?? "";
    const reason = reasonFor(name, email);
    if (reason) parsed.problems.push({ row, reason });
    else parsed.rows.push({ row, name, email });
  }
  return parsed;
}
