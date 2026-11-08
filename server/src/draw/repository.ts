import type { Database } from "bun:sqlite";
import { randomInt } from "node:crypto";
import type { createPrizesRepository } from "../prizes/repository";
import type { Winner, createWinnersRepository } from "../winners/repository";

/** How long the reveal takes on the big screen, from the moment the result is saved (PRD US-5). */
export const ANIMATION_MS = { premium: 8000, basic: 4000 } as const;

/** How many names the reel on the big screen may spin through. */
const REEL_SIZE = 50;

export type Phase = "idle" | "standby" | "reveal";

export type PrizeView = {
  id: number;
  name: string;
  value: number | null;
  winners: number;
  drawn: number;
  tier: "basic" | "premium";
  /** 1-based place in the draw order. */
  position: number;
  total: number;
};

export type Reveal = {
  winner: Winner;
  prize: PrizeView;
  revealedAt: string;
  animationEndsAt: string;
  skipped: boolean;
};

export type DrawState = {
  /** The server's clock, so clients can measure the animation without trusting their own. */
  now: string;
  phase: Phase;
  activePrize: PrizeView | null;
  /** How many guests can be drawn for the active prize; null when there is no active prize. */
  eligibleCount: number | null;
  reveal: Reveal | null;
};

type StateRow = {
  phase: Phase;
  selected_prize_id: number | null;
  winner_id: number | null;
  revealed_at: string | null;
  skipped: number;
  reel: string | null;
};

type WithState = { kind: "ok"; state: DrawState };

export function createDrawRepository(
  db: Database,
  deps: {
    winners: ReturnType<typeof createWinnersRepository>;
    prizes: ReturnType<typeof createPrizesRepository>;
    now?: () => Date;
    random?: (max: number) => number;
  },
) {
  const { winners, prizes } = deps;
  const random = deps.random ?? ((max: number) => randomInt(0, max));
  const now = deps.now ?? (() => new Date());

  const readRow = () =>
    db
      .query("SELECT phase, selected_prize_id, winner_id, revealed_at, skipped, reel FROM draw_state WHERE id = 1")
      .get() as StateRow;

  const prizeViews = (): PrizeView[] => {
    const all = prizes.list();
    return all.map((prize, index) => ({
      id: prize.id,
      name: prize.name,
      value: prize.value,
      winners: prize.winners,
      drawn: prize.drawn,
      tier: prize.tier,
      position: index + 1,
      total: all.length,
    }));
  };

  const hasFreeSlot = (prize: PrizeView) => prize.drawn < prize.winners;

  // The selected prize while it has a free slot, else the first prize in order that does, else none.
  const resolveActive = (list: PrizeView[], selectedId: number | null) =>
    list.find((prize) => prize.id === selectedId && hasFreeSlot(prize)) ?? list.find(hasFreeSlot) ?? null;

  function currentState(): DrawState {
    const row = readRow();
    const list = prizeViews();
    const active = resolveActive(list, row.selected_prize_id);

    let reveal: Reveal | null = null;
    if (row.phase === "reveal" && row.winner_id !== null && row.revealed_at !== null) {
      const winner = winners.get(row.winner_id);
      const prize = winner ? list.find((p) => p.id === winner.prizeId) : undefined;
      if (winner && prize) {
        reveal = {
          winner,
          prize,
          revealedAt: row.revealed_at,
          animationEndsAt: new Date(Date.parse(row.revealed_at) + ANIMATION_MS[prize.tier]).toISOString(),
          skipped: row.skipped === 1,
        };
      }
    }

    return {
      now: now().toISOString(),
      phase: row.phase,
      activePrize: active,
      eligibleCount: active ? winners.eligible(active.id).length : null,
      reveal,
    };
  }

  // A random sample of the pool, without repeats, by a partial Fisher-Yates shuffle driven by `random`.
  function sample(pool: string[], limit: number): string[] {
    const names = [...pool];
    const count = Math.min(limit, names.length);
    for (let i = 0; i < count; i++) {
      const j = i + random(names.length - i);
      [names[i], names[j]] = [names[j]!, names[i]!];
    }
    return names.slice(0, count);
  }

  return {
    state: currentState,

    /** Chooses the prize the next draw is for. Not while a winner is on screen, and only a prize with a free slot. */
    select(
      prizeId: number,
    ): WithState | { kind: "prize_not_found" } | { kind: "reveal_pending" } | { kind: "prize_full" } {
      if (readRow().phase === "reveal") return { kind: "reveal_pending" };
      const prize = prizeViews().find((p) => p.id === prizeId);
      if (!prize) return { kind: "prize_not_found" };
      if (!hasFreeSlot(prize)) return { kind: "prize_full" };
      db.run("UPDATE draw_state SET selected_prize_id = ? WHERE id = 1", [prizeId]);
      return { kind: "ok", state: currentState() };
    },

    /**
     * Draws one winner for the active prize and puts them on the big screen, in one transaction: the winner
     * row, the reel and the state change are saved together or not at all.
     */
    draw():
      | WithState
      | { kind: "reveal_pending" }
      | { kind: "no_open_prize" }
      | { kind: "no_eligible" }
      | { kind: "prize_full" }
      | { kind: "prize_not_found" } {
      return db.transaction(() => {
        const row = readRow();
        if (row.phase === "reveal") return { kind: "reveal_pending" } as const;

        const active = resolveActive(prizeViews(), row.selected_prize_id);
        if (!active) return { kind: "no_open_prize" } as const;

        const drawn = winners.draw(active.id);
        if (drawn.kind !== "ok") return drawn;

        // The winner is saved, so they are no longer in the pool: the reel never contains the winner.
        const reel = sample(winners.eligible(active.id).map((p) => p.name), REEL_SIZE);
        db.run(
          "UPDATE draw_state SET phase = 'reveal', winner_id = ?, revealed_at = ?, skipped = 0, reel = ? WHERE id = 1",
          [drawn.winner.id, now().toISOString(), JSON.stringify(reel)],
        );
        return { kind: "ok", state: currentState() } as const;
      })();
    },

    /** Skips the animation, on the big screen too. Can be pressed again. */
    skip(): WithState | { kind: "not_revealing" } {
      if (readRow().phase !== "reveal") return { kind: "not_revealing" };
      db.run("UPDATE draw_state SET skipped = 1 WHERE id = 1");
      return { kind: "ok", state: currentState() };
    },

    /** Back to standby after a reveal. From standby or idle nothing changes, so it can be pressed twice. */
    done(): WithState {
      if (readRow().phase === "reveal") {
        db.run(
          "UPDATE draw_state SET phase = 'standby', winner_id = NULL, revealed_at = NULL, skipped = 0, reel = NULL WHERE id = 1",
        );
      }
      return { kind: "ok", state: currentState() };
    },
  };
}
