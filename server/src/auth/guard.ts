import { Elysia } from "elysia";
import { SESSION_COOKIE, verifySession } from "./session";

export function isSessionValid(cookieValue: unknown, secret: string, now: number): boolean {
  return verifySession(cookieValue === undefined ? undefined : String(cookieValue), secret, now);
}

/**
 * Every endpoint of the organizer panel lives under /api/admin. The hook is registered before any
 * route, so routes and plugins attached later with `.get()` / `.use()` are protected by it.
 *
 * It runs at `transform`, ahead of body and query validation: an unauthenticated caller must get
 * 401, never a 422 that spells out the schema of an admin route. (Elysia parses the body first, so
 * malformed JSON is still answered with 400.)
 */
export function createAdminRoutes(deps: { sessionSecret: string; now: () => number }) {
  const { sessionSecret, now } = deps;

  return new Elysia({ prefix: "/api/admin" }).onTransform(({ cookie, status }) => {
    if (!isSessionValid(cookie[SESSION_COOKIE]?.value, sessionSecret, now())) {
      throw status(401, { error: "unauthenticated" });
    }
  });
}
