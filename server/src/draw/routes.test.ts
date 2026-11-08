import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Elysia } from "elysia";
import { createAdminRoutes } from "../auth/guard";
import { SESSION_TTL_MS, signSession } from "../auth/session";
import { openDatabase } from "../db/database";
import { migrate } from "../db/migrate";
import { createParticipantsRepository } from "../participants/repository";
import { createPrizesRepository } from "../prizes/repository";
import { createWinnersRepository } from "../winners/repository";
import { createScreenPresence } from "./presence";
import { createDrawRepository } from "./repository";
import { createDrawRoutes } from "./routes";
import { createScreenRoutes } from "./screen";

const secret = "p".repeat(32);

function setup() {
  const sessionNow = 1_000_000;
  const db = openDatabase(":memory:");
  migrate(db, join(import.meta.dir, "../../migrations"));
  const picks: number[] = [];
  const random = (max: number) => Math.min(picks.shift() ?? 0, max - 1);
  const now = () => new Date("2026-11-08T13:00:00.000Z");
  const winners = createWinnersRepository(db, { random, now });
  const participants = createParticipantsRepository(db);
  const prizes = createPrizesRepository(db);
  const repo = createDrawRepository(db, { winners, prizes, random, now });
  const presenceClock = { at: 5_000_000 };
  const presence = createScreenPresence(() => presenceClock.at);
  const app = new Elysia()
    .use(
      createAdminRoutes({ sessionSecret: secret, now: () => sessionNow }).use(
        createDrawRoutes({ repo, presence }),
      ),
    )
    .use(createScreenRoutes({ repo, presence }));
  const cookie = `session=${encodeURIComponent(signSession(sessionNow + SESSION_TTL_MS, secret))}`;
  const guests = (...names: string[]) =>
    names.map((name) => participants.insert({ name, email: `${name.toLowerCase()}@x.example` })!);
  const prize = (name: string, quota: number, tier: "basic" | "premium" = "basic") =>
    prizes.insert({ name, winners: quota, tier, value: 1_000_000 });
  return { app, repo, winners, participants, presence, presenceClock, cookie, picks, guests, prize };
}

type App = ReturnType<typeof setup>["app"];

const call = (
  app: App,
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown; rawBody?: string } = {},
) =>
  app.handle(
    new Request(`http://localhost/api/admin/draw${path}`, {
      method,
      headers: {
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
        ...(opts.body !== undefined || opts.rawBody !== undefined
          ? { "content-type": "application/json" }
          : {}),
      },
      body: opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    }),
  );

const json = async (res: Response) => (await res.json()) as Record<string, any>;

describe("GET /api/admin/draw", () => {
  test("answers the state, with whether the big screen is open", async () => {
    const { app, cookie, guests, prize, presence, presenceClock } = setup();
    guests("Rina", "Budi");
    const grand = prize("Grand Prize", 1, "premium");
    const res = await call(app, "GET", "", { cookie });
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({
      now: "2026-11-08T13:00:00.000Z",
      phase: "idle",
      activePrize: { id: grand.id, name: "Grand Prize", position: 1, total: 1 },
      eligibleCount: 2,
      reveal: null,
      screenOpen: false,
    });
    presence.seen();
    expect((await json(await call(app, "GET", "", { cookie }))).screenOpen).toBe(true);
    presenceClock.at += 16_000;
    expect((await json(await call(app, "GET", "", { cookie }))).screenOpen).toBe(false);
  });
});

describe("POST /api/admin/draw/select", () => {
  test("makes a prize active and answers the state", async () => {
    const { app, cookie, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 1);
    const second = prize("Second Prize", 1);
    const res = await call(app, "POST", "/select", { cookie, body: { prizeId: second.id } });
    expect(res.status).toBe(200);
    expect((await json(res)).activePrize.id).toBe(second.id);
  });

  test("answers 404 for an unknown prize, 409 prize_full for a full one, 409 reveal_pending during a reveal", async () => {
    const { app, cookie, guests, prize } = setup();
    guests("Rina", "Budi", "Maya");
    const grand = prize("Grand Prize", 1);
    const second = prize("Second Prize", 1);
    const missing = await call(app, "POST", "/select", { cookie, body: { prizeId: 99 } });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "not_found" });

    await call(app, "POST", "", { cookie }); // Grand Prize is drawn and on screen
    const pending = await call(app, "POST", "/select", { cookie, body: { prizeId: second.id } });
    expect(pending.status).toBe(409);
    expect(await pending.json()).toEqual({ error: "reveal_pending" });

    await call(app, "POST", "/done", { cookie });
    const full = await call(app, "POST", "/select", { cookie, body: { prizeId: grand.id } });
    expect(full.status).toBe(409);
    expect(await full.json()).toEqual({ error: "prize_full" });
  });

  test("answers 422 for a bad body", async () => {
    const { app, cookie } = setup();
    for (const body of [{}, { prizeId: 0 }, { prizeId: -1 }, { prizeId: 1.5 }, { prizeId: "1" }]) {
      const res = await call(app, "POST", "/select", { cookie, body });
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "invalid_input" });
    }
  });
});

