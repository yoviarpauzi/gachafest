import { Elysia } from "elysia";
import { parseEnv } from "./env";
import { createRateLimiter } from "./auth/rate-limit";
import { createAuthRoutes } from "./auth/routes";

const PORT = 3000;
const env = parseEnv(process.env);

new Elysia()
  .use(
    createAuthRoutes({
      adminPassword: env.ADMIN_PASSWORD,
      sessionSecret: env.SESSION_SECRET,
      limiter: createRateLimiter(),
      now: Date.now,
    }),
  )
  .listen(PORT);

console.log(`Server listening on http://localhost:${PORT}`);
