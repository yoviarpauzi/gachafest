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
    repo.update(2, { disabled: true });
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

describe("update", () => {
  const seeded = () => {
    const ctx = setup();
    ctx.repo.insertMany([guest("Rina"), guest("Budi")]);
    return ctx;
  };
  const rina = { id: 1, name: "Rina", email: "rina@x.example", disabled: false };

  test("toggles disabled and returns the participant", () => {
    const { repo } = seeded();
    expect(repo.update(1, { disabled: true })).toEqual({
      kind: "ok",
      participant: { ...rina, disabled: true },
    });
    expect(repo.update(1, { disabled: false })).toEqual({ kind: "ok", participant: rina });
  });

  test("changes the name, the email, or both, and leaves the rest alone", () => {
    const { repo } = seeded();
    repo.update(1, { disabled: true });
    expect(repo.update(1, { name: "Rina P." })).toEqual({
      kind: "ok",
      participant: { ...rina, name: "Rina P.", disabled: true },
    });
    expect(repo.update(1, { email: "rina.p@x.example" })).toEqual({
      kind: "ok",
      participant: { ...rina, name: "Rina P.", email: "rina.p@x.example", disabled: true },
    });
    expect(repo.update(1, { name: "Rina Pratama", email: "rina@x.example" })).toEqual({
      kind: "ok",
      participant: { ...rina, name: "Rina Pratama", disabled: true },
    });
    expect(repo.list(all).items.map((p) => p.name)).toEqual(["Rina Pratama", "Budi"]);
  });

  test("an empty patch returns the participant unchanged", () => {
    const { repo } = seeded();
    expect(repo.update(1, {})).toEqual({ kind: "ok", participant: rina });
  });

  test("an email that belongs to someone else, in any letter case, is email_taken and nothing changes", () => {
    const { repo } = seeded();
    expect(repo.update(1, { name: "Changed", email: "BUDI@x.example" })).toEqual({ kind: "email_taken" });
    expect(repo.list(all).items[0]).toEqual(rina);
  });

  test("keeping your own email, even in another letter case, is not a conflict", () => {
    const { repo } = seeded();
    expect(repo.update(1, { email: "RINA@X.example" })).toEqual({
      kind: "ok",
      participant: { ...rina, email: "RINA@X.example" },
    });
  });

  test("an unknown id is not_found", () => {
    const { repo } = seeded();
    expect(repo.update(999, { disabled: true })).toEqual({ kind: "not_found" });
    expect(repo.update(999, {})).toEqual({ kind: "not_found" });
  });
});

describe("remove", () => {
  test("deletes only that participant and says whether it existed", () => {
    const { repo } = setup();
    repo.insertMany([guest("Rina"), guest("Budi")]);
    expect(repo.remove(1)).toBe(true);
    expect(repo.list(all).items.map((p) => p.name)).toEqual(["Budi"]);
    expect(repo.remove(1)).toBe(false);
    expect(repo.remove(999)).toBe(false);
  });

  test("the email can be used again after the participant is deleted", () => {
    const { repo } = setup();
    repo.insertMany([guest("Rina")]);
    repo.remove(1);
    expect(repo.insert({ name: "Rina Again", email: "rina@x.example" })).not.toBeNull();
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
    repo.update(1, { disabled: true });
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
