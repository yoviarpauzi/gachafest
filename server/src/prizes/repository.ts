import type { Database } from "bun:sqlite";

export type Tier = "basic" | "premium";
// `drawn` is 0 until the Draw sub-project counts the winners of each prize.
export type Prize = {
  id: number;
  name: string;
  value: number | null;
  winners: number;
  tier: Tier;
  drawn: number;
};

type Row = { id: number; name: string; value: number | null; winners: number; tier: Tier };

type NewPrize = { name: string; value?: number | null; winners: number; tier: Tier };
type Patch = { name?: string; value?: number | null; winners?: number; tier?: Tier };
type UpdateResult = { kind: "ok"; prize: Prize } | { kind: "not_found" };

const COLUMNS = "id, name, value, winners, tier";

const toPrize = (row: Row): Prize => ({ ...row, drawn: 0 });

export function createPrizesRepository(db: Database) {
  const find = (id: number) => {
    const row = db.query(`SELECT ${COLUMNS} FROM prizes WHERE id = ?`).get(id) as Row | null;
    return row ? toPrize(row) : null;
  };

  return {
    /** Every prize in draw order. */
    list(): Prize[] {
      const rows = db.query(`SELECT ${COLUMNS} FROM prizes ORDER BY position, id`).all() as Row[];
      return rows.map(toPrize);
    },

    /** Adds a prize at the end of the draw order. */
    insert(input: NewPrize): Prize {
      const { lastInsertRowid } = db.run(
        `INSERT INTO prizes (name, value, winners, tier, position, created_at)
         VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM prizes), ?)`,
        [input.name, input.value ?? null, input.winners, input.tier, new Date().toISOString()],
      );
      return find(Number(lastInsertRowid))!;
    },

    /** Changes only the fields given; `value: null` clears the value, no `value` leaves it alone. */
    update(id: number, patch: Patch): UpdateResult {
      // Column names are fixed here; the values are bound.
      const sets: string[] = [];
      const values: (string | number | null)[] = [];
      if (patch.name !== undefined) {
        sets.push("name = ?");
        values.push(patch.name);
      }
      if (patch.value !== undefined) {
        sets.push("value = ?");
        values.push(patch.value);
      }
      if (patch.winners !== undefined) {
        sets.push("winners = ?");
        values.push(patch.winners);
      }
      if (patch.tier !== undefined) {
        sets.push("tier = ?");
        values.push(patch.tier);
      }

      if (sets.length > 0) {
        const { changes } = db.run(`UPDATE prizes SET ${sets.join(", ")} WHERE id = ?`, [...values, id]);
        if (changes === 0) return { kind: "not_found" };
      }
      const prize = find(id);
      return prize ? { kind: "ok", prize } : { kind: "not_found" };
    },

    /** Deletes one prize; false when there was none with that id. */
    remove(id: number): boolean {
      return db.run("DELETE FROM prizes WHERE id = ?", [id]).changes > 0;
    },

    /**
     * Saves a new draw order. `ids` must be exactly the prizes there are now, each once; anything else
     * (a prize added or deleted in another tab, a repeated id) is `stale` and changes nothing.
     */
    reorder(ids: number[]): { kind: "ok" } | { kind: "stale" } {
      return db.transaction((): { kind: "ok" } | { kind: "stale" } => {
        const current = (db.query("SELECT id FROM prizes").all() as { id: number }[]).map((row) => row.id);
        const wanted = new Set(ids);
        const same =
          ids.length === current.length &&
          wanted.size === ids.length &&
          current.every((id) => wanted.has(id));
        if (!same) return { kind: "stale" };

        const move = db.query("UPDATE prizes SET position = ? WHERE id = ?");
        ids.forEach((id, index) => move.run(index + 1, id));
        return { kind: "ok" };
      })();
    },
  };
}
