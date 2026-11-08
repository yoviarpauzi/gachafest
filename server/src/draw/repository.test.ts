import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { openDatabase } from "../db/database";
import { migrate } from "../db/migrate";
import { createParticipantsRepository } from "../participants/repository";
import { createPrizesRepository } from "../prizes/repository";
import { createWinnersRepository } from "../winners/repository";
import { ANIMATION_MS, createDrawRepository } from "./repository";

// One queued `random` serves the winners repository (who is picked) and the draw repository (the reel
// sample), so a call count spans both. `failOnCall` makes the nth call throw.
function setup() {
  const db = openDatabase(":memory:");
  migrate(db, join(import.meta.dir, "../../migrations"));
  const clock = { at: Date.parse("2026-11-08T13:00:00.000Z") };
  const rnd = { picks: [] as number[], calls: 0, failOnCall: 0 };
  const random = (max: number) => {
    rnd.calls += 1;
    if (rnd.failOnCall === rnd.calls) throw new Error("random failed");
    return Math.min(rnd.picks.shift() ?? 0, max - 1);
  };
  const now = () => new Date(clock.at);
  const winners = createWinnersRepository(db, { random, now });
  const participants = createParticipantsRepository(db);
  const prizes = createPrizesRepository(db);
  const draw = createDrawRepository(db, { winners, prizes, random, now });
  const guests = (...names: string[]) =>
    names.map((name) => participants.insert({ name, email: `${name.toLowerCase().replace(/\W+/g, ".")}@x.example` })!);
  const prize = (name: string, quota: number, tier: "basic" | "premium" = "basic") =>
    prizes.insert({ name, winners: quota, tier, value: 1_000_000 });
  const reel = () =>
    JSON.parse((db.query("SELECT reel FROM draw_state").get() as { reel: string }).reel) as string[];
  const row = () => db.query("SELECT * FROM draw_state").get() as Record<string, unknown>;
  return { db, clock, rnd, winners, participants, prizes, draw, guests, prize, reel, row };
}

describe("draw_state table", () => {
  test("has exactly one row, idle, and refuses anything else", () => {
    const { db, row } = setup();
    expect(row()).toMatchObject({ id: 1, phase: "idle", selected_prize_id: null, winner_id: null, skipped: 0 });
    expect(() => db.run("INSERT INTO draw_state (id) VALUES (2)")).toThrow(/CHECK constraint failed/);
    expect(() => db.run("UPDATE draw_state SET phase = 'bogus'")).toThrow(/CHECK constraint failed/);
    expect(() => db.run("UPDATE draw_state SET skipped = 2")).toThrow(/CHECK constraint failed/);
  });

  test("deleting the selected prize clears the selection", () => {
    const { prizes, draw, prize, row } = setup();
    prize("Grand Prize", 1);
    const second = prize("Second Prize", 1);
    draw.select(second.id);
    expect(row().selected_prize_id).toBe(second.id);
    prizes.remove(second.id);
    expect(row().selected_prize_id).toBeNull();
  });
});

describe("state", () => {
  test("a fresh database is idle with the first prize active and every enabled guest eligible", () => {
    const { draw, guests, prize, participants } = setup();
    const [rina] = guests("Rina", "Budi", "Maya");
    participants.update(rina!.id, { disabled: true });
    const grand = prize("Grand Prize", 2, "premium");
    prize("Second Prize", 1);
    const state = draw.state();
    expect(state).toMatchObject({
      now: "2026-11-08T13:00:00.000Z",
      phase: "idle",
      eligibleCount: 2,
      reveal: null,
      activePrize: { id: grand.id, name: "Grand Prize", winners: 2, drawn: 0, tier: "premium", position: 1, total: 2 },
    });
  });

  test("with no prizes there is no active prize and no eligible count", () => {
    const { draw, guests } = setup();
    guests("Rina");
    expect(draw.state()).toMatchObject({ phase: "idle", activePrize: null, eligibleCount: null, reveal: null });
  });
});

