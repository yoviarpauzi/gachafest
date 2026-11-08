import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { openDatabase } from "../db/database";
import { migrate } from "../db/migrate";
import { createParticipantsRepository } from "../participants/repository";
import { createPrizesRepository } from "../prizes/repository";
import { createWinnersRepository } from "./repository";

// `random` answers the indexes queued in `picks` (0 when the queue is empty) and remembers the pool size it
// was asked about, so a test can see both what was picked and from how many.
function setup() {
  const db = openDatabase(":memory:");
  migrate(db, join(import.meta.dir, "../../migrations"));
  const picks: number[] = [];
  const asked: number[] = [];
  const clock = { at: Date.parse("2026-11-08T13:00:00.000Z") };
  const winners = createWinnersRepository(db, {
    random: (max) => {
      asked.push(max);
      return picks.shift() ?? 0;
    },
    now: () => new Date(clock.at),
  });
  const participants = createParticipantsRepository(db);
  const prizes = createPrizesRepository(db);
  const guests = (...names: string[]) =>
    names.map((name) => participants.insert({ name, email: `${name.toLowerCase()}@x.example` })!);
  const prize = (name: string, quota: number, value: number | null = null) =>
    prizes.insert({ name, winners: quota, tier: "basic", value });
  const minutesLater = (n: number) => (clock.at += n * 60_000);
  return { db, winners, participants, prizes, picks, asked, guests, prize, minutesLater };
}

const names = (items: { participantName: string }[]) => items.map((w) => w.participantName);

describe("winners table", () => {
  test("foreign keys reject an unknown prize or participant, and the same pair cannot repeat", () => {
    const { db, guests, prize } = setup();
    const [rina] = guests("Rina");
    const grand = prize("Grand Prize", 1);
    const add = (prizeId: number, participantId: number) =>
      db.run("INSERT INTO winners (prize_id, participant_id, drawn_at) VALUES (?, ?, 't')", [
        prizeId,
        participantId,
      ]);
    expect(() => add(99, rina!.id)).toThrow(/FOREIGN KEY constraint failed/);
    expect(() => add(grand.id, 99)).toThrow(/FOREIGN KEY constraint failed/);
    expect(() => add(grand.id, rina!.id)).not.toThrow();
    expect(() => add(grand.id, rina!.id)).toThrow(/UNIQUE constraint failed/);
  });
});

describe("draw", () => {
  test("picks the eligible participant at the index random returns, in id order, and records the time", () => {
    const { winners, guests, prize, picks, asked } = setup();
    guests("Rina", "Budi", "Maya");
    const grand = prize("Grand Prize", 2);
    picks.push(1);
    const result = winners.draw(grand.id);
    expect(asked).toEqual([3]);
    expect(result).toEqual({
      kind: "ok",
      winner: {
        id: 1,
        prizeId: grand.id,
        prizeName: "Grand Prize",
        participantName: "Budi",
        drawnAt: "2026-11-08T13:00:00.000Z",
        cancelledAt: null,
        status: "valid",
        prizeHasFreeSlot: true,
      },
    });
  });

  test("never picks a disabled participant", () => {
    const { winners, participants, guests, prize } = setup();
    const [rina, budi, maya] = guests("Rina", "Budi", "Maya");
    participants.update(rina!.id, { disabled: true });
    participants.update(maya!.id, { disabled: true });
    const grand = prize("Grand Prize", 3);
    const result = winners.draw(grand.id);
    expect(result.kind === "ok" && result.winner.participantName).toBe("Budi");
    expect(budi!.id).toBeGreaterThan(0);
    expect(winners.draw(grand.id)).toEqual({ kind: "no_eligible" });
  });

  test("never picks someone who already has a row for that prize, valid or cancelled", () => {
    const { winners, guests, prize, asked } = setup();
    guests("Rina", "Budi", "Maya");
    const grand = prize("Grand Prize", 3);
    const first = winners.draw(grand.id); // Rina
    const second = winners.draw(grand.id); // Budi
    expect(first.kind === "ok" && first.winner.participantName).toBe("Rina");
    expect(second.kind === "ok" && second.winner.participantName).toBe("Budi");
    if (second.kind === "ok") winners.cancel(second.winner.id);
    asked.length = 0;
    const third = winners.draw(grand.id);
    expect(asked).toEqual([1]);
    expect(third.kind === "ok" && third.winner.participantName).toBe("Maya");
  });

  test("lets one person win different prizes", () => {
    const { winners, guests, prize } = setup();
    guests("Rina");
    const grand = prize("Grand Prize", 1);
    const second = prize("Second Prize", 1);
    const a = winners.draw(grand.id);
    const b = winners.draw(second.id);
    expect(a.kind === "ok" && a.winner.participantName).toBe("Rina");
    expect(b.kind === "ok" && b.winner.participantName).toBe("Rina");
  });

  test("answers prize_full, no_eligible and prize_not_found, and records nothing", () => {
    const { winners, guests, prize } = setup();
    guests("Rina");
    const grand = prize("Grand Prize", 1);
    const second = prize("Second Prize", 2);
    expect(winners.draw(99)).toEqual({ kind: "prize_not_found" });
    expect(winners.draw(grand.id).kind).toBe("ok");
    expect(winners.draw(grand.id)).toEqual({ kind: "prize_full" });
    expect(winners.draw(second.id).kind).toBe("ok");
    expect(winners.draw(second.id)).toEqual({ kind: "no_eligible" });
    expect(winners.list().draws).toBe(2);
  });

  test("after a cancel the slot opens, and the cancelled person cannot take it", () => {
    const { winners, guests, prize } = setup();
    guests("Rina", "Budi");
    const grand = prize("Grand Prize", 1);
    const first = winners.draw(grand.id);
    expect(first.kind === "ok" && first.winner.participantName).toBe("Rina");
    expect(winners.draw(grand.id)).toEqual({ kind: "prize_full" });
    if (first.kind === "ok") winners.cancel(first.winner.id);
    const again = winners.draw(grand.id);
    expect(again.kind === "ok" && again.winner.participantName).toBe("Budi");
  });

  test("a prize never ends with more valid winners than its quota across cancel and redraw cycles", () => {
    const { winners, guests, prize } = setup();
    guests("Rina", "Budi", "Maya", "Agus");
    const grand = prize("Grand Prize", 1);
    const valid = () => winners.list().items.filter((w) => w.status === "valid").length;
    for (let round = 0; round < 3; round++) {
      const drawn = winners.draw(grand.id);
      expect(drawn.kind).toBe("ok");
      expect(valid()).toBe(1);
      expect(winners.draw(grand.id)).toEqual({ kind: "prize_full" });
      expect(valid()).toBe(1);
      if (drawn.kind === "ok") winners.cancel(drawn.winner.id);
      expect(valid()).toBe(0);
    }
    const last = winners.draw(grand.id);
    expect(last.kind === "ok" && last.winner.participantName).toBe("Agus");
    if (last.kind === "ok") winners.cancel(last.winner.id);
    expect(winners.draw(grand.id)).toEqual({ kind: "no_eligible" });
    expect(winners.list().draws).toBe(4);
    expect(valid()).toBe(0);
  });
});

