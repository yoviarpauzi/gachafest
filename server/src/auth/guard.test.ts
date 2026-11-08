import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createAdminRoutes } from "./guard";
import { SESSION_TTL_MS, signSession } from "./session";

const secret = "g".repeat(32);

function setup() {
  const clock = { now: 1_000_000 };
  const deps = { sessionSecret: secret, now: () => clock.now };
  const validCookie = () =>
    `session=${encodeURIComponent(signSession(clock.now + SESSION_TTL_MS, secret))}`;
  return { clock, deps, validCookie };
}

type Handler = { handle(request: Request): Response | Promise<Response> };

const get = (app: Handler, path: string, cookie?: string) =>
  app.handle(new Request(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined));

describe("createAdminRoutes guard", () => {
  test("rejects without a cookie with 401 unauthenticated", async () => {
    const { deps } = setup();
    const app = new Elysia().use(createAdminRoutes(deps).get("/ping", () => ({ ok: true })));
    const res = await get(app, "/api/admin/ping");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
  });

  test("rejects garbage, tampered, and expired cookies", async () => {
    const { deps, clock, validCookie } = setup();
    const app = new Elysia().use(createAdminRoutes(deps).get("/ping", () => ({ ok: true })));
    expect((await get(app, "/api/admin/ping", "session=garbage")).status).toBe(401);
    expect((await get(app, "/api/admin/ping", "session=")).status).toBe(401);
    const tampered = validCookie().replace(/^session=\d+/, "session=99999999999999");
    expect((await get(app, "/api/admin/ping", tampered)).status).toBe(401);

    const cookie = validCookie();
    clock.now += SESSION_TTL_MS + 1;
    expect((await get(app, "/api/admin/ping", cookie)).status).toBe(401);
  });

  test("allows a valid cookie", async () => {
    const { deps, validCookie } = setup();
    const app = new Elysia().use(createAdminRoutes(deps).get("/ping", () => ({ ok: true })));
    const res = await get(app, "/api/admin/ping", validCookie());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("protects a nested plugin attached with use()", async () => {
    const { deps, validCookie } = setup();
    const nested = new Elysia().get("/nested", () => ({ nested: true }));
    const app = new Elysia().use(createAdminRoutes(deps).use(nested));
    expect((await get(app, "/api/admin/nested")).status).toBe(401);
    expect((await get(app, "/api/admin/nested", validCookie())).status).toBe(200);
  });

  test("does not guard routes outside the prefix", async () => {
    const { deps } = setup();
    const app = new Elysia()
      .use(createAdminRoutes(deps).get("/ping", () => ({ ok: true })))
      .get("/api/public", () => ({ public: true }));
    expect((await get(app, "/api/public")).status).toBe(200);
  });

  test("path variants never return 200 without a session", async () => {
    const { deps } = setup();
    const app = new Elysia().use(createAdminRoutes(deps).get("/ping", () => ({ ok: true })));

    for (const path of ["/api/admin/ping/", "/api/admin/ping?x=1"]) {
      expect((await get(app, path)).status).toBe(401);
    }
    for (const path of ["/api/admin//ping", "/API/admin/ping", "/api/admin/ping#frag"]) {
      expect((await get(app, path)).status).not.toBe(200);
    }
  });
});
