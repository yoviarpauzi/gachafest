import { Elysia } from "elysia";
import { parseEnv } from "./env";
import { createAdminRoutes } from "./auth/guard";
import { createRateLimiter } from "./auth/rate-limit";
import { createAuthRoutes } from "./auth/routes";
import { join } from "node:path";
import { openDatabase, resolveDatabasePath } from "./db/database";
import { migrate } from "./db/migrate";
import { createParticipantsRepository } from "./participants/repository";
import { createParticipantsRoutes } from "./participants/routes";
import { HOST, listen } from "./server";

const PORT = 3000;
const env = parseEnv(process.env);

const serverDir = join(import.meta.dir, "..");
const db = openDatabase(resolveDatabasePath(env.DATABASE_PATH, serverDir));
const applied = migrate(db, join(serverDir, "migrations"));
if (applied.length > 0) console.log(`Applied migrations: ${applied.join(", ")}`);

const participants = createParticipantsRepository(db);

// Bun refuses bigger bodies before they are parsed; the upload handlers enforce the exact 5 MiB limit.
const app = new Elysia({ serve: { maxRequestBodySize: 6 * 1024 * 1024 } })
  .use(
    createAuthRoutes({
      adminPassword: env.ADMIN_PASSWORD,
      sessionSecret: env.SESSION_SECRET,
      limiter: createRateLimiter(),
      now: Date.now,
    }),
  )
  .use(
    createAdminRoutes({ sessionSecret: env.SESSION_SECRET, now: Date.now }).use(
      createParticipantsRoutes({ repo: participants }),
    ),
  );

listen(app, PORT);

console.log(`Server listening on http://${HOST}:${PORT}`);
