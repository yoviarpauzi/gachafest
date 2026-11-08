import { describe, expect, test } from "bun:test";
import { parseParticipantsFile } from "./parse";
import { planImport } from "./plan";

const parsedOf = (rows: [string, string][], problems = 0) => ({
  rowsRead: rows.length + problems,
  rows: rows.map(([name, email], i) => ({ row: i + 2, name, email })),
  problems: Array.from({ length: problems }, (_, i) => ({
    row: rows.length + i + 2,
    reason: "Email is missing",
  })),
});

describe("planImport", () => {
  test("keeps the first of in-file duplicates, case-insensitively", () => {
    const plan = planImport(
      parsedOf([
        ["Rina", "Rina@X.example"],
        ["Rina Again", "rina@x.example"],
        ["Budi", "budi@x.example"],
      ]),
      new Set(),
    );
    expect(plan.toInsert).toEqual([
      { name: "Rina", email: "Rina@X.example" },
      { name: "Budi", email: "budi@x.example" },
    ]);
    expect(plan.duplicates).toBe(1);
  });

  test("counts emails already stored as duplicates", () => {
    const plan = planImport(
      parsedOf([
        ["Rina", "rina@x.example"],
        ["Rina Again", "RINA@x.example"],
        ["Budi", "budi@x.example"],
      ]),
      new Set(["budi@x.example"]),
    );
    expect(plan.toInsert).toEqual([{ name: "Rina", email: "rina@x.example" }]);
    expect(plan.duplicates).toBe(2);
  });

  test("rowsRead equals valid plus problems plus duplicates", async () => {
    const parsed = await parseParticipantsFile(
      "guests.csv",
      new TextEncoder().encode(
        "name,email\nA,a@x.example\nB,b@x.example\nA again,A@x.example\nC,\nD,d@x.example\n",
      ),
    );
    const plan = planImport(parsed, new Set(["d@x.example"]));
    expect(plan.toInsert.length + plan.duplicates + plan.problems.length).toBe(parsed.rowsRead);
    expect(plan.toInsert.length).toBe(2);
    expect(plan.duplicates).toBe(2);
    expect(plan.problems).toEqual([{ row: 5, reason: "Email is missing" }]);
  });
});
