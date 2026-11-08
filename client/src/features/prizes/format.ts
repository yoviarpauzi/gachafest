export const MAX_PRIZE_VALUE = 1_000_000_000_000;

/** `10000000` becomes `Rp 10.000.000`: Indonesian grouping, whatever the language of the interface. */
export function formatRupiah(value: number): string {
  return `Rp ${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

export type RupiahInput = { kind: "empty" } | { kind: "ok"; value: number } | { kind: "invalid" };

/**
 * Reads what the organizer typed in the value field. An optional `Rp`, spaces anywhere, then either plain
 * digits or digits grouped by dots (`10.000.000`). A dot is only a thousands separator here, so `10.5` is
 * not half of anything: it is invalid, as are commas, exponents, letters, zero and anything over the limit.
 */
export function parseRupiah(text: string): RupiahInput {
  const stripped = text.replace(/\s+/g, "").replace(/^rp/i, "");
  if (stripped === "") return { kind: "empty" };
  if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(stripped)) return { kind: "invalid" };

  const value = Number(stripped.replaceAll(".", ""));
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PRIZE_VALUE) return { kind: "invalid" };
  return { kind: "ok", value };
}
