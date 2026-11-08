import { Elysia } from "elysia";
import { parseEnv } from "./env";
import { createRateLimiter } from "./auth/rate-limit";
import { createAuthRoutes } from "./auth/routes";
import { HOST, listen } from "./server";

const PORT = 3000;
const env = parseEnv(process.env);

const app = new Elysia().use(
  createAuthRoutes({
    adminPassword: env.ADMIN_PASSWORD,
    sessionSecret: env.SESSION_SECRET,
    limiter: createRateLimiter(),
    now: Date.now,
  }),
);

listen(app, PORT);

console.log(`Server listening on http://${HOST}:${PORT}`);
