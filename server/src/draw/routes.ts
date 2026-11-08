import { Elysia } from "elysia";
import { z } from "zod";
import type { createScreenPresence } from "./presence";
import type { DrawState, createDrawRepository } from "./repository";

const selectBody = z.object({ prizeId: z.number().int().positive() });

export function createDrawRoutes(deps: {
  repo: ReturnType<typeof createDrawRepository>;
  presence: ReturnType<typeof createScreenPresence>;
}) {
  const { repo, presence } = deps;
  // The organizer's page also shows whether the big screen is open.
  const view = (state: DrawState) => ({ ...state, screenOpen: presence.isOpen() });

  return new Elysia({ prefix: "/draw" })
    .get("/", () => view(repo.state()))
    .post(
      "/select",
      ({ body, status }) => {
        const result = repo.select(selectBody.parse(body).prizeId);
        switch (result.kind) {
          case "ok":
            return view(result.state);
          case "reveal_pending":
          case "prize_full":
            return status(409, { error: result.kind });
          default:
            return status(404, { error: "not_found" });
        }
      },
      { body: selectBody },
    )
    .post("/", ({ status }) => {
      const result = repo.draw();
      switch (result.kind) {
        case "ok":
          return status(201, view(result.state));
        case "reveal_pending":
        case "no_open_prize":
        case "no_eligible":
        case "prize_full":
          return status(409, { error: result.kind });
        default:
          return status(404, { error: "not_found" });
      }
    })
    .post("/skip", ({ status }) => {
      const result = repo.skip();
      return result.kind === "ok" ? view(result.state) : status(409, { error: "not_revealing" });
    })
    .post("/done", () => view(repo.done().state));
}
