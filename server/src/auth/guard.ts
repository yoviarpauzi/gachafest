import { Elysia } from "elysia";
import { SESSION_COOKIE, verifySession } from "./session";

export function isSessionValid(cookieValue: unknown, secret: string, now: number): boolean {
  return verifySession(cookieValue === undefined ? undefined : String(cookieValue), secret, now);
}

/**
 * Every endpoint of the organizer panel lives under /api/admin. The hook is registered before any
 * route, so routes and plugins attached later with `.get()` / `.use()` are protected by it.
 */
export function createAdminRoutes(deps: { sessionSecret: string; now: () => number }) {
  const { sessionSecret, now } = deps;

  return new Elysia({ prefix: "/api/admin" }).onBeforeHandle(({ cookie, status }) => {
    if (!isSessionValid(cookie[SESSION_COOKIE]?.value, sessionSecret, now())) {
      return status(401, { error: "unauthenticated" });
    }
  });
}
