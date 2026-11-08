import type { Database } from "bun:sqlite";
import { randomInt } from "node:crypto";

export type Winner = {
  id: number;
  prizeId: number;
  prizeName: string;
  participantName: string;
  drawnAt: string;
  cancelledAt: string | null;
  status: "valid" | "cancelled";
  /** True while the prize has fewer valid winners than its quota, so a draw (a redraw) can fill a slot. */
  prizeHasFreeSlot: boolean;
};

export type ExportRow = {
  prizeName: string;
  prizeValue: number | null;
  participantName: string;
  participantEmail: string;
  drawnAt: string;
  cancelledAt: string | null;
  status: "valid" | "cancelled";
};

type Row = {
  id: number;
  prizeId: number;
  prizeName: string;
  participantName: string;
  drawnAt: string;
  cancelledAt: string | null;
  prizeHasFreeSlot: number;
};

type ExportDbRow = Omit<ExportRow, "status"> & { prizeValue: number | null };

type DrawResult =
  | { kind: "ok"; winner: Winner }
  | { kind: "prize_not_found" }
  | { kind: "prize_full" }
  | { kind: "no_eligible" };

type CancelResult =
  | { kind: "ok"; winner: Winner }
  | { kind: "not_found" }
  | { kind: "already_cancelled" };

// Prize order first (the order they are drawn in), then when the winner was drawn.
const ORDER = "ORDER BY p.position, p.id, w.drawn_at, w.id";

const SELECT_WINNER = `
  SELECT w.id AS id, w.prize_id AS prizeId, p.name AS prizeName, pa.name AS participantName,
         w.drawn_at AS drawnAt, w.cancelled_at AS cancelledAt,
         (SELECT COUNT(*) FROM winners v WHERE v.prize_id = w.prize_id AND v.cancelled_at IS NULL) < p.winners
           AS prizeHasFreeSlot
  FROM winners w
  JOIN prizes p ON p.id = w.prize_id
  JOIN participants pa ON pa.id = w.participant_id`;

const toWinner = (row: Row): Winner => ({
  id: row.id,
  prizeId: row.prizeId,
  prizeName: row.prizeName,
  participantName: row.participantName,
  drawnAt: row.drawnAt,
  cancelledAt: row.cancelledAt,
  status: row.cancelledAt === null ? "valid" : "cancelled",
  prizeHasFreeSlot: row.prizeHasFreeSlot === 1,
});

export function createWinnersRepository(
  db: Database,
  deps: { random?: (max: number) => number; now?: () => Date } = {},
) {
  // `random(max)` answers an integer from 0 to max - 1; tests replace it to choose who is picked.
  const random = deps.random ?? ((max: number) => randomInt(0, max));
  const now = deps.now ?? (() => new Date());

  const find = (id: number) => {
    const row = db.query(`${SELECT_WINNER} WHERE w.id = ?`).get(id) as Row | null;
    return row ? toWinner(row) : null;
  };

  return {
    list(): { items: Winner[]; draws: number; cancelled: number } {
      const rows = db.query(`${SELECT_WINNER} ${ORDER}`).all() as Row[];
      const items = rows.map(toWinner);
      return {
        items,
        draws: items.length,
        cancelled: items.filter((winner) => winner.status === "cancelled").length,
      };
    },

    /**
     * Draws one winner for a prize and saves it, in one transaction. Eligible: a participant who is not
     * disabled and has no row for this prize yet (cancelled ones included, so nobody wins a prize twice).
     * Someone who won another prize can still win this one.
     */
    draw(prizeId: number): DrawResult {
      return db.transaction((): DrawResult => {
        const prize = db.query("SELECT winners AS quota FROM prizes WHERE id = ?").get(prizeId) as {
          quota: number;
        } | null;
        if (!prize) return { kind: "prize_not_found" };

        const { n: valid } = db
          .query("SELECT COUNT(*) AS n FROM winners WHERE prize_id = ? AND cancelled_at IS NULL")
          .get(prizeId) as { n: number };
        if (valid >= prize.quota) return { kind: "prize_full" };

        const pool = db
          .query(
            `SELECT id FROM participants
             WHERE disabled = 0 AND id NOT IN (SELECT participant_id FROM winners WHERE prize_id = ?)
             ORDER BY id`,
          )
          .all(prizeId) as { id: number }[];
        if (pool.length === 0) return { kind: "no_eligible" };

        const picked = pool[random(pool.length)]!;
        const { lastInsertRowid } = db.run(
          "INSERT INTO winners (prize_id, participant_id, drawn_at) VALUES (?, ?, ?)",
          [prizeId, picked.id, now().toISOString()],
        );
        return { kind: "ok", winner: find(Number(lastInsertRowid))! };
      })();
    },

    /** Marks a winner cancelled (the row stays, with the time), which opens one slot on the prize. */
    cancel(id: number): CancelResult {
      const winner = find(id);
      if (!winner) return { kind: "not_found" };
      if (winner.status === "cancelled") return { kind: "already_cancelled" };
      db.run("UPDATE winners SET cancelled_at = ? WHERE id = ?", [now().toISOString(), id]);
      return { kind: "ok", winner: find(id)! };
    },

    /** Every row for the CSV, with the email and the prize value, in the order of `list`. */
    exportRows(): ExportRow[] {
      const rows = db
        .query(
          `SELECT p.name AS prizeName, p.value AS prizeValue, pa.name AS participantName,
                  pa.email AS participantEmail, w.drawn_at AS drawnAt, w.cancelled_at AS cancelledAt
           FROM winners w
           JOIN prizes p ON p.id = w.prize_id
           JOIN participants pa ON pa.id = w.participant_id
           ${ORDER}`,
        )
        .all() as ExportDbRow[];
      return rows.map((row) => ({ ...row, status: row.cancelledAt === null ? "valid" : "cancelled" }));
    },
  };
}
