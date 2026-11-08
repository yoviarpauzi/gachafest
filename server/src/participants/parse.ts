import { parse as parseCsv } from "csv-parse/sync";
import { unzipSync } from "fflate";
import { readSheet } from "read-excel-file/node";
import { z } from "zod";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 10_000;
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;

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

  // The zip directory declares each entry's uncompressed size, so a zip bomb is spotted without inflating it.
  let declared = 0;
  try {
    unzipSync(bytes, {
      filter(file) {
        declared += file.originalSize;
        if (declared > MAX_UNCOMPRESSED_BYTES) throw new Error("zip too large");
        return false;
      },
    });
    return (await readSheet(Buffer.from(bytes))) as unknown[][];
  } catch {
    return fail("unsupported_file");
  }
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
