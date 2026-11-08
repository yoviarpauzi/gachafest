import { z } from "zod";

// Anything malformed in the URL (?page=abc, ?page=-3, a 5,000-character ?q=) falls back to the default
// instead of reaching the API or the router's error screen.
export const searchSchema = z.object({
  q: z.string().max(100).default("").catch(""),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1).catch(1),
});

export type ParticipantsSearch = z.infer<typeof searchSchema>;
