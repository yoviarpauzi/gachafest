import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Elysia } from "elysia";
import { createAdminRoutes } from "../auth/guard";
import { SESSION_TTL_MS, signSession } from "../auth/session";
import { openDatabase } from "../db/database";
import { migrate } from "../db/migrate";
import { createPrizesRepository } from "./repository";
import { createPrizesRoutes } from "./routes";

const secret = "p".repeat(32);

function setup() {
  const now = 1_000_000;
  const db = openDatabase(":memory:");
  migrate(db, join(import.meta.dir, "../../migrations"));
  const repo = createPrizesRepository(db);
  const app = new Elysia().use(
    createAdminRoutes({ sessionSecret: secret, now: () => now }).use(createPrizesRoutes({ repo })),
  );
  const cookie = `session=${encodeURIComponent(signSession(now + SESSION_TTL_MS, secret))}`;
  return { app, repo, cookie, db };
}

type App = ReturnType<typeof setup>["app"];

const call = (
  app: App,
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown; rawBody?: string } = {},
) =>
  app.handle(
    new Request(`http://localhost/api/admin/prizes${path}`, {
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

const valid = { name: "Grand Prize", winners: 1 };

function threePrizes() {
  const ctx = setup();
  ctx.repo.insert({ name: "Grand Prize", value: 10_000_000, winners: 1, tier: "premium" });
  ctx.repo.insert({ name: "Second Prize", winners: 2, tier: "basic" });
  ctx.repo.insert({ name: "Door Prize", winners: 5, tier: "basic" });
  return ctx;
}

const order = (repo: ReturnType<typeof setup>["repo"]) => repo.list().map((p) => p.id);

describe("GET /api/admin/prizes", () => {
  test("is empty when there are no prizes", async () => {
    const { app, cookie } = setup();
    const res = await call(app, "GET", "", { cookie });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });

  test("lists the prizes in draw order", async () => {
    const { app, repo, cookie } = threePrizes();
    repo.reorder([3, 1, 2]);
    const res = await call(app, "GET", "", { cookie });
    const body = (await res.json()) as { items: { id: number; drawn: number }[] };
    expect(body.items.map((p) => p.id)).toEqual([3, 1, 2]);
    expect(body.items.every((p) => p.drawn === 0)).toBe(true);
  });
});

describe("POST /api/admin/prizes", () => {
  test("creates a prize with a trimmed name and answers 201 with it", async () => {
    const { app, repo, cookie } = setup();
    const res = await call(app, "POST", "", {
      cookie,
      body: { name: "  Grand Prize ", value: 10_000_000, winners: 1, tier: "premium" },
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: 1,
      name: "Grand Prize",
      value: 10_000_000,
      winners: 1,
      tier: "premium",
      drawn: 0,
    });
    await call(app, "POST", "", { cookie, body: { name: "Second Prize", winners: 2 } });
    expect(repo.list().map((p) => p.name)).toEqual(["Grand Prize", "Second Prize"]);
  });

  test("a prize without a tier or value is basic with no value", async () => {
    const { app, cookie } = setup();
    const res = await call(app, "POST", "", { cookie, body: valid });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ tier: "basic", value: null });
  });

  test("accepts a null value and the largest allowed value and winners", async () => {
    const { app, cookie } = setup();
    const res = await call(app, "POST", "", {
      cookie,
      body: { name: "x".repeat(60), value: 1_000_000_000_000, winners: 1000 },
    });
    expect(res.status).toBe(201);
    expect((await call(app, "POST", "", { cookie, body: { ...valid, value: null } })).status).toBe(201);
  });

  test("answers 422 invalid_input for a bad body and stores nothing", async () => {
    const { app, repo, cookie } = setup();
    const bodies: unknown[] = [
      {},
      { winners: 1 },
      { name: "Grand Prize" },
      { ...valid, name: "" },
      { ...valid, name: "   " },
      { ...valid, name: "x".repeat(61) },
      { ...valid, winners: 0 },
      { ...valid, winners: 1001 },
      { ...valid, winners: 1.5 },
      { ...valid, winners: "2" },
      { ...valid, value: 0 },
      { ...valid, value: -1 },
      { ...valid, value: 1_000_000_000_001 },
      { ...valid, value: "5" },
      { ...valid, value: 2.5 },
      { ...valid, tier: "gold" },
    ];
    for (const body of bodies) {
      const res = await call(app, "POST", "", { cookie, body });
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "invalid_input" });
    }
    expect(repo.list()).toEqual([]);
  });
});

