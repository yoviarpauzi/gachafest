import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Elysia } from "elysia";
import { openDatabase } from "../db/database";
import { migrate } from "../db/migrate";
import { createParticipantsRepository } from "../participants/repository";
import { createPrizesRepository } from "../prizes/repository";
import { createWinnersRepository } from "../winners/repository";
import { createScreenPresence } from "./presence";
import { createDrawRepository } from "./repository";
import { createScreenRoutes } from "./screen";

function setup() {
  const db = openDatabase(":memory:");
  migrate(db, join(import.meta.dir, "../../migrations"));
  const random = (max: number) => Math.min(0, max - 1);
  const now = () => new Date("2026-11-08T13:00:00.000Z");
  const winners = createWinnersRepository(db, { random, now });
  const participants = createParticipantsRepository(db);
  const prizes = createPrizesRepository(db);
  const repo = createDrawRepository(db, { winners, prizes, random, now });
  const clock = { at: 5_000_000 };
  const presence = createScreenPresence(() => clock.at);
  // No admin guard here: the screen route is mounted outside it, as in the real app.
  const app = new Elysia().use(createScreenRoutes({ repo, presence }));
  const guests = (...names: string[]) =>
    names.map((name) => participants.insert({ name, email: `${name.toLowerCase()}@x.example` })!);
  const prize = (name: string, quota: number) => prizes.insert({ name, winners: quota, tier: "basic", value: 500_000 });
  const snapshot = () => ({
    state: db.query("SELECT * FROM draw_state").all(),
    participants: db.query("SELECT COUNT(*) AS n FROM participants").get(),
    prizes: db.query("SELECT COUNT(*) AS n FROM prizes").get(),
    winners: db.query("SELECT COUNT(*) AS n FROM winners").get(),
  });
  return { app, repo, presence, clock, guests, prize, snapshot };
}

const get = (app: ReturnType<typeof setup>["app"], path = "", method = "GET") =>
  app.handle(new Request(`http://localhost/api/screen${path}`, { method }));

describe("GET /api/screen", () => {
  test("answers without a session, with the screen state and nothing else", async () => {
    const { app, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 1);
    const res = await get(app);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["latest", "now", "phase", "prize", "reveal"]);
    expect(body.phase).toBe("idle");
  });

  test("during a reveal it names the winner and leaks neither an email nor an id", async () => {
    const { app, repo, guests, prize } = setup();
    guests("Rina", "Budi", "Maya");
    prize("Grand Prize", 1);
    repo.draw();
    const text = await (await get(app)).text();
    expect(text).toContain('"winnerName":"Rina"');
    expect(text).not.toContain("@");
    expect(text).not.toMatch(/"(id|email|participantId|winnerId|prizeId)"/);
    const body = JSON.parse(text) as { reveal: { reel: string[] } };
    expect(body.reveal.reel.length).toBeLessThanOrEqual(50);
  });

  test("is read-only: no other method or path under /api/screen does anything", async () => {
    const { app } = setup();
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect((await get(app, "", method)).status).not.toBe(200);
    }
    expect((await get(app, "/anything")).status).not.toBe(200);
    expect((await get(app, "/heartbeat", "POST")).status).not.toBe(200);
  });

  test("writes nothing to the database", async () => {
    const { app, repo, guests, prize, snapshot } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 1);
    repo.draw();
    const before = snapshot();
    await get(app);
    await get(app);
    expect(snapshot()).toEqual(before);
  });

  test("marks the big screen open for 15 seconds", async () => {
    const { app, presence, clock } = setup();
    expect(presence.isOpen()).toBe(false);
    await get(app);
    expect(presence.isOpen()).toBe(true);
    clock.at += 15_001;
    expect(presence.isOpen()).toBe(false);
  });
});