describe("draw", () => {
  test("goes from idle to reveal with the winner, the prize and the animation time", () => {
    const { draw, guests, prize, rnd } = setup();
    guests("Rina", "Budi", "Maya");
    const grand = prize("Grand Prize", 2, "premium");
    rnd.picks.push(1);
    const result = draw.draw();
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.state.phase).toBe("reveal");
    expect(result.state.reveal).toMatchObject({
      winner: { participantName: "Budi", prizeName: "Grand Prize", status: "valid" },
      prize: { id: grand.id, drawn: 1, winners: 2, tier: "premium", position: 1, total: 1 },
      revealedAt: "2026-11-08T13:00:00.000Z",
      animationEndsAt: "2026-11-08T13:00:08.000Z",
      skipped: false,
    });
    expect(draw.state()).toEqual(result.state);
  });

  test("a basic prize is shown for 4 seconds, a premium one for 8", () => {
    expect(ANIMATION_MS).toEqual({ premium: 8000, basic: 4000 });
    const { draw, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Door Prize", 2, "basic");
    const result = draw.draw();
    expect(result.kind === "ok" && result.state.reveal?.animationEndsAt).toBe("2026-11-08T13:00:04.000Z");
  });

  test("a second draw while a winner is on screen is refused and creates no winner", () => {
    const { draw, winners, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 2);
    expect(draw.draw().kind).toBe("ok");
    expect(draw.draw()).toEqual({ kind: "reveal_pending" });
    expect(winners.list().draws).toBe(1);
  });

  test("answers no_open_prize when every prize has all its winners", () => {
    const { draw, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 1);
    draw.draw();
    draw.done();
    expect(draw.draw()).toEqual({ kind: "no_open_prize" });
  });

  test("passes no_eligible through and leaves the phase and the winners alone", () => {
    const { draw, winners, prize, guests, participants } = setup();
    const [rina] = guests("Rina");
    participants.update(rina!.id, { disabled: true });
    prize("Grand Prize", 1);
    expect(draw.draw()).toEqual({ kind: "no_eligible" });
    expect(draw.state().phase).toBe("idle");
    expect(winners.list().draws).toBe(0);
  });

  test("is atomic: a failure after the winner is saved leaves no winner and no change of state", () => {
    const { draw, winners, guests, prize, rnd, row } = setup();
    guests("Rina", "Budi", "Maya");
    prize("Grand Prize", 1);
    const before = row();
    rnd.failOnCall = 2; // the first call picks the winner, the second samples the reel
    expect(() => draw.draw()).toThrow("random failed");
    expect(winners.list().draws).toBe(0);
    expect(row()).toEqual(before);
    expect(draw.state().phase).toBe("idle");
  });

  test("the reel holds at most 50 names, none of them the winner, a disabled guest or someone with a row for the prize", () => {
    const { draw, winners, guests, participants, prize, reel } = setup();
    const all = guests(...Array.from({ length: 60 }, (_, i) => `Guest ${String(i + 1).padStart(2, "0")}`));
    for (const p of all.slice(57)) participants.update(p.id, { disabled: true }); // 58, 59, 60 off
    const grand = prize("Grand Prize", 2);
    const first = winners.draw(grand.id); // Guest 01, then cancelled: still excluded from the reel
    if (first.kind === "ok") winners.cancel(first.winner.id);

    const result = draw.draw();
    expect(result.kind).toBe("ok");
    const winner = result.kind === "ok" ? result.state.reveal!.winner.participantName : "";
    const names = reel();
    expect(names.length).toBeLessThanOrEqual(50);
    expect(names.length).toBe(50);
    expect(names).not.toContain(winner);
    expect(names).not.toContain("Guest 01");
    for (const off of ["Guest 58", "Guest 59", "Guest 60"]) expect(names).not.toContain(off);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => n.startsWith("Guest "))).toBe(true);
  });
});

