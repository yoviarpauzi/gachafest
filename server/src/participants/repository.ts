import type { Database } from "bun:sqlite";

export type Participant = { id: number; name: string; email: string; disabled: boolean };

type Row = { id: number; name: string; email: string; disabled: number };

type Patch = { name?: string; email?: string; disabled?: boolean };
type UpdateResult =
  | { kind: "ok"; participant: Participant }
  | { kind: "not_found" }
  | { kind: "email_taken" };

const toParticipant = (row: Row): Participant => ({
  id: row.id,
  name: row.name,
  email: row.email,
  disabled: row.disabled === 1,
});

/** `%`, `_` and `\` typed by the organizer are text, not LIKE wildcards. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

export function createParticipantsRepository(db: Database) {
  const count = (sql: string, ...params: string[]) =>
    (db.query(sql).get(...params) as { n: number }).n;

  return {
    list(opts: { q: string; page: number; pageSize: number }) {
      const filter = opts.q === "";
      const where = filter ? "" : "WHERE name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'";
      const pattern = `%${escapeLike(opts.q)}%`;
      const params = filter ? [] : [pattern, pattern];

      const rows = db
        .query(`SELECT id, name, email, disabled FROM participants ${where} ORDER BY id LIMIT ? OFFSET ?`)
        .all(...params, opts.pageSize, (opts.page - 1) * opts.pageSize) as Row[];

      return {
        items: rows.map(toParticipant),
        matching: count(`SELECT COUNT(*) AS n FROM participants ${where}`, ...params),
        total: count("SELECT COUNT(*) AS n FROM participants"),
        disabled: count("SELECT COUNT(*) AS n FROM participants WHERE disabled = 1"),
      };
    },

    /** Changes only the fields given. `email_taken` when another participant has that email in any letter case. */
    update(id: number, patch: Patch): UpdateResult {
      // Column names are fixed here; the values are bound.
      const sets: string[] = [];
      const values: (string | number)[] = [];
      if (patch.name !== undefined) {
        sets.push("name = ?");
        values.push(patch.name);
      }
      if (patch.email !== undefined) {
        sets.push("email = ?");
        values.push(patch.email);
      }
      if (patch.disabled !== undefined) {
        sets.push("disabled = ?");
        values.push(patch.disabled ? 1 : 0);
      }

      try {
        if (sets.length > 0) {
          const { changes } = db.run(`UPDATE participants SET ${sets.join(", ")} WHERE id = ?`, [
            ...values,
            id,
          ]);
          if (changes === 0) return { kind: "not_found" };
        }
      } catch (error) {
        if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) {
          return { kind: "email_taken" };
        }
        throw error;
      }

      const row = db
        .query("SELECT id, name, email, disabled FROM participants WHERE id = ?")
        .get(id) as Row | null;
      return row ? { kind: "ok", participant: toParticipant(row) } : { kind: "not_found" };
    },

    /** Deletes one participant. Someone with any winner row, cancelled ones included, is kept: disable them instead. */
    remove(id: number): "ok" | "not_found" | "has_winners" {
      if (db.query("SELECT 1 FROM winners WHERE participant_id = ?").get(id)) return "has_winners";
      return db.run("DELETE FROM participants WHERE id = ?", [id]).changes > 0 ? "ok" : "not_found";
    },

    emailKeys(): Set<string> {
      const rows = db.query("SELECT lower(email) AS key FROM participants").all() as {
        key: string;
      }[];
      return new Set(rows.map((row) => row.key));
    },

    /** Adds one participant; `null` when the email is already there in any letter case (nothing changes). */
    insert(row: { name: string; email: string }): Participant | null {
      const { changes, lastInsertRowid } = db.run(
        "INSERT INTO participants (name, email, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING",
        [row.name, row.email, new Date().toISOString()],
      );
      if (changes === 0) return null;
      return { id: Number(lastInsertRowid), name: row.name, email: row.email, disabled: false };
    },

    /** Inserts in one transaction and returns how many rows were new (existing emails are skipped). */
    insertMany(rows: { name: string; email: string }[]): number {
      const insert = db.query(
        "INSERT INTO participants (name, email, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING",
      );
      const createdAt = new Date().toISOString();
      return db.transaction(() => {
        let inserted = 0;
        for (const row of rows) inserted += insert.run(row.name, row.email, createdAt).changes;
        return inserted;
      })();
    },
  };
}
