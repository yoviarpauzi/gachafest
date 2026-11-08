import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Elysia } from "elysia";
import { createAdminRoutes } from "../auth/guard";
import { SESSION_TTL_MS, signSession } from "../auth/session";
import { openDatabase } from "../db/database";
import { migrate } from "../db/migrate";
import { createParticipantsRepository } from "./repository";
import { createParticipantsRoutes } from "./routes";

const secret = "p".repeat(32);

function setup() {
  const now = 1_000_000;
  const db = openDatabase(":memory:");
  migrate(db, join(import.meta.dir, "../../migrations"));
  const repo = createParticipantsRepository(db);
  const app = new Elysia().use(
    createAdminRoutes({ sessionSecret: secret, now: () => now }).use(
      createParticipantsRoutes({ repo }),
    ),
  );
  const cookie = `session=${encodeURIComponent(signSession(now + SESSION_TTL_MS, secret))}`;
  return { app, repo, cookie };
}

type App = ReturnType<typeof setup>["app"];

const call = (
  app: App,
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown; rawBody?: string } = {},
) =>
  app.handle(
    new Request(`http://localhost/api/admin/participants${path}`, {
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

const guests = ["Rina", "Budi", "Maya", "Agus", "Dewi"].map((name) => ({
  name,
  email: `${name.toLowerCase()}@x.example`,
}));

describe("GET /api/admin/participants", () => {
  test("returns items with counts", async () => {
    const { app, repo, cookie } = setup();
    repo.insertMany(guests.slice(0, 3));
    repo.setDisabled(2, true);
    const res = await call(app, "GET", "", { cookie });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        { id: 1, name: "Rina", email: "rina@x.example", disabled: false },
        { id: 2, name: "Budi", email: "budi@x.example", disabled: true },
        { id: 3, name: "Maya", email: "maya@x.example", disabled: false },
      ],
      matching: 3,
      total: 3,
      disabled: 1,
    });
  });

  test("honors page, pageSize, and q", async () => {
    const { app, repo, cookie } = setup();
    repo.insertMany(guests);
    const paged = (await (await call(app, "GET", "?page=2&pageSize=2", { cookie })).json()) as {
      items: { name: string }[];
      matching: number;
    };
    expect(paged.items.map((p) => p.name)).toEqual(["Maya", "Agus"]);
    expect(paged.matching).toBe(5);

    const searched = (await (await call(app, "GET", "?q=RINA", { cookie })).json()) as {
      items: { name: string }[];
      matching: number;
      total: number;
    };
    expect(searched.items.map((p) => p.name)).toEqual(["Rina"]);
    expect(searched.matching).toBe(1);
    expect(searched.total).toBe(5);
  });

  test("rejects out-of-range or malformed parameters with 422 invalid_input", async () => {
    const { app, cookie } = setup();
    for (const query of [
      "?page=0",
      "?page=abc",
      "?page=1000001",
      "?pageSize=0",
      "?pageSize=201",
      `?q=${"x".repeat(101)}`,
    ]) {
      const res = await call(app, "GET", query, { cookie });
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "invalid_input" });
    }
  });

  test("a page past the end returns an empty items array, not an error", async () => {
    const { app, repo, cookie } = setup();
    repo.insertMany(guests);
    const res = await call(app, "GET", "?page=999999", { cookie });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { items: unknown[] }).items).toEqual([]);
  });
});

describe("PATCH /api/admin/participants/:id", () => {
  test("disables and enables", async () => {
    const { app, repo, cookie } = setup();
    repo.insertMany(guests.slice(0, 1));
    const off = await call(app, "PATCH", "/1", { cookie, body: { disabled: true } });
    expect(off.status).toBe(200);
    expect(await off.json()).toEqual({ id: 1, name: "Rina", email: "rina@x.example", disabled: true });
    const on = await call(app, "PATCH", "/1", { cookie, body: { disabled: false } });
    expect(((await on.json()) as { disabled: boolean }).disabled).toBe(false);
  });

  test("answers 404 for an unknown id", async () => {
    const { app, cookie } = setup();
    const res = await call(app, "PATCH", "/999", { cookie, body: { disabled: true } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  test("answers 422 for a non-numeric id, a missing body, and a non-boolean value", async () => {
    const { app, repo, cookie } = setup();
    repo.insertMany(guests.slice(0, 1));
    expect((await call(app, "PATCH", "/abc", { cookie, body: { disabled: true } })).status).toBe(422);
    expect((await call(app, "PATCH", "/1", { cookie })).status).toBe(422);
    expect((await call(app, "PATCH", "/1", { cookie, body: { disabled: "yes" } })).status).toBe(422);
  });
});

describe("authentication", () => {
  test("all routes answer 401 without a session, including PATCH with an invalid body", async () => {
    const { app, repo } = setup();
    repo.insertMany(guests.slice(0, 1));
    expect((await call(app, "GET", "")).status).toBe(401);
    expect((await call(app, "PATCH", "/1", { body: { disabled: true } })).status).toBe(401);
    expect((await call(app, "PATCH", "/1", { body: {} })).status).toBe(401);
    expect((await call(app, "PATCH", "/abc", { body: {} })).status).toBe(401);
  });
});
