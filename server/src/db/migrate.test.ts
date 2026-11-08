import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "./database";
import { migrate } from "./migrate";

const dirs: string[] = [];
function fixtureDir(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "gf-mig-"));
  dirs.push(dir);
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const tables = (db: ReturnType<typeof openDatabase>) =>
  (db.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
    name: string;
  }[]).map((row) => row.name);

const versions = (db: ReturnType<typeof openDatabase>) =>
  (db.query("SELECT version FROM schema_migrations ORDER BY version").all() as {
    version: string;
  }[]).map((row) => row.version);

describe("migrate", () => {
  test("applies files in name order and returns their versions", () => {
    const dir = fixtureDir({
      "0002_b.sql": "CREATE TABLE b (id INTEGER);",
      "0001_a.sql": "CREATE TABLE a (id INTEGER);",
    });
    const db = openDatabase(":memory:");
    expect(migrate(db, dir)).toEqual(["0001_a", "0002_b"]);
    expect(tables(db)).toContain("a");
    expect(tables(db)).toContain("b");
  });

  test("is idempotent", () => {
    const dir = fixtureDir({ "0001_a.sql": "CREATE TABLE a (id INTEGER);" });
    const db = openDatabase(":memory:");
    migrate(db, dir);
    expect(migrate(db, dir)).toEqual([]);
  });

  test("applies only files added since the last run", () => {
    const dir = fixtureDir({ "0001_a.sql": "CREATE TABLE a (id INTEGER);" });
    const db = openDatabase(":memory:");
    migrate(db, dir);
    writeFileSync(join(dir, "0003_c.sql"), "CREATE TABLE c (id INTEGER);");
    expect(migrate(db, dir)).toEqual(["0003_c"]);
    expect(tables(db)).toContain("c");
  });

  test("rolls back a failing file and keeps earlier ones", () => {
    const dir = fixtureDir({
      "0001_a.sql": "CREATE TABLE a (id INTEGER);",
      "0002_bad.sql": "CREATE TABLE t (id INTEGER); INSERT INTO missing_table VALUES (1);",
    });
    const db = openDatabase(":memory:");
    expect(() => migrate(db, dir)).toThrow();
    expect(tables(db)).not.toContain("t");
    expect(tables(db)).toContain("a");
    expect(versions(db)).toEqual(["0001_a"]);
  });

  test("ignores files that do not match the pattern", () => {
    const dir = fixtureDir({
      "README.md": "not sql",
      "notes.sql": "CREATE TABLE notes (id INTEGER);",
      "1_x.sql": "CREATE TABLE x (id INTEGER);",
      "0001_a.sql": "CREATE TABLE a (id INTEGER);",
    });
    const db = openDatabase(":memory:");
    expect(migrate(db, dir)).toEqual(["0001_a"]);
    expect(tables(db)).not.toContain("notes");
    expect(tables(db)).not.toContain("x");
    expect(versions(db)).toEqual(["0001_a"]);
  });

  test("throws a clear error when the directory does not exist", () => {
    const missing = join(tmpdir(), "gf-does-not-exist-" + Date.now());
    const db = openDatabase(":memory:");
    expect(() => migrate(db, missing)).toThrow(missing);
  });
});
