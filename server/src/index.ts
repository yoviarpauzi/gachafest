import { Elysia } from "elysia";
import { parseEnv } from "./env";
import { createAdminRoutes } from "./auth/guard";
import { createRateLimiter } from "./auth/rate-limit";
import { createAuthRoutes } from "./auth/routes";
import { join } from "node:path";
import { openDatabase, resolveDatabasePath } from "./db/database";
import { migrate } from "./db/migrate";
import { HOST, listen } from "./server";

const PORT = 3000;
const env = parseEnv(process.env);

const serverDir = join(import.meta.dir, "..");
const db = openDatabase(resolveDatabasePath(env.DATABASE_PATH, serverDir));
const applied = migrate(db, join(serverDir, "migrations"));
if (applied.length > 0) console.log(`Applied migrations: ${applied.join(", ")}`);

// `db` is handed to the organizer sub-plugins as they are added under createAdminRoutes().
const app = new Elysia()
  .use(
    createAuthRoutes({
      adminPassword: env.ADMIN_PASSWORD,
      sessionSecret: env.SESSION_SECRET,
      limiter: createRateLimiter(),
      now: Date.now,
    }),
  )
  .use(createAdminRoutes({ sessionSecret: env.SESSION_SECRET, now: Date.now }));

listen(app, PORT);

console.log(`Server listening on http://${HOST}:${PORT}`);
