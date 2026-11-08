import { ApiError, apiFetch } from "../../lib/api";

export const PAGE_SIZE = 50;

export type Participant = { id: number; name: string; email: string; disabled: boolean };
export type ParticipantsPage = {
  items: Participant[];
  matching: number;
  total: number;
  disabled: number;
};
export type ImportPreview = {
  fileName: string;
  rowsRead: number;
  valid: number;
  duplicates: number;
  problems: { row: number; reason: string }[];
  problemsTotal: number;
};
export type ImportResult = { imported: number; duplicates: number; problemsTotal: number };

const BASE = "/api/admin/participants";

export const listParticipants = (search: { q: string; page: number }) =>
  apiFetch<ParticipantsPage>(
    `${BASE}?${new URLSearchParams({
      q: search.q,
      page: String(search.page),
      pageSize: String(PAGE_SIZE),
    })}`,
  );

function upload<T>(path: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  return apiFetch<T>(path, { method: "POST", body: form });
}

export const previewImport = (file: File) => upload<ImportPreview>(`${BASE}/import/preview`, file);
export const importFile = (file: File) => upload<ImportResult>(`${BASE}/import`, file);

export const setParticipantDisabled = (id: number, disabled: boolean) =>
  apiFetch<Participant>(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify({ disabled }) });

/** The `error` code the server put in a failed response, if any. */
export function errorCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const code = (error.body as { error?: unknown } | undefined)?.error;
  return typeof code === "string" ? code : undefined;
}
