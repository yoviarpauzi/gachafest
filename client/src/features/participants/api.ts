import { ApiError, apiFetch } from "../../lib/api";

export const PAGE_SIZE = 50;

export type Participant = {
  id: number;
  name: string;
  email: string;
  disabled: boolean;
};
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
export type ImportResult = {
  imported: number;
  duplicates: number;
  problemsTotal: number;
};

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

export const previewImport = (file: File) =>
  upload<ImportPreview>(`${BASE}/import/preview`, file);
export const importFile = (file: File) =>
  upload<ImportResult>(`${BASE}/import`, file);

export const addParticipant = (input: { name: string; email: string }) =>
  apiFetch<Participant>(BASE, { method: "POST", body: JSON.stringify(input) });

export const updateParticipant = (
  id: number,
  patch: { name?: string; email?: string },
) =>
  apiFetch<Participant>(`${BASE}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

/** A 404 means it is already gone, which is what the caller wanted, so it is not an error here. */
export async function deleteParticipant(id: number): Promise<void> {
  try {
    await apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
}

export const setParticipantDisabled = (id: number, disabled: boolean) =>
  apiFetch<Participant>(`${BASE}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ disabled }),
  });