describe("PATCH /api/admin/prizes/:id", () => {
  test("changes one field and returns the prize", async () => {
    const { app, cookie } = threePrizes();
    const res = await call(app, "PATCH", "/2", { cookie, body: { winners: 4 } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 2,
      name: "Second Prize",
      value: null,
      winners: 4,
      tier: "basic",
      drawn: 0,
    });
  });

  test("clears the value with null and sets all four fields in one request", async () => {
    const { app, cookie } = threePrizes();
    const cleared = await call(app, "PATCH", "/1", { cookie, body: { value: null } });
    expect(((await cleared.json()) as { value: number | null }).value).toBe(null);
    const all = await call(app, "PATCH", "/1", {
      cookie,
      body: { name: " Mega ", value: 2_000_000, winners: 3, tier: "basic" },
    });
    expect(await all.json()).toMatchObject({ name: "Mega", value: 2_000_000, winners: 3, tier: "basic" });
  });

  test("ignores an id or a position in the body", async () => {
    const { app, repo, cookie } = threePrizes();
    const res = await call(app, "PATCH", "/1", {
      cookie,
      body: { id: 3, position: 99, name: "Renamed" },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { id: number }).id).toBe(1);
    expect(order(repo)).toEqual([1, 2, 3]);
  });

  test("answers 404 not_found for an unknown id", async () => {
    const { app, cookie } = threePrizes();
    const res = await call(app, "PATCH", "/99", { cookie, body: { winners: 2 } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  test("answers 422 for an empty patch, a bad field or a non-numeric id, changing nothing", async () => {
    const { app, repo, cookie } = threePrizes();
    const before = repo.list();
    for (const body of [{}, { name: "" }, { winners: 0 }, { value: 0 }, { tier: "gold" }]) {
      expect((await call(app, "PATCH", "/1", { cookie, body })).status).toBe(422);
    }
    expect((await call(app, "PATCH", "/abc", { cookie, body: { winners: 2 } })).status).toBe(422);
    expect(repo.list()).toEqual(before);
  });
});

describe("DELETE /api/admin/prizes/:id", () => {
  test("deletes the prize and answers 204 with no body", async () => {
    const { app, repo, cookie } = threePrizes();
    const res = await call(app, "DELETE", "/2", { cookie });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(order(repo)).toEqual([1, 3]);
  });

  test("answers 404 once it is gone", async () => {
    const { app, cookie } = threePrizes();
    await call(app, "DELETE", "/2", { cookie });
    const again = await call(app, "DELETE", "/2", { cookie });
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: "not_found" });
  });

  test("answers 422 for a non-numeric, zero or negative id", async () => {
    const { app, cookie } = threePrizes();
    for (const id of ["abc", "0", "-1", "1.5"]) {
      expect((await call(app, "DELETE", `/${id}`, { cookie })).status).toBe(422);
    }
  });
});

describe("PUT /api/admin/prizes/order", () => {
  test("saves the new order and answers 204", async () => {
    const { app, repo, cookie } = threePrizes();
    const res = await call(app, "PUT", "/order", { cookie, body: { ids: [3, 1, 2] } });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(order(repo)).toEqual([3, 1, 2]);
    const listed = (await (await call(app, "GET", "", { cookie })).json()) as { items: { id: number }[] };
    expect(listed.items.map((p) => p.id)).toEqual([3, 1, 2]);
  });

  test("answers 409 order_stale for a missing, extra or unknown id and keeps the order", async () => {
    const { app, repo, cookie } = threePrizes();
    for (const ids of [[1, 2], [1, 2, 3, 4], [1, 2, 99]]) {
      const res = await call(app, "PUT", "/order", { cookie, body: { ids } });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "order_stale" });
    }
    expect(order(repo)).toEqual([1, 2, 3]);
  });

  test("answers 422 for a malformed list, a repeated id included, and keeps the order", async () => {
    const { app, repo, cookie } = threePrizes();
    const malformed = [
      { ids: [] },
      { ids: "x" },
      { ids: [1, 2, -3] },
      { ids: [1.5, 2, 3] },
      { ids: [1, 1, 2] },
      { ids: [3, 3, 3] },
      {},
    ];
    for (const body of malformed) {
      const res = await call(app, "PUT", "/order", { cookie, body });
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "invalid_input" });
    }
    expect(order(repo)).toEqual([1, 2, 3]);
  });
});

