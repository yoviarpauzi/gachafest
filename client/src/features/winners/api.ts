import { ApiError, apiFetch } from "../../lib/api";

export type Winner = {
  id: number;
  prizeId: number;
  prizeName: string;
  participantName: string;
  /** ISO time, UTC. */
  drawnAt: string;
  cancelledAt: string | null;
  status: "valid" | "cancelled";
  /** True while the prize has fewer valid winners than its quota, so a redraw can fill a slot. */
  prizeHasFreeSlot: boolean;
};
export type WinnersList = { items: Winner[]; draws: number; cancelled: number };

const BASE = "/api/admin/winners";

export const listWinners = () => apiFetch<WinnersList>(BASE);

/** Draws one winner for the prize. Also what "Redraw slot" does: it fills a slot a cancel opened. */
export const drawWinner = (prizeId: number) =>
  apiFetch<Winner>(BASE, { method: "POST", body: JSON.stringify({ prizeId }) });

/**
 * Deletes a winner for good, valid or cancelled: no row is left, so the guest can win the prize again. A winner
 * that is gone already (404) is what was wanted, so it is not an error.
 */
export async function deleteWinner(id: number): Promise<void> {
  try {
    await apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
}

export const cancelWinner = (id: number) => apiFetch<Winner>(`${BASE}/${id}/cancel`, { method: "POST" });

/** Saves the winners as `winners.csv` through the browser's download. A failed request throws an `ApiError`. */
export async function downloadWinnersCsv(): Promise<void> {
  const res = await fetch(`${BASE}/export.csv`, { credentials: "same-origin" });
  if (!res.ok) throw new ApiError(res.status, undefined);

  // A Blob keeps the file's bytes, byte order mark included, which `res.text()` would drop.
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "winners.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