describe("cancel", () => {
  test("marks the winner cancelled with the time, once", () => {
    const { winners, guests, prize, minutesLater } = setup();
    guests("Rina");
    const grand = prize("Grand Prize", 1);
    const drawn = winners.draw(grand.id);
    minutesLater(5);
    const id = drawn.kind === "ok" ? drawn.winner.id : -1;
    const cancelled = winners.cancel(id);
    expect(cancelled).toMatchObject({
      kind: "ok",
      winner: { id, status: "cancelled", cancelledAt: "2026-11-08T13:05:00.000Z", prizeHasFreeSlot: true },
    });
    expect(winners.cancel(id)).toEqual({ kind: "already_cancelled" });
    expect(winners.cancel(99)).toEqual({ kind: "not_found" });
    expect(winners.list().items[0]!.cancelledAt).toBe("2026-11-08T13:05:00.000Z");
  });
});

describe("list", () => {
  test("orders by prize, then time, then id, and counts draws and cancellations", () => {
    const { winners, guests, prize, minutesLater } = setup();
    guests("Rina", "Budi", "Maya", "Agus");
    const grand = prize("Grand Prize", 1);
    const second = prize("Second Prize", 2);
    const third = prize("Third Prize", 1);
    // Drawn out of prize order on purpose.
    winners.draw(third.id); // Rina, 13:00
    minutesLater(1);
    const s1 = winners.draw(second.id); // Rina is eligible for another prize: Rina again
    minutesLater(1);
    winners.draw(second.id); // Budi
    minutesLater(1);
    winners.draw(grand.id); // Rina
    if (s1.kind === "ok") winners.cancel(s1.winner.id);

    const { items, draws, cancelled } = winners.list();
    expect(items.map((w) => w.prizeName)).toEqual([
      "Grand Prize",
      "Second Prize",
      "Second Prize",
      "Third Prize",
    ]);
    expect(names(items)).toEqual(["Rina", "Rina", "Budi", "Rina"]);
    expect(items[1]!.status).toBe("cancelled");
    expect(items[2]!.status).toBe("valid");
    expect({ draws, cancelled }).toEqual({ draws: 4, cancelled: 1 });
  });

  test("a prize has a free slot only while its valid winners are below its quota", () => {
    const { winners, guests, prize } = setup();
    guests("Rina", "Budi", "Maya");
    const second = prize("Second Prize", 2);
    const a = winners.draw(second.id);
    expect(winners.list().items.map((w) => w.prizeHasFreeSlot)).toEqual([true]);
    winners.draw(second.id);
    expect(winners.list().items.map((w) => w.prizeHasFreeSlot)).toEqual([false, false]);
    if (a.kind === "ok") winners.cancel(a.winner.id);
    expect(winners.list().items.map((w) => w.prizeHasFreeSlot)).toEqual([true, true]);
  });

  test("is empty with nothing drawn", () => {
    expect(setup().winners.list()).toEqual({ items: [], draws: 0, cancelled: 0 });
  });
});

describe("exportRows", () => {
  test("carries the email and the prize value, in the order of the list", () => {
    const { winners, guests, prize, minutesLater } = setup();
    guests("Rina", "Budi");
    const grand = prize("Grand Prize", 1, 10_000_000);
    const door = prize("Door Prize", 1);
    winners.draw(door.id);
    minutesLater(2);
    const g = winners.draw(grand.id);
    minutesLater(1);
    if (g.kind === "ok") winners.cancel(g.winner.id);
    expect(winners.exportRows()).toEqual([
      {
        prizeName: "Grand Prize",
        prizeValue: 10_000_000,
        participantName: "Rina",
        participantEmail: "rina@x.example",
        drawnAt: "2026-11-08T13:02:00.000Z",
        cancelledAt: "2026-11-08T13:03:00.000Z",
        status: "cancelled",
      },
      {
        prizeName: "Door Prize",
        prizeValue: null,
        participantName: "Rina",
        participantEmail: "rina@x.example",
        drawnAt: "2026-11-08T13:00:00.000Z",
        cancelledAt: null,
        status: "valid",
      },
    ]);
  });
});
