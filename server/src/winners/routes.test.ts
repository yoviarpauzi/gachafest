import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Elysia } from "elysia";
import { createAdminRoutes } from "../auth/guard";
import { SESSION_TTL_MS, signSession } from "../auth/session";
import { openDatabase } from "../db/database";
import { migrate } from "../db/migrate";
import { createParticipantsRepository } from "../participants/repository";
import { createPrizesRepository } from "../prizes/repository";
import { createWinnersRepository } from "./repository";
import { createWinnersRoutes } from "./routes";

const secret = "p".repeat(32);

function setup() {
  const now = 1_000_000;
  const db = openDatabase(":memory:");
  migrate(db, join(import.meta.dir, "../../migrations"));
  const picks: number[] = [];
  const repo = createWinnersRepository(db, {
    random: () => picks.shift() ?? 0,
    now: () => new Date("2026-11-08T13:00:00.000Z"),
  });
  const participants = createParticipantsRepository(db);
  const prizes = createPrizesRepository(db);
  const app = new Elysia().use(
    createAdminRoutes({ sessionSecret: secret, now: () => now }).use(createWinnersRoutes({ repo })),
  );
  const cookie = `session=${encodeURIComponent(signSession(now + SESSION_TTL_MS, secret))}`;
  const guests = (...names: string[]) =>
    names.map((name) => participants.insert({ name, email: `${name.toLowerCase()}@x.example` })!);
  const prize = (name: string, quota: number, value: number | null = null) =>
    prizes.insert({ name, winners: quota, tier: "basic", value });
  return { app, repo, cookie, picks, guests, prize, db };
}

type App = ReturnType<typeof setup>["app"];

const call = (
  app: App,
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown; rawBody?: string } = {},
) =>
  app.handle(
    new Request(`http://localhost/api/admin/winners${path}`, {
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

describe("GET /api/admin/winners", () => {
  test("is empty when nothing has been drawn", async () => {
    const { app, cookie } = setup();
    const res = await call(app, "GET", "", { cookie });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], draws: 0, cancelled: 0 });
  });
});

describe("POST /api/admin/winners", () => {
  test("draws a winner for the prize, answers 201 with it, and lists it", async () => {
    const { app, cookie, guests, prize, picks } = setup();
    guests("Rina", "Budi", "Maya");
    const grand = prize("Grand Prize", 1);
    picks.push(2);
    const res = await call(app, "POST", "", { cookie, body: { prizeId: grand.id } });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      prizeId: grand.id,
      prizeName: "Grand Prize",
      participantName: "Maya",
      status: "valid",
      cancelledAt: null,
    });
    const list = (await (await call(app, "GET", "", { cookie })).json()) as {
      items: { participantName: string }[];
      draws: number;
    };
    expect(list.items.map((w) => w.participantName)).toEqual(["Maya"]);
    expect(list.draws).toBe(1);
  });

  test("answers 404 not_found for an unknown prize", async () => {
    const { app, cookie } = setup();
    const res = await call(app, "POST", "", { cookie, body: { prizeId: 99 } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  test("answers 409 prize_full once the quota is met", async () => {
    const { app, cookie, guests, prize } = setup();
    guests("Rina", "Budi");
    const grand = prize("Grand Prize", 1);
    expect((await call(app, "POST", "", { cookie, body: { prizeId: grand.id } })).status).toBe(201);
    const res = await call(app, "POST", "", { cookie, body: { prizeId: grand.id } });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "prize_full" });
  });

  test("answers 409 no_eligible when nobody is left to draw", async () => {
    const { app, cookie, guests, prize } = setup();
    guests("Rina");
    const second = prize("Second Prize", 2);
    expect((await call(app, "POST", "", { cookie, body: { prizeId: second.id } })).status).toBe(201);
    const res = await call(app, "POST", "", { cookie, body: { prizeId: second.id } });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "no_eligible" });
  });

  test("answers 422 invalid_input for a bad body and records nothing", async () => {
    const { app, repo, cookie, guests, prize } = setup();
    guests("Rina");
    prize("Grand Prize", 1);
    for (const body of [{}, { prizeId: 0 }, { prizeId: -1 }, { prizeId: 1.5 }, { prizeId: "1" }]) {
      const res = await call(app, "POST", "", { cookie, body });
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "invalid_input" });
    }
    expect(repo.list().draws).toBe(0);
  });
});

describe("POST /api/admin/winners/:id/cancel", () => {
  test("cancels once, answers the cancelled row, then 409 already_cancelled", async () => {
    const { app, cookie, guests, prize } = setup();
    guests("Rina");
    const grand = prize("Grand Prize", 1);
    const drawn = (await (await call(app, "POST", "", { cookie, body: { prizeId: grand.id } })).json()) as {
      id: number;
    };
    const res = await call(app, "POST", `/${drawn.id}/cancel`, { cookie });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: drawn.id,
      status: "cancelled",
      cancelledAt: "2026-11-08T13:00:00.000Z",
      prizeHasFreeSlot: true,
    });
    const again = await call(app, "POST", `/${drawn.id}/cancel`, { cookie });
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "already_cancelled" });
    const list = (await (await call(app, "GET", "", { cookie })).json()) as {
      draws: number;
      cancelled: number;
    };
    expect({ draws: list.draws, cancelled: list.cancelled }).toEqual({ draws: 1, cancelled: 1 });
  });

  test("answers 404 for an unknown id and 422 for a bad one", async () => {
    const { app, cookie } = setup();
    const missing = await call(app, "POST", "/99/cancel", { cookie });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "not_found" });
    for (const id of ["abc", "0", "-1", "1.5"]) {
      expect((await call(app, "POST", `/${id}/cancel`, { cookie })).status).toBe(422);
    }
  });
});

