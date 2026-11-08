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
import { createPrizesRepository } from "./prizes/repository";
import { createPrizesRoutes } from "./prizes/routes";
import { createWinnersRepository } from "./winners/repository";
import { createWinnersRoutes } from "./winners/routes";
import { HOST, listen } from "./server";

const env = parseEnv(process.env);

const serverDir = join(import.meta.dir, "..");
const db = openDatabase(resolveDatabasePath(env.DATABASE_PATH, serverDir));
const applied = migrate(db, join(serverDir, "migrations"));
if (applied.length > 0) console.log(`Applied migrations: ${applied.join(", ")}`);

const participants = createParticipantsRepository(db);
const prizes = createPrizesRepository(db);
const winners = createWinnersRepository(db);

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
    createAdminRoutes({ sessionSecret: env.SESSION_SECRET, now: Date.now })
      .use(createParticipantsRoutes({ repo: participants }))
      .use(createPrizesRoutes({ repo: prizes }))
      .use(createWinnersRoutes({ repo: winners })),
  );

listen(app, env.PORT);

console.log(`Server listening on http://${HOST}:${env.PORT}`);
