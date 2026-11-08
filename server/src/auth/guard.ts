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
 * 401, never a 422 that spells out the schema of an admin route. Elysia parses the body before that
 * hook, so a malformed body fails first; the error handler below checks the session again and still
 * answers 401 to an unauthenticated caller, and only an authenticated one is told `invalid_input`.
 */
export function createAdminRoutes(deps: { sessionSecret: string; now: () => number }) {
  const { sessionSecret, now } = deps;
  const hasSession = (cookie: Record<string, { value?: unknown } | undefined>) =>
    isSessionValid(cookie[SESSION_COOKIE]?.value, sessionSecret, now());

  return (
    new Elysia({ prefix: "/api/admin" })
      // Elysia's default validation response spells out the schema; admin routes answer with this instead.
      .onError(({ code, status, cookie }) => {
        if (code === "VALIDATION" || code === "PARSE") {
          return hasSession(cookie)
            ? status(422, { error: "invalid_input" })
            : status(401, { error: "unauthenticated" });
        }
      })
      .onTransform(({ cookie, status }) => {
        if (!hasSession(cookie)) throw status(401, { error: "unauthenticated" });
      })
  );
}