describe("GET /api/admin/winners/export.csv", () => {
  test("downloads the winners as CSV and neutralises a name that starts like a formula", async () => {
    const { app, cookie, guests, prize } = setup();
    guests("=cmd", "Budi");
    const grand = prize("Grand Prize", 2, 10_000_000);
    await call(app, "POST", "", { cookie, body: { prizeId: grand.id } });
    await call(app, "POST", "", { cookie, body: { prizeId: grand.id } });
    const res = await call(app, "GET", "/export.csv", { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="winners.csv"');
    // `res.text()` would drop the byte order mark, so read the bytes and decode them without removing it.
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    const lines = text.slice(1).split("\r\n");
    expect(lines[0]).toBe('"Prize","Value","Winner","Email","Drawn at","Status","Cancelled at"');
    // The name and the email both start with "=", so both get the quote in front.
    expect(lines[1]).toBe(
      `"Grand Prize","10000000","'=cmd","'=cmd@x.example","2026-11-08T13:00:00.000Z","Valid",""`,
    );
    expect(lines[2]).toContain('"Budi"');
  });
});

describe("authentication", () => {
  test("every route answers 401 without a session, with no data, and changes nothing", async () => {
    const { app, repo, guests, prize } = setup();
    guests("Rina");
    const grand = prize("Grand Prize", 1);
    repo.draw(grand.id);
    const before = repo.list();

    expect((await call(app, "GET", "")).status).toBe(401);
    expect((await call(app, "POST", "", { body: { prizeId: grand.id } })).status).toBe(401);
    expect((await call(app, "POST", "", { body: {} })).status).toBe(401);
    expect((await call(app, "POST", "", { rawBody: "{not json" })).status).toBe(401);
    expect((await call(app, "POST", "/1/cancel")).status).toBe(401);
    expect((await call(app, "POST", "/abc/cancel")).status).toBe(401);
    const csv = await call(app, "GET", "/export.csv");
    expect(csv.status).toBe(401);
    const body = await csv.text();
    expect(body).not.toContain("Grand Prize");
    expect(body).not.toContain("Rina");
    expect(body).not.toContain('"Prize"');

    expect(repo.list()).toEqual(before);
  });
});

describe("DELETE /api/admin/winners/:id", () => {
  const withOneWinner = () => {
    const ctx = setup();
    ctx.guests("Rina", "Budi");
    const door = ctx.prize("Door Prize", 1);
    const drawn = ctx.repo.draw(door.id);
    if (drawn.kind !== "ok") throw new Error("no winner");
    return { ...ctx, door, winner: drawn.winner };
  };

  test("deletes the winner, answers 204 with no body, and the person is eligible for the prize again", async () => {
    const { app, repo, cookie, door, winner } = withOneWinner();
    const res = await call(app, "DELETE", `/${winner.id}`, { cookie });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(repo.list().items).toEqual([]);
    expect(repo.eligible(door.id).map((p) => p.name)).toEqual(["Rina", "Budi"]);
  });

  test("deletes a cancelled winner as well", async () => {
    const { app, repo, cookie, winner } = withOneWinner();
    await call(app, "POST", `/${winner.id}/cancel`, { cookie });
    expect((await call(app, "DELETE", `/${winner.id}`, { cookie })).status).toBe(204);
    expect(repo.list().items).toEqual([]);
  });

  test("answers 404 once it is gone", async () => {
    const { app, cookie, winner } = withOneWinner();
    await call(app, "DELETE", `/${winner.id}`, { cookie });
    const again = await call(app, "DELETE", `/${winner.id}`, { cookie });
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: "not_found" });
  });

  test("answers 409 on_screen for the winner shown on the big screen, and keeps the row", async () => {
    const { app, repo, cookie, db, winner } = withOneWinner();
    db.run("UPDATE draw_state SET phase = 'reveal', winner_id = ?, revealed_at = 't' WHERE id = 1", [winner.id]);
    const res = await call(app, "DELETE", `/${winner.id}`, { cookie });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "on_screen" });
    expect(repo.list().items).toHaveLength(1);
  });

  test("answers 422 for a non-numeric, zero or negative id", async () => {
    const { app, cookie } = withOneWinner();
    for (const id of ["abc", "0", "-1", "1.5"]) {
      expect((await call(app, "DELETE", `/${id}`, { cookie })).status).toBe(422);
    }
  });

  test("answers 401 without a session, even for a bad id, and deletes nothing", async () => {
    const { app, repo, winner } = withOneWinner();
    expect((await call(app, "DELETE", `/${winner.id}`)).status).toBe(401);
    expect((await call(app, "DELETE", "/abc")).status).toBe(401);
    expect(repo.list().items).toHaveLength(1);
  });
});
