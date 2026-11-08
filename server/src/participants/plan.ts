import type { ParsedFile, Problem } from "./parse";

/**
 * Decides what an import would do. `existing` holds the lower-cased emails already stored. The first
 * occurrence of an email wins; later ones in the file, and any email already stored, are duplicates.
 */
export function planImport(
  parsed: ParsedFile,
  existing: Set<string>,
): { toInsert: { name: string; email: string }[]; duplicates: number; problems: Problem[] } {
  const seen = new Set(existing);
  const toInsert: { name: string; email: string }[] = [];
  let duplicates = 0;

  for (const row of parsed.rows) {
    const key = row.email.toLowerCase();
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    toInsert.push({ name: row.name, email: row.email });
  }
  return { toInsert, duplicates, problems: parsed.problems };
}
