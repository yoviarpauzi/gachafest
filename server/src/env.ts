import { z } from "zod";

const envSchema = z.object({
  ADMIN_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  DATABASE_PATH: z.string().min(1).default("data/gachafest.db"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
  throw new Error(`Invalid environment: ${names.join(", ")}`);
}
