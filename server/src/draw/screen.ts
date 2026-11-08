import { Elysia } from "elysia";
import type { createScreenPresence } from "./presence";
import type { createDrawRepository } from "./repository";

/**
 * The one public route: what the big screen shows. No login, read-only, and it writes nothing to the
 * database (it only notes in memory that the screen asked). It lives outside `/api/admin` on purpose.
 */
export function createScreenRoutes(deps: {
  repo: ReturnType<typeof createDrawRepository>;
  presence: ReturnType<typeof createScreenPresence>;
}) {
  const { repo, presence } = deps;
  return new Elysia({ prefix: "/api/screen" }).get("/", () => {
    presence.seen();
    return repo.screen();
  });
}
