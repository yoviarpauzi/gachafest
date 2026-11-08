import { z } from "zod";

export const MAX_PRIZE_VALUE = 1_000_000_000_000;
export const MAX_WINNERS = 1000;

const name = z.string().trim().min(1).max(60);
// Whole Rupiah. `null` is "no value", which the big screen hides; 0 is not a value.
const value = z.number().int().min(1).max(MAX_PRIZE_VALUE).nullable();
const winners = z.number().int().min(1).max(MAX_WINNERS);
const tier = z.enum(["basic", "premium"]);

export const prizeInput = z.object({
  name,
  value: value.optional(),
  winners,
  tier: tier.default("basic"),
});

// Editing: any of the fields, at least one. Fields it does not know are dropped, so neither an id nor a
// position can be sent; the order only changes through `orderBody`.
export const prizePatch = z
  .object({
    name: name.optional(),
    value: value.optional(),
    winners: winners.optional(),
    tier: tier.optional(),
  })
  .refine((patch) => Object.values(patch).some((field) => field !== undefined), {
    message: "Nothing to change.",
  });

// The full new order: every prize exactly once. Whether it is the *current* set is the repository's call.
export const orderBody = z.object({
  ids: z
    .array(z.number().int().positive())
    .min(1)
    .max(MAX_WINNERS)
    .refine((ids) => new Set(ids).size === ids.length, { message: "Each prize can appear once." }),
});

export type PrizeInput = z.infer<typeof prizeInput>;
export type PrizePatch = z.infer<typeof prizePatch>;
