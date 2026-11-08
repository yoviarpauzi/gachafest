import { Elysia } from "elysia";
import { z } from "zod";
import type { createPrizesRepository } from "./repository";
import { orderBody, prizeInput, prizePatch } from "./schema";

const idParams = z.object({ id: z.coerce.number().int().positive() });

export function createPrizesRoutes(deps: { repo: ReturnType<typeof createPrizesRepository> }) {
  const { repo } = deps;

  // `/order` is a different path from `/:id`, so the two never compete for a request.
  return new Elysia({ prefix: "/prizes" })
    .get("/", () => ({ items: repo.list() }))
    .post("/", ({ body, status }) => status(201, repo.insert(prizeInput.parse(body))), {
      body: prizeInput,
    })
    .put(
      "/order",
      ({ body, status }) =>
        repo.reorder(orderBody.parse(body).ids).kind === "ok"
          ? status(204)
          : status(409, { error: "order_stale" }),
      { body: orderBody },
    )
    .patch(
      "/:id",
      ({ params, body, status }) => {
        const result = repo.update(Number(params.id), prizePatch.parse(body));
        switch (result.kind) {
          case "ok":
            return result.prize;
          case "below_drawn":
            return status(409, { error: "below_drawn", drawn: result.drawn });
          case "tier_locked":
            return status(409, { error: "tier_locked" });
          default:
            return status(404, { error: "not_found" });
        }
      },
      { params: idParams, body: prizePatch },
    )
    .delete(
      "/:id",
      ({ params, status }) => {
        const result = repo.remove(Number(params.id));
        if (result === "ok") return status(204);
        return result === "has_winners"
          ? status(409, { error: "has_winners" })
          : status(404, { error: "not_found" });
      },
      { params: idParams },
    );
}
