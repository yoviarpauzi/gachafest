import { z } from "zod";

// One definition of "a valid participant", shared by the file import (which reports the message of each
// failing rule) and by adding a single participant by hand.
export const nameSchema = z.string().min(1, "Name is missing").max(200, "Name is too long");
export const emailSchema = z
  .string()
  .min(1, "Email is missing")
  .max(254, "Email format is not valid")
  .pipe(z.email("Email format is not valid"));

export const participantInput = z.object({
  name: z.string().trim().pipe(nameSchema),
  email: z.string().trim().pipe(emailSchema),
});