describe("authentication", () => {
  test("every route answers 401 without a session, even with an invalid or malformed body, and changes nothing", async () => {
    const { app, repo } = threePrizes();
    const before = repo.list();
    expect((await call(app, "GET", "")).status).toBe(401);
    expect((await call(app, "POST", "", { body: valid })).status).toBe(401);
    expect((await call(app, "POST", "", { body: {} })).status).toBe(401);
    expect((await call(app, "PATCH", "/1", { body: { winners: 2 } })).status).toBe(401);
    expect((await call(app, "PATCH", "/1", { body: {} })).status).toBe(401);
    expect((await call(app, "PATCH", "/abc", { body: {} })).status).toBe(401);
    expect((await call(app, "DELETE", "/1")).status).toBe(401);
    expect((await call(app, "DELETE", "/abc")).status).toBe(401);
    expect((await call(app, "PUT", "/order", { body: { ids: [3, 2, 1] } })).status).toBe(401);
    expect((await call(app, "PUT", "/order", { body: { ids: [] } })).status).toBe(401);
    expect((await call(app, "PUT", "/order", { rawBody: "{not json" })).status).toBe(401);
    expect((await call(app, "POST", "", { rawBody: "{not json" })).status).toBe(401);
    expect(repo.list()).toEqual(before);
  });
});

describe("rules that depend on winners", () => {
  // A winner is written straight to the table; these tests are about how the routes answer.
  let guestNumber = 0;
  const win = (db: ReturnType<typeof setup>["db"], prizeId: number, cancelled = false) => {
    const guest = Number(
      db.run("INSERT INTO participants (name, email, created_at) VALUES ('Rina', ?, 't')", [
        `rina${++guestNumber}@x.example`,
      ]).lastInsertRowid,
    );
    db.run("INSERT INTO winners (prize_id, participant_id, drawn_at, cancelled_at) VALUES (?, ?, 't', ?)", [
      prizeId,
      guest,
      cancelled ? "t2" : null,
    ]);
  };

  test("PATCH answers 409 below_drawn, with the drawn count, when winners would go below it", async () => {
    const { app, db, repo, cookie } = threePrizes();
    win(db, 3);
    win(db, 3);
    const res = await call(app, "PATCH", "/3", { cookie, body: { winners: 1 } });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "below_drawn", drawn: 2 });
    expect(repo.list()[2]!.winners).toBe(5);
    expect((await call(app, "PATCH", "/3", { cookie, body: { winners: 2 } })).status).toBe(200);
  });

  test("PATCH answers 409 tier_locked for a changed tier once drawn, and accepts the same tier", async () => {
    const { app, db, repo, cookie } = threePrizes();
    win(db, 1);
    const locked = await call(app, "PATCH", "/1", { cookie, body: { tier: "basic" } });
    expect(locked.status).toBe(409);
    expect(await locked.json()).toEqual({ error: "tier_locked" });
    expect(repo.list()[0]!.tier).toBe("premium");
    const same = await call(app, "PATCH", "/1", {
      cookie,
      body: { name: "Grand Prize", value: 10_000_000, winners: 1, tier: "premium" },
    });
    expect(same.status).toBe(200);
  });

  test("DELETE answers 409 has_winners for a prize with a winner row, cancelled ones included", async () => {
    const { app, db, repo, cookie } = threePrizes();
    win(db, 1);
    win(db, 2, true);
    for (const id of [1, 2]) {
      const res = await call(app, "DELETE", `/${id}`, { cookie });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "has_winners" });
    }
    expect(repo.list().length).toBe(3);
    expect((await call(app, "DELETE", "/3", { cookie })).status).toBe(204);
  });
});
