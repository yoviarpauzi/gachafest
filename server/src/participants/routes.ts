import { Elysia } from "elysia";
import { z } from "zod";
import type { createParticipantsRepository } from "./repository";

const listQuery = z.object({
  q: z.string().max(100).default(""),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export function createParticipantsRoutes(deps: {
  repo: ReturnType<typeof createParticipantsRepository>;
}) {
  const { repo } = deps;

  return new Elysia({ prefix: "/participants" })
    .get("/", ({ query }) => repo.list(listQuery.parse(query)), { query: listQuery })
    .patch(
      "/:id",
      ({ params, body, status }) => {
        const updated = repo.setDisabled(Number(params.id), body.disabled);
        return updated ?? status(404, { error: "not_found" });
      },
      {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: z.object({ disabled: z.boolean() }),
      },
    );
}
