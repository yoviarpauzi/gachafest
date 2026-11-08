import { z } from "zod";

// The same rules as the server (name 1-200, valid email up to 254, both trimmed), with form-friendly messages.
export const addParticipantSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(200, "That name is too long."),
  email: z
    .string()
    .trim()
    .min(1, "Enter an email address.")
    .max(254, "That email address is not valid.")
    .pipe(z.email("That email address is not valid.")),
});
