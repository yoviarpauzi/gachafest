import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

/**
 * A relative DATABASE_PATH is anchored to the server folder, not to wherever the process was started,
 * so the (personal-data) database file always lands in the git-ignored server/data/.
 */
export function resolveDatabasePath(path: string, baseDir: string): string {
  return path === ":memory:" || isAbsolute(path) ? path : join(baseDir, path);
}

export function openDatabase(path: string): Database {
  const inMemory = path === ":memory:";
  if (!inMemory) mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA busy_timeout = 5000");
  if (!inMemory) db.run("PRAGMA journal_mode = WAL");
  return db;
}