describe("skip", () => {
  test("marks the animation skipped, and can be pressed again", () => {
    const { draw, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 2);
    draw.draw();
    const first = draw.skip();
    expect(first.kind === "ok" && first.state.reveal?.skipped).toBe(true);
    const again = draw.skip();
    expect(again.kind === "ok" && again.state.reveal?.skipped).toBe(true);
  });

  test("is not_revealing outside a reveal", () => {
    const { draw, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 2);
    expect(draw.skip()).toEqual({ kind: "not_revealing" });
    draw.draw();
    draw.done();
    expect(draw.skip()).toEqual({ kind: "not_revealing" });
  });
});

describe("done", () => {
  test("goes from reveal to standby and clears the reveal", () => {
    const { draw, guests, prize, row } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 2);
    draw.draw();
    const result = draw.done();
    expect(result.kind === "ok" && result.state.phase).toBe("standby");
    expect(result.kind === "ok" && result.state.reveal).toBeNull();
    expect(row()).toMatchObject({ phase: "standby", winner_id: null, revealed_at: null, skipped: 0, reel: null });
  });

  test("changes nothing from standby or from idle, so it can be pressed twice", () => {
    const { draw, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 2);
    const idle = draw.done();
    expect(idle.kind === "ok" && idle.state.phase).toBe("idle");
    draw.draw();
    draw.done();
    const again = draw.done();
    expect(again.kind === "ok" && again.state.phase).toBe("standby");
  });
});

describe("the active prize", () => {
  test("the next prize with a free slot becomes active after the last slot is filled and Done is pressed", () => {
    const { draw, guests, prize } = setup();
    guests("Rina", "Budi", "Maya", "Agus");
    const a = prize("Grand Prize", 1);
    const b = prize("Second Prize", 2);
    draw.draw();
    expect(draw.state().activePrize?.id).toBe(b.id); // already: Grand Prize is full
    expect(draw.state().reveal?.prize.id).toBe(a.id); // while the screen still shows Grand Prize's winner
    draw.done();
    draw.draw();
    draw.done();
    expect(draw.state().activePrize?.id).toBe(b.id); // one slot left
    draw.draw();
    draw.done();
    expect(draw.state().activePrize).toBeNull();
    expect(draw.state().eligibleCount).toBeNull();
  });

  test("select makes a prize active", () => {
    const { draw, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 1);
    const b = prize("Second Prize", 1);
    const result = draw.select(b.id);
    expect(result.kind === "ok" && result.state.activePrize?.id).toBe(b.id);
    const drawn = draw.draw();
    expect(drawn.kind === "ok" && drawn.state.reveal?.prize.id).toBe(b.id);
  });

  test("select is refused during a reveal, for a full prize, and for an unknown prize", () => {
    const { draw, guests, prize } = setup();
    guests("Rina", "Budi");
    const a = prize("Grand Prize", 1);
    const b = prize("Second Prize", 1);
    draw.draw(); // Grand Prize is now full and on screen
    expect(draw.select(b.id)).toEqual({ kind: "reveal_pending" });
    draw.done();
    expect(draw.select(a.id)).toEqual({ kind: "prize_full" });
    expect(draw.select(99)).toEqual({ kind: "prize_not_found" });
  });

  test("a selected prize that fills up, or is deleted, falls back to the first open prize", () => {
    const { draw, prizes, guests, prize } = setup();
    guests("Rina", "Budi", "Maya");
    const a = prize("Grand Prize", 2);
    const b = prize("Second Prize", 1);
    const c = prize("Third Prize", 1);
    draw.select(b.id);
    draw.draw();
    draw.done(); // Second Prize is full now
    expect(draw.state().activePrize?.id).toBe(a.id);
    draw.select(c.id);
    expect(draw.state().activePrize?.id).toBe(c.id);
    prizes.remove(c.id);
    expect(draw.state().activePrize?.id).toBe(a.id);
  });
});

