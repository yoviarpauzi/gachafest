import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "./database";

const dirs: string[] = [];
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "gf-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("openDatabase", () => {
  test("enables foreign_keys", () => {
    const db = openDatabase(":memory:");
    const row = db.query("PRAGMA foreign_keys").get() as { foreign_keys: number };
    expect(row.foreign_keys).toBe(1);
    db.close();
  });

  test("creates missing parent folders and uses WAL for a file path", () => {
    const path = join(tempDir(), "nested", "deeper", "app.db");
    const db = openDatabase(path);
    const row = db.query("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(row.journal_mode).toBe("wal");
    expect(existsSync(path)).toBe(true);
    db.close();
  });

  test("throws when the parent path is a file", () => {
    const file = join(tempDir(), "not-a-folder");
    writeFileSync(file, "x");
    expect(() => openDatabase(join(file, "db.sqlite"))).toThrow();
  });
});