describe("POST /api/admin/draw", () => {
  test("draws a winner, answers 201 with the reveal, and refuses a second draw until Done", async () => {
    const { app, cookie, guests, prize, picks } = setup();
    guests("Rina", "Budi", "Maya");
    prize("Grand Prize", 2, "premium");
    picks.push(1);
    const res = await call(app, "POST", "", { cookie });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.phase).toBe("reveal");
    expect(body.reveal).toMatchObject({
      winner: { participantName: "Budi" },
      prize: { name: "Grand Prize", drawn: 1 },
      animationEndsAt: "2026-11-08T13:00:08.000Z",
      skipped: false,
    });
    const again = await call(app, "POST", "", { cookie });
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "reveal_pending" });
  });

  test("answers 409 no_open_prize when every prize is full", async () => {
    const { app, cookie, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 1);
    await call(app, "POST", "", { cookie });
    await call(app, "POST", "/done", { cookie });
    const res = await call(app, "POST", "", { cookie });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "no_open_prize" });
  });

  test("answers 409 no_eligible and leaves the state as it was", async () => {
    const { app, cookie, guests, prize, participants } = setup();
    const [rina] = guests("Rina");
    participants.update(rina!.id, { disabled: true });
    prize("Grand Prize", 1);
    const res = await call(app, "POST", "", { cookie });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "no_eligible" });
    const state = await json(await call(app, "GET", "", { cookie }));
    expect(state).toMatchObject({ phase: "idle", reveal: null, eligibleCount: 0 });
  });
});

describe("POST /api/admin/draw/skip and /done", () => {
  test("skip answers 200 during a reveal, again 200, and 409 not_revealing otherwise", async () => {
    const { app, cookie, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 2);
    const early = await call(app, "POST", "/skip", { cookie });
    expect(early.status).toBe(409);
    expect(await early.json()).toEqual({ error: "not_revealing" });
    await call(app, "POST", "", { cookie });
    expect((await json(await call(app, "POST", "/skip", { cookie }))).reveal.skipped).toBe(true);
    expect((await json(await call(app, "POST", "/skip", { cookie }))).reveal.skipped).toBe(true);
  });

  test("done answers 200 and can be pressed twice", async () => {
    const { app, cookie, guests, prize } = setup();
    guests("Rina", "Budi");
    prize("Grand Prize", 2);
    await call(app, "POST", "", { cookie });
    expect((await json(await call(app, "POST", "/done", { cookie }))).phase).toBe("standby");
    expect((await json(await call(app, "POST", "/done", { cookie }))).phase).toBe("standby");
  });
});

describe("authentication", () => {
  test("every admin route answers 401 without a session, even with a malformed body, and changes nothing", async () => {
    const { app, repo, guests, prize } = setup();
    guests("Rina", "Budi");
    const grand = prize("Grand Prize", 1);
    const before = repo.state();

    expect((await call(app, "GET", "")).status).toBe(401);
    expect((await call(app, "POST", "/select", { body: { prizeId: grand.id } })).status).toBe(401);
    expect((await call(app, "POST", "/select", { body: {} })).status).toBe(401);
    expect((await call(app, "POST", "/select", { rawBody: "{not json" })).status).toBe(401);
    expect((await call(app, "POST", "")).status).toBe(401);
    expect((await call(app, "POST", "/skip")).status).toBe(401);
    expect((await call(app, "POST", "/done")).status).toBe(401);

    expect(repo.state()).toEqual(before);
  });
});
