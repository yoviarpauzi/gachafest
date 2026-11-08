import type { Database } from "bun:sqlite";

export type Participant = { id: number; name: string; email: string; disabled: boolean };

type Row = { id: number; name: string; email: string; disabled: number };

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

    setDisabled(id: number, disabled: boolean): Participant | null {
      const { changes } = db.run("UPDATE participants SET disabled = ? WHERE id = ?", [
        disabled ? 1 : 0,
        id,
      ]);
      if (changes === 0) return null;
      const row = db
        .query("SELECT id, name, email, disabled FROM participants WHERE id = ?")
        .get(id) as Row;
      return toParticipant(row);
    },

    emailKeys(): Set<string> {
      const rows = db.query("SELECT lower(email) AS key FROM participants").all() as {
        key: string;
      }[];
      return new Set(rows.map((row) => row.key));
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
