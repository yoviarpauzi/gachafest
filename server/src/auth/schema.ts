import { z } from "zod";

export const loginBody = z.object({
  password: z.string().min(1),
});
