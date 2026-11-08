import type { Database } from "bun:sqlite";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;

/** Applies the pending `NNNN_name.sql` files in order, one transaction each. Returns the versions applied. */
export function migrate(db: Database, dir: string): string[] {
  if (!existsSync(dir)) throw new Error(`Migrations directory not found: ${dir}`);

  db.run(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    (db.query("SELECT version FROM schema_migrations").all() as { version: string }[]).map(
      (row) => row.version,
    ),
  );

  const files = readdirSync(dir)
    .filter((name) => MIGRATION_FILE.test(name))
    .sort();

  const done: string[] = [];
  for (const file of files) {
    const version = file.slice(0, -".sql".length);
    if (applied.has(version)) continue;

    const sql = readFileSync(join(dir, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.query("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
        version,
        new Date().toISOString(),
      );
    })();
    done.push(version);
  }
  return done;
}
