import { createHash, timingSafeEqual } from "node:crypto";
import { Elysia } from "elysia";
import type { RateLimiter } from "./rate-limit";
import { loginBody } from "./schema";
import { SESSION_COOKIE, SESSION_TTL_MS, signSession, verifySession } from "./session";

const sha256 = (value: string) => createHash("sha256").update(value).digest();

export function createAuthRoutes(deps: {
  adminPassword: string;
  sessionSecret: string;
  limiter: RateLimiter;
  now: () => number;
}) {
  const { sessionSecret, limiter, now } = deps;
  const expectedHash = sha256(deps.adminPassword);

  return new Elysia({ prefix: "/api/auth" })
    .onError(({ code, status }) => {
      if (code === "VALIDATION" || code === "PARSE") {
        return status(422, { error: "invalid_body" });
      }
    })
    .post(
      "/login",
      ({ body, cookie, request, server, status }) => {
        const ip = server?.requestIP(request)?.address ?? "unknown";

        const state = limiter.check(ip);
        if (state.blocked) {
          return status(429, {
            error: "too_many_attempts",
            retryAfterSeconds: state.retryAfterSeconds,
          });
        }

        if (!timingSafeEqual(sha256(body.password), expectedHash)) {
          limiter.recordFailure(ip);
          return status(401, { error: "invalid_credentials" });
        }

        limiter.reset(ip);
        cookie[SESSION_COOKIE]!.set({
          value: signSession(now() + SESSION_TTL_MS, sessionSecret),
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: SESSION_TTL_MS / 1000,
        });
        return { ok: true };
      },
      { body: loginBody },
    )
    .get("/me", ({ cookie, status }) => {
      const value = cookie[SESSION_COOKIE]!.value;
      if (!verifySession(value === undefined ? undefined : String(value), sessionSecret, now())) {
        return status(401, { authenticated: false });
      }
      return { authenticated: true };
    });
}
