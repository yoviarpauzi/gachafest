import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { openDatabase } from "../db/database";
import { migrate } from "../db/migrate";
import { createPrizesRepository } from "./repository";

function setup() {
  const db = openDatabase(":memory:");
  migrate(db, join(import.meta.dir, "../../migrations"));
  return { db, repo: createPrizesRepository(db) };
}

const prize = (name: string, extra: Partial<Parameters<ReturnType<typeof setup>["repo"]["insert"]>[0]> = {}) => ({
  name,
  winners: 1,
  tier: "basic" as const,
  ...extra,
});

const ids = (repo: ReturnType<typeof setup>["repo"]) => repo.list().map((p) => p.id);

function threePrizes() {
  const ctx = setup();
  ctx.repo.insert(prize("Grand Prize", { value: 10_000_000, tier: "premium" }));
  ctx.repo.insert(prize("Second Prize", { winners: 2 }));
  ctx.repo.insert(prize("Door Prize", { winners: 5 }));
  return ctx;
}

describe("prizes table", () => {
  test("its checks reject winners of 0, a value of 0 and an unknown tier", () => {
    const { db } = setup();
    const insert = (value: number | null, winners: number, tier: string) =>
      db.run(
        "INSERT INTO prizes (name, value, winners, tier, position, created_at) VALUES ('A', ?, ?, ?, 1, 't')",
        [value, winners, tier],
      );
    expect(() => insert(null, 0, "basic")).toThrow(/CHECK constraint failed/);
    expect(() => insert(0, 1, "basic")).toThrow(/CHECK constraint failed/);
    expect(() => insert(null, 1, "gold")).toThrow(/CHECK constraint failed/);
    expect(() => insert(null, 1, "basic")).not.toThrow();
  });
});

describe("insert and list", () => {
  test("a prize without a value or tier is stored as no value, basic and not yet drawn", () => {
    const { repo } = setup();
    const created = repo.insert({ name: "Door Prize", winners: 5, tier: "basic" });
    expect(created).toEqual({
      id: 1,
      name: "Door Prize",
      value: null,
      winners: 5,
      tier: "basic",
      drawn: 0,
    });
    expect(repo.list()).toEqual([created]);
  });

  test("keeps the value and tier it is given and puts each new prize after the last", () => {
    const { repo } = setup();
    const first = repo.insert(prize("Grand Prize", { value: 10_000_000, tier: "premium" }));
    const second = repo.insert(prize("Second Prize"));
    expect(first.value).toBe(10_000_000);
    expect(first.tier).toBe("premium");
    expect(repo.list().map((p) => p.name)).toEqual(["Grand Prize", "Second Prize"]);
    expect(second.id).toBeGreaterThan(first.id);
  });
});

describe("update", () => {
  test("changes only the fields it is given", () => {
    const { repo } = threePrizes();
    const result = repo.update(1, { winners: 3 });
    expect(result).toEqual({
      kind: "ok",
      prize: {
        id: 1,
        name: "Grand Prize",
        value: 10_000_000,
        winners: 3,
        tier: "premium",
        drawn: 0,
      },
    });
  });

  test("a null value clears the value, while an absent value leaves it alone", () => {
    const { repo } = threePrizes();
    const cleared = repo.update(1, { value: null });
    expect(cleared.kind === "ok" && cleared.prize.value).toBe(null);
    const untouched = repo.update(1, { name: "Grand Prize!" });
    expect(untouched.kind === "ok" && untouched.prize.value).toBe(null);
    const set = repo.update(1, { value: 7_500_000, tier: "basic" });
    expect(set.kind === "ok" && [set.prize.value, set.prize.tier]).toEqual([7_500_000, "basic"]);
  });

  test("does not move the prize in the draw order", () => {
    const { repo } = threePrizes();
    repo.update(2, { name: "Runner-up" });
    expect(repo.list().map((p) => p.name)).toEqual(["Grand Prize", "Runner-up", "Door Prize"]);
  });

  test("an unknown id is not found", () => {
    const { repo } = threePrizes();
    expect(repo.update(99, { name: "x" })).toEqual({ kind: "not_found" });
  });
});

describe("remove", () => {
  test("removes once, then says it is gone, and leaves the order of the others", () => {
    const { repo } = threePrizes();
    expect(repo.remove(2)).toBe(true);
    expect(repo.remove(2)).toBe(false);
    expect(ids(repo)).toEqual([1, 3]);
  });
});

describe("reorder", () => {
  test("writes the new order", () => {
    const { repo } = threePrizes();
    expect(repo.reorder([3, 1, 2])).toEqual({ kind: "ok" });
    expect(ids(repo)).toEqual([3, 1, 2]);
  });

  test("a new prize goes after the reordered ones", () => {
    const { repo } = threePrizes();
    repo.reorder([3, 2, 1]);
    const added = repo.insert(prize("Extra"));
    expect(ids(repo)).toEqual([3, 2, 1, added.id]);
  });

  test("is stale, and changes nothing, for a missing, extra, duplicate or unknown id or an empty list", () => {
    const { repo } = threePrizes();
    const before = repo.list();
    for (const bad of [[1, 2], [1, 2, 3, 4], [1, 1, 2], [1, 2, 99], [1, 2, 3, 3], []]) {
      expect(repo.reorder(bad)).toEqual({ kind: "stale" });
      expect(repo.list()).toEqual(before);
    }
  });

  test("still works after a prize in the middle was removed", () => {
    const { repo } = threePrizes();
    repo.remove(2);
    expect(repo.reorder([3, 1])).toEqual({ kind: "ok" });
    expect(ids(repo)).toEqual([3, 1]);
    expect(repo.reorder([1, 2, 3])).toEqual({ kind: "stale" });
  });
});
