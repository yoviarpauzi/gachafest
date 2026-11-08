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
        return result.kind === "ok" ? result.prize : status(404, { error: "not_found" });
      },
      { params: idParams, body: prizePatch },
    )
    .delete(
      "/:id",
      ({ params, status }) =>
        repo.remove(Number(params.id)) ? status(204) : status(404, { error: "not_found" }),
      { params: idParams },
    );
}
