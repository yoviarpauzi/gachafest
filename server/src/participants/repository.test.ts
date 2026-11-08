import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { openDatabase } from "../db/database";
import { migrate } from "../db/migrate";
import { createParticipantsRepository } from "./repository";

function setup() {
  const db = openDatabase(":memory:");
  migrate(db, join(import.meta.dir, "../../migrations"));
  return { db, repo: createParticipantsRepository(db) };
}

const guest = (name: string, email = `${name.toLowerCase().replace(/\W+/g, ".")}@x.example`) => ({
  name,
  email,
});

const all = { q: "", page: 1, pageSize: 100 };

describe("participants table", () => {
  test("migration creates a case-insensitive unique email", () => {
    const { db } = setup();
    const insert = (email: string) =>
      db.run("INSERT INTO participants (name, email, created_at) VALUES ('A', ?, 't')", [email]);
    insert("A@x.example");
    expect(() => insert("a@x.example")).toThrow(/UNIQUE/);
  });
});

describe("list", () => {
  test("returns items in id order with total and disabled counts", () => {
    const { repo } = setup();
    repo.insertMany([guest("Rina"), guest("Budi"), guest("Maya")]);
    repo.setDisabled(2, true);
    const page = repo.list(all);
    expect(page.items.map((p) => p.name)).toEqual(["Rina", "Budi", "Maya"]);
    expect(page.items[1]).toEqual({ id: 2, name: "Budi", email: "budi@x.example", disabled: true });
    expect(page.items[0]!.disabled).toBe(false);
    expect(page.total).toBe(3);
    expect(page.disabled).toBe(1);
    expect(page.matching).toBe(3);
  });

  test("paginates and reports matching", () => {
    const { repo } = setup();
    repo.insertMany(["A", "B", "C", "D", "E"].map((n) => guest(n)));
    const page = repo.list({ q: "", page: 2, pageSize: 2 });
    expect(page.items.map((p) => p.name)).toEqual(["C", "D"]);
    expect(page.matching).toBe(5);
    expect(repo.list({ q: "", page: 3, pageSize: 2 }).items.map((p) => p.name)).toEqual(["E"]);
    expect(repo.list({ q: "", page: 99, pageSize: 2 }).items).toEqual([]);
  });

  test("searches name or email case-insensitively", () => {
    const { repo } = setup();
    repo.insertMany([
      { name: "Rina Pratama", email: "rina@vendor-a.example" },
      { name: "Budi Santoso", email: "budi@vendor-b.example" },
    ]);
    expect(repo.list({ ...all, q: "PRATAMA" }).items.map((p) => p.name)).toEqual(["Rina Pratama"]);
    expect(repo.list({ ...all, q: "VENDOR-B" }).items.map((p) => p.name)).toEqual(["Budi Santoso"]);
    const filtered = repo.list({ ...all, q: "rina" });
    expect(filtered.matching).toBe(1);
    expect(filtered.total).toBe(2);
  });

  test("treats % and _ in q as plain text", () => {
    const { repo } = setup();
    repo.insertMany([guest("100% Vendor"), guest("Vendor_A"), guest("Vendor B")]);
    expect(repo.list({ ...all, q: "%" }).items.map((p) => p.name)).toEqual(["100% Vendor"]);
    expect(repo.list({ ...all, q: "_" }).items.map((p) => p.name)).toEqual(["Vendor_A"]);
    expect(repo.list({ ...all, q: "\\" }).items).toEqual([]);
  });
});

describe("setDisabled", () => {
  test("toggles and returns the participant, null for an unknown id", () => {
    const { repo } = setup();
    repo.insertMany([guest("Rina")]);
    expect(repo.setDisabled(1, true)).toEqual({
      id: 1,
      name: "Rina",
      email: "rina@x.example",
      disabled: true,
    });
    expect(repo.setDisabled(1, false)?.disabled).toBe(false);
    expect(repo.setDisabled(999, true)).toBeNull();
  });
});

describe("insert", () => {
  test("returns the new participant, active", () => {
    const { repo } = setup();
    expect(repo.insert({ name: "Rina", email: "Rina@X.example" })).toEqual({
      id: 1,
      name: "Rina",
      email: "Rina@X.example",
      disabled: false,
    });
    expect(repo.list(all).total).toBe(1);
  });

  test("returns null and changes nothing when the email exists in any case", () => {
    const { repo } = setup();
    repo.insertMany([{ name: "Rina Old", email: "rina@x.example" }]);
    repo.setDisabled(1, true);
    expect(repo.insert({ name: "Rina New", email: "RINA@X.example" })).toBeNull();
    expect(repo.list(all).items).toEqual([
      { id: 1, name: "Rina Old", email: "rina@x.example", disabled: true },
    ]);
  });
});

describe("insertMany", () => {
  test("returns the inserted count and skips existing emails case-insensitively", () => {
    const { repo } = setup();
    expect(repo.insertMany([guest("Rina", "Rina@X.example"), guest("Budi")])).toBe(2);
    expect(repo.insertMany([guest("Rina Again", "rina@x.example"), guest("Maya")])).toBe(1);
    expect(repo.list(all).total).toBe(3);
    expect(repo.list(all).items[0]!.name).toBe("Rina");
  });

  test("is atomic", () => {
    const { repo } = setup();
    expect(() =>
      repo.insertMany([guest("Rina"), { name: null as never, email: "bad@x.example" }]),
    ).toThrow();
    expect(repo.list(all).total).toBe(0);
  });
});

describe("emailKeys", () => {
  test("returns every email lower-cased", () => {
    const { repo } = setup();
    repo.insertMany([guest("Rina", "Rina@X.example"), guest("Budi", "BUDI@x.example")]);
    expect(repo.emailKeys()).toEqual(new Set(["rina@x.example", "budi@x.example"]));
  });
});
