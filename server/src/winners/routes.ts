import { Elysia } from "elysia";
import { z } from "zod";
import { toCsv } from "./csv";
import type { createWinnersRepository } from "./repository";

const idParams = z.object({ id: z.coerce.number().int().positive() });
const drawBody = z.object({ prizeId: z.number().int().positive() });

export function createWinnersRoutes(deps: { repo: ReturnType<typeof createWinnersRepository> }) {
  const { repo } = deps;

  return new Elysia({ prefix: "/winners" })
    .get("/", () => repo.list())
    .post(
      "/",
      ({ body, status }) => {
        const result = repo.draw(drawBody.parse(body).prizeId);
        switch (result.kind) {
          case "ok":
            return status(201, result.winner);
          case "prize_full":
            return status(409, { error: "prize_full" });
          case "no_eligible":
            return status(409, { error: "no_eligible" });
          default:
            return status(404, { error: "not_found" });
        }
      },
      { body: drawBody },
    )
    .post(
      "/:id/cancel",
      ({ params, status }) => {
        const result = repo.cancel(Number(params.id));
        switch (result.kind) {
          case "ok":
            return result.winner;
          case "already_cancelled":
            return status(409, { error: "already_cancelled" });
          default:
            return status(404, { error: "not_found" });
        }
      },
      { params: idParams },
    )
    .delete(
      "/:id",
      ({ params, status }) => {
        const result = repo.remove(Number(params.id));
        if (result === "ok") return status(204);
        return result === "on_screen" ? status(409, { error: "on_screen" }) : status(404, { error: "not_found" });
      },
      { params: idParams },
    )
    .get(
      "/export.csv",
      () =>
        new Response(toCsv(repo.exportRows()), {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": 'attachment; filename="winners.csv"',
          },
        }),
    );
}
