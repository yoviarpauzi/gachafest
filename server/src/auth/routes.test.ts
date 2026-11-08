import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createRateLimiter } from "./rate-limit";
import { createAuthRoutes } from "./routes";
import { SESSION_TTL_MS } from "./session";

const PASSWORD = "correct horse";

function makeApp(opts: { password?: string; clock?: { now: number } } = {}) {
  const clock = opts.clock ?? { now: 1_000_000 };
  const now = () => clock.now;
  const app = new Elysia().use(
    createAuthRoutes({
      adminPassword: opts.password ?? PASSWORD,
      sessionSecret: "s".repeat(32),
      limiter: createRateLimiter({ now }),
      now,
    }),
  );
  return { app, clock };
}

type App = ReturnType<typeof makeApp>["app"];

const postLogin = (app: App, body: BodyInit, contentType = "application/json") =>
  app.handle(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    }),
  );

const login = (app: App, password: string) => postLogin(app, JSON.stringify({ password }));

const me = (app: App, cookie?: string) =>
  app.handle(
    new Request("http://localhost/api/auth/me", cookie ? { headers: { cookie } } : undefined),
  );

const cookieOf = (res: Response) => res.headers.get("set-cookie")!.split(";")[0]!;

describe("POST /api/auth/login", () => {
  test("login with correct password returns 200 and a session cookie", async () => {
    const { app } = makeApp();
    const res = await login(app, PASSWORD);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toStartWith("session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=43200");
  });

  test("wrong password returns 401 invalid_credentials", async () => {
    const { app } = makeApp();
    const res = await login(app, "nope");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_credentials" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("missing password, non-JSON body, and text/plain content-type return 422 invalid_body", async () => {
    const { app } = makeApp();
    const cases: [BodyInit, string?][] = [
      [JSON.stringify({}), undefined],
      [JSON.stringify({ password: "" }), undefined],
      ["this is not json", undefined],
      [JSON.stringify({ password: PASSWORD }), "text/plain"],
    ];
    for (const [body, contentType] of cases) {
      const res = await postLogin(app, body, contentType);
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "invalid_body" });
    }
  });

  test("whitespace-only password returns 401", async () => {
    const { app } = makeApp();
    const res = await login(app, "   ");
    expect(res.status).toBe(401);
  });

  test("non-ASCII correct password returns 200", async () => {
    const { app } = makeApp({ password: "pässwörd-密码" });
    const res = await login(app, "pässwörd-密码");
    expect(res.status).toBe(200);
  });

  test("1 MB password returns 401", async () => {
    const { app } = makeApp();
    const res = await login(app, "x".repeat(1_000_000));
    expect(res.status).toBe(401);
  });

  test("sixth attempt returns 429 with retryAfterSeconds even when the password is correct", async () => {
    const { app } = makeApp();
    for (let i = 0; i < 5; i++) expect((await login(app, "nope")).status).toBe(401);
    const res = await login(app, PASSWORD);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "too_many_attempts", retryAfterSeconds: 60 });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("successful login clears the failure count", async () => {
    const { app } = makeApp();
    for (let i = 0; i < 4; i++) await login(app, "nope");
    expect((await login(app, PASSWORD)).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await login(app, "nope")).status).toBe(401);
  });

  test("seven concurrent wrong attempts yield exactly five 401 and two 429", async () => {
    const { app } = makeApp();
    const responses = await Promise.all(Array.from({ length: 7 }, () => login(app, "nope")));
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 401)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(2);
  });
});

describe("GET /api/auth/me", () => {
  test("me returns 200 with the cookie from login", async () => {
    const { app } = makeApp();
    const cookie = cookieOf(await login(app, PASSWORD));
    const res = await me(app, cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: true });
  });

  test("me returns 401 without a cookie, with a tampered cookie, and with an expired cookie", async () => {
    const { app, clock } = makeApp();
    expect((await me(app)).status).toBe(401);

    const cookie = cookieOf(await login(app, PASSWORD));
    const [name, value] = cookie.split("=") as [string, string];
    const tampered = `${name}=${value.replace(/^\d+/, "99999999999999")}`;
    expect((await me(app, tampered)).status).toBe(401);
    expect((await me(app, "session=garbage")).status).toBe(401);
    expect((await me(app, "session=")).status).toBe(401);

    clock.now += SESSION_TTL_MS + 1;
    const res = await me(app, cookie);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ authenticated: false });
  });
});

describe("POST /api/auth/logout", () => {
  const logout = (app: App, cookie?: string) =>
    app.handle(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: cookie ? { cookie } : undefined,
      }),
    );

  test("logout clears the session cookie", async () => {
    const { app } = makeApp();
    const cookie = cookieOf(await login(app, PASSWORD));
    const res = await logout(app, cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/^session=;/);
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });

  test("logout is idempotent without a cookie", async () => {
    const { app } = makeApp();
    const res = await logout(app);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("logout with a garbage cookie returns 200 and clears", async () => {
    const { app } = makeApp();
    const res = await logout(app, "session=garbage");
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/^session=;.*Max-Age=0/);
  });

  test("me returns 401 with the cleared cookie", async () => {
    const { app } = makeApp();
    const res = await me(app, "session=");
    expect(res.status).toBe(401);
  });
});
