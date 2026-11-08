import { ApiError, apiFetch } from "../../lib/api";

export type Tier = "basic" | "premium";
export type Prize = {
  id: number;
  name: string;
  /** Whole Rupiah, or null for a prize without a value. */
  value: number | null;
  winners: number;
  tier: Tier;
  drawn: number;
};
export type PrizesList = { items: Prize[] };
export type PrizeInput = { name: string; value: number | null; winners: number; tier: Tier };

const BASE = "/api/admin/prizes";

export const listPrizes = () => apiFetch<PrizesList>(BASE);

export const createPrize = (input: PrizeInput) =>
  apiFetch<Prize>(BASE, { method: "POST", body: JSON.stringify(input) });

export const updatePrize = (id: number, input: PrizeInput) =>
  apiFetch<Prize>(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify(input) });

/** A 404 means it is already gone, which is what the caller wanted, so it is not an error here. */
export async function deletePrize(id: number): Promise<void> {
  try {
    await apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
}

/** Saves the draw order: every prize id, in the new order. A 409 means the list changed meanwhile. */
export const reorderPrizes = (ids: number[]) =>
  apiFetch<void>(`${BASE}/order`, { method: "PUT", body: JSON.stringify({ ids }) });
