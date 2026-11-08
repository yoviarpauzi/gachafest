import type { ExportRow } from "./repository";

const HEADER = ["Prize", "Value", "Winner", "Email", "Drawn at", "Status", "Cancelled at"];

// A spreadsheet runs a cell that starts with one of these as a formula, and names and emails come from files
// the organizer imported, so they cannot be trusted. A quote in front makes the cell plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

export const sanitizeCell = (text: string): string => (FORMULA_START.test(text) ? `'${text}` : text);

const quote = (text: string): string => `"${text.replaceAll('"', '""')}"`;

/**
 * The winners as CSV for a spreadsheet: a byte order mark (so Excel reads non-Latin names), every cell quoted,
 * CRLF line ends. `Value` is the prize's whole Rupiah or empty and, being a number, is not sanitised.
 */
export function toCsv(rows: ExportRow[]): string {
  const lines = [
    HEADER.map(quote).join(","),
    ...rows.map((row) =>
      [
        sanitizeCell(row.prizeName),
        row.prizeValue === null ? "" : String(row.prizeValue),
        sanitizeCell(row.participantName),
        sanitizeCell(row.participantEmail),
        sanitizeCell(row.drawnAt),
        row.status === "valid" ? "Valid" : "Cancelled",
        sanitizeCell(row.cancelledAt ?? ""),
      ]
        .map(quote)
        .join(","),
    ),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}
