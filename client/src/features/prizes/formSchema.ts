import { z } from "zod";
import type { PrizeInput, Tier } from "./api";
import { parseRupiah } from "./format";

/** The form keeps every field as text, so what the organizer typed is what gets validated. */
export type PrizeFormValues = { name: string; value: string; winners: string; tier: Tier };

export const MAX_WINNERS = 1000;

export const prizeFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a prize name.").max(60, "That name is too long."),
  value: z
    .string()
    .refine(
      (text) => parseRupiah(text).kind !== "invalid",
      "Enter a whole amount in Rupiah, or leave it empty.",
    ),
  winners: z
    .string()
    .trim()
    .refine(
      (text) => /^\d+$/.test(text) && Number(text) >= 1 && Number(text) <= MAX_WINNERS,
      "Enter a whole number from 1 to 1,000.",
    ),
  tier: z.enum(["basic", "premium"]),
});

/** Turns values that passed `prizeFormSchema` into what the API takes. */
export function toPrizeInput(values: PrizeFormValues): PrizeInput {
  const value = parseRupiah(values.value);
  return {
    name: values.name.trim(),
    value: value.kind === "ok" ? value.value : null,
    winners: Number(values.winners.trim()),
    tier: values.tier,
  };
}