describe("screen", () => {
  test("in idle it has the first prize, no reveal and no winners", () => {
    const { draw, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 1, "premium");
    prize("Second Prize", 1);
    expect(draw.screen()).toEqual({
      now: "2026-11-08T13:00:00.000Z",
      phase: "idle",
      prize: { name: "Grand Prize", value: 1_000_000, tier: "premium", position: 1, total: 2 },
      reveal: null,
      latest: [],
    });
  });

  test("during a reveal it has the winner, the stored reel and the animation times, and the winner's own prize", () => {
    const { draw, guests, prize, reel } = setup();
    guests("Rina", "Budi", "Maya");
    prize("Grand Prize", 1, "premium");
    prize("Second Prize", 1);
    draw.draw();
    const screen = draw.screen();
    expect(screen.phase).toBe("reveal");
    expect(screen.prize?.name).toBe("Grand Prize"); // the prize that was drawn, not the next one
    expect(screen.reveal).toEqual({
      winnerName: "Rina",
      reel: reel(),
      revealedAt: "2026-11-08T13:00:00.000Z",
      animationEndsAt: "2026-11-08T13:00:08.000Z",
      skipped: false,
    });
    expect(screen.latest).toEqual([]); // the winner on screen is kept out of the history
  });

  test("a skip shows in the reveal", () => {
    const { draw, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 2);
    draw.draw();
    draw.skip();
    expect(draw.screen().reveal?.skipped).toBe(true);
  });

  test("after Done the winner is in the history, the reveal is gone and the next prize is shown", () => {
    const { draw, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 1);
    prize("Second Prize", 1);
    draw.draw();
    draw.done();
    const screen = draw.screen();
    expect(screen.phase).toBe("standby");
    expect(screen.reveal).toBeNull();
    expect(screen.prize?.name).toBe("Second Prize");
    expect(screen.latest).toEqual([{ winnerName: "Rina", prizeName: "Grand Prize", prizeValue: 1_000_000 }]);
  });

  test("the history is at most 10 valid winners, newest first", () => {
    const { draw, winners, guests, prize, clock } = setup();
    guests(...Array.from({ length: 14 }, (_, i) => `Guest ${String(i + 1).padStart(2, "0")}`));
    prize("Grand Prize", 12);
    for (let i = 0; i < 12; i++) {
      clock.at += 60_000;
      draw.draw();
      draw.done();
    }
    // Guest 05's win is cancelled: it must not be listed.
    const cancelled = winners.list().items.find((w) => w.participantName === "Guest 05");
    winners.cancel(cancelled!.id);
    const names = draw.screen().latest.map((w) => w.winnerName);
    expect(names).toEqual(["Guest 12", "Guest 11", "Guest 10", "Guest 09", "Guest 08", "Guest 07", "Guest 06", "Guest 04", "Guest 03", "Guest 02"]);
  });

  test("never contains an email or an id, keeps the reel to 50 names, and names the winner once while revealing", () => {
    const { draw, guests, prize } = setup();
    guests(...Array.from({ length: 60 }, (_, i) => `Guest ${String(i + 1).padStart(2, "0")}`));
    prize("Grand Prize", 2);
    expect(JSON.stringify(draw.screen())).not.toContain("Guest"); // idle: no name at all
    draw.draw();
    const screen = draw.screen();
    const json = JSON.stringify(screen);
    expect(json).not.toContain("@");
    expect(json).not.toMatch(/"(id|email|participantId|winnerId|prizeId)"/);
    expect(screen.reveal!.reel.length).toBeLessThanOrEqual(50);
    expect(json.split(`"${screen.reveal!.winnerName}"`).length - 1).toBe(1); // only in reveal.winnerName
    draw.done();
    expect(JSON.stringify(draw.screen())).not.toMatch(/"reveal":\{/); // reveal is null again
  });
});
