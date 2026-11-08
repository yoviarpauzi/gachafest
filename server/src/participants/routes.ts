import { Elysia, t } from "elysia";
import { z } from "zod";
import {
  MAX_FILE_BYTES,
  type ParsedFile,
  ParticipantsFileError,
  parseParticipantsFile,
} from "./parse";
import { planImport } from "./plan";
import type { createParticipantsRepository } from "./repository";
import { participantInput, participantPatch } from "./schema";

const listQuery = z.object({
  q: z.string().max(100).default(""),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const idParams = z.object({ id: z.coerce.number().int().positive() });

// No `maxSize` here: a failed t.File check would answer 422, but a too-large file must be 413.
const uploadBody = t.Object({ file: t.File() });

const PREVIEW_PROBLEM_LIMIT = 100;

type Analysis =
  | { ok: true; parsed: ParsedFile; plan: ReturnType<typeof planImport> }
  | { ok: false; status: 413 | 422; error: string };

export function createParticipantsRoutes(deps: {
  repo: ReturnType<typeof createParticipantsRepository>;
}) {
  const { repo } = deps;

  async function analyze(file: File): Promise<Analysis> {
    if (file.size > MAX_FILE_BYTES) return { ok: false, status: 413, error: "file_too_large" };
    try {
      const parsed = await parseParticipantsFile(file.name, new Uint8Array(await file.arrayBuffer()));
      return { ok: true, parsed, plan: planImport(parsed, repo.emailKeys()) };
    } catch (error) {
      if (error instanceof ParticipantsFileError) return { ok: false, status: 422, error: error.code };
      throw error;
    }
  }

  return new Elysia({ prefix: "/participants" })
    .get("/", ({ query }) => repo.list(listQuery.parse(query)), { query: listQuery })
    .post(
      "/",
      ({ body, status }) => {
        const participant = repo.insert(participantInput.parse(body));
        return participant ? status(201, participant) : status(409, { error: "email_taken" });
      },
      { body: participantInput },
    )
    .patch(
      "/:id",
      ({ params, body, status }) => {
        const result = repo.update(Number(params.id), participantPatch.parse(body));
        if (result.kind === "ok") return result.participant;
        return result.kind === "email_taken"
          ? status(409, { error: "email_taken" })
          : status(404, { error: "not_found" });
      },
      { params: idParams, body: participantPatch },
    )
    .delete(
      "/:id",
      ({ params, status }) =>
        repo.remove(Number(params.id)) ? status(204) : status(404, { error: "not_found" }),
      { params: idParams },
    )
    .post(
      "/import/preview",
      async ({ body, status }) => {
        const result = await analyze(body.file);
        if (!result.ok) return status(result.status, { error: result.error });
        const { parsed, plan } = result;
        return {
          fileName: body.file.name,
          rowsRead: parsed.rowsRead,
          valid: plan.toInsert.length,
          duplicates: plan.duplicates,
          problems: plan.problems.slice(0, PREVIEW_PROBLEM_LIMIT),
          problemsTotal: plan.problems.length,
        };
      },
      { body: uploadBody },
    )
    .post(
      "/import",
      async ({ body, status }) => {
        const result = await analyze(body.file);
        if (!result.ok) return status(result.status, { error: result.error });
        const { plan } = result;
        const imported = repo.insertMany(plan.toInsert);
        return {
          imported,
          duplicates: plan.duplicates + (plan.toInsert.length - imported),
          problemsTotal: plan.problems.length,
        };
      },
      { body: uploadBody },
    );
}
