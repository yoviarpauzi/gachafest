import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Elysia } from "elysia";
import { createAdminRoutes } from "../auth/guard";
import { SESSION_TTL_MS, signSession } from "../auth/session";
import { openDatabase } from "../db/database";
import { migrate } from "../db/migrate";
import { createParticipantsRepository } from "./repository";
import { createParticipantsRoutes } from "./routes";

const secret = "p".repeat(32);

function setup() {
  const now = 1_000_000;
  const db = openDatabase(":memory:");
  migrate(db, join(import.meta.dir, "../../migrations"));
  const repo = createParticipantsRepository(db);
  const app = new Elysia().use(
    createAdminRoutes({ sessionSecret: secret, now: () => now }).use(
      createParticipantsRoutes({ repo }),
    ),
  );
  const cookie = `session=${encodeURIComponent(signSession(now + SESSION_TTL_MS, secret))}`;
  return { app, repo, cookie };
}

type App = ReturnType<typeof setup>["app"];

const call = (
  app: App,
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown; rawBody?: string } = {},
) =>
  app.handle(
    new Request(`http://localhost/api/admin/participants${path}`, {
      method,
      headers: {
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
        ...(opts.body !== undefined || opts.rawBody !== undefined
          ? { "content-type": "application/json" }
          : {}),
      },
      body: opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    }),
  );

const guests = ["Rina", "Budi", "Maya", "Agus", "Dewi"].map((name) => ({
  name,
  email: `${name.toLowerCase()}@x.example`,
}));

describe("GET /api/admin/participants", () => {
  test("returns items with counts", async () => {
    const { app, repo, cookie } = setup();
    repo.insertMany(guests.slice(0, 3));
    repo.setDisabled(2, true);
    const res = await call(app, "GET", "", { cookie });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        { id: 1, name: "Rina", email: "rina@x.example", disabled: false },
        { id: 2, name: "Budi", email: "budi@x.example", disabled: true },
        { id: 3, name: "Maya", email: "maya@x.example", disabled: false },
      ],
      matching: 3,
      total: 3,
      disabled: 1,
    });
  });

  test("honors page, pageSize, and q", async () => {
    const { app, repo, cookie } = setup();
    repo.insertMany(guests);
    const paged = (await (await call(app, "GET", "?page=2&pageSize=2", { cookie })).json()) as {
      items: { name: string }[];
      matching: number;
    };
    expect(paged.items.map((p) => p.name)).toEqual(["Maya", "Agus"]);
    expect(paged.matching).toBe(5);

    const searched = (await (await call(app, "GET", "?q=RINA", { cookie })).json()) as {
      items: { name: string }[];
      matching: number;
      total: number;
    };
    expect(searched.items.map((p) => p.name)).toEqual(["Rina"]);
    expect(searched.matching).toBe(1);
    expect(searched.total).toBe(5);
  });

  test("rejects out-of-range or malformed parameters with 422 invalid_input", async () => {
    const { app, cookie } = setup();
    for (const query of [
      "?page=0",
      "?page=abc",
      "?page=1000001",
      "?pageSize=0",
      "?pageSize=201",
      `?q=${"x".repeat(101)}`,
    ]) {
      const res = await call(app, "GET", query, { cookie });
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "invalid_input" });
    }
  });

  test("a page past the end returns an empty items array, not an error", async () => {
    const { app, repo, cookie } = setup();
    repo.insertMany(guests);
    const res = await call(app, "GET", "?page=999999", { cookie });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { items: unknown[] }).items).toEqual([]);
  });
});

describe("PATCH /api/admin/participants/:id", () => {
  test("disables and enables", async () => {
    const { app, repo, cookie } = setup();
    repo.insertMany(guests.slice(0, 1));
    const off = await call(app, "PATCH", "/1", { cookie, body: { disabled: true } });
    expect(off.status).toBe(200);
    expect(await off.json()).toEqual({ id: 1, name: "Rina", email: "rina@x.example", disabled: true });
    const on = await call(app, "PATCH", "/1", { cookie, body: { disabled: false } });
    expect(((await on.json()) as { disabled: boolean }).disabled).toBe(false);
  });

  test("answers 404 for an unknown id", async () => {
    const { app, cookie } = setup();
    const res = await call(app, "PATCH", "/999", { cookie, body: { disabled: true } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  test("answers 422 for a non-numeric id, a missing body, and a non-boolean value", async () => {
    const { app, repo, cookie } = setup();
    repo.insertMany(guests.slice(0, 1));
    expect((await call(app, "PATCH", "/abc", { cookie, body: { disabled: true } })).status).toBe(422);
    expect((await call(app, "PATCH", "/1", { cookie })).status).toBe(422);
    expect((await call(app, "PATCH", "/1", { cookie, body: { disabled: "yes" } })).status).toBe(422);
  });
});

describe("authentication", () => {
  test("all routes answer 401 without a session, including PATCH with an invalid body", async () => {
    const { app, repo } = setup();
    repo.insertMany(guests.slice(0, 1));
    expect((await call(app, "GET", "")).status).toBe(401);
    expect((await call(app, "PATCH", "/1", { body: { disabled: true } })).status).toBe(401);
    expect((await call(app, "PATCH", "/1", { body: {} })).status).toBe(401);
    expect((await call(app, "PATCH", "/abc", { body: {} })).status).toBe(401);
  });
});

const upload = (app: App, path: string, file?: File, cookie?: string) => {
  const form = new FormData();
  if (file) form.set("file", file);
  return app.handle(
    new Request(`http://localhost/api/admin/participants${path}`, {
      method: "POST",
      headers: cookie ? { cookie } : undefined,
      body: form,
    }),
  );
};

const csvFile = (text: string, name = "guests.csv") => new File([text], name);

const SAMPLE = [
  "name,email",
  "Rina,rina@x.example",
  "Budi,budi@x.example",
  "Rina again,RINA@x.example",
  "Maya,",
  ",noname@x.example",
].join("\n");

describe("POST /import/preview", () => {
  test("returns the counts and stores nothing", async () => {
    const { app, repo, cookie } = setup();
    const res = await upload(app, "/import/preview", csvFile(SAMPLE), cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      fileName: "guests.csv",
      rowsRead: 5,
      valid: 2,
      duplicates: 1,
      problems: [
        { row: 5, reason: "Email is missing" },
        { row: 6, reason: "Name is missing" },
      ],
      problemsTotal: 2,
    });
    expect(repo.list({ q: "", page: 1, pageSize: 10 }).total).toBe(0);
  });

  test("problems is capped at 100 while problemsTotal is the real count", async () => {
    const { app, cookie } = setup();
    const bad = Array.from({ length: 250 }, (_, i) => `Guest ${i},`).join("\n");
    const body = (await (
      await upload(app, "/import/preview", csvFile(`name,email\n${bad}`), cookie)
    ).json()) as { problems: unknown[]; problemsTotal: number; rowsRead: number };
    expect(body.problems).toHaveLength(100);
    expect(body.problemsTotal).toBe(250);
    expect(body.rowsRead).toBe(250);
  });
});

describe("POST /import", () => {
  test("stores the valid rows and returns imported, duplicates, and problemsTotal", async () => {
    const { app, repo, cookie } = setup();
    const res = await upload(app, "/import", csvFile(SAMPLE), cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ imported: 2, duplicates: 1, problemsTotal: 2 });
    expect(repo.list({ q: "", page: 1, pageSize: 10 }).items.map((p) => p.name)).toEqual([
      "Rina",
      "Budi",
    ]);
  });

  test("importing the same file twice makes the second run all duplicates", async () => {
    const { app, repo, cookie } = setup();
    await upload(app, "/import", csvFile(SAMPLE), cookie);
    const second = await upload(app, "/import", csvFile(SAMPLE), cookie);
    expect(await second.json()).toEqual({ imported: 0, duplicates: 3, problemsTotal: 2 });
    expect(repo.list({ q: "", page: 1, pageSize: 10 }).total).toBe(2);
  });

  test("treats emails that differ only in case from stored ones as duplicates", async () => {
    const { app, repo, cookie } = setup();
    repo.insertMany([{ name: "Rina Old", email: "Rina@X.example" }]);
    repo.setDisabled(1, true);
    const res = await upload(app, "/import", csvFile("name,email\nRina New,rina@x.example\n"), cookie);
    expect(await res.json()).toEqual({ imported: 0, duplicates: 1, problemsTotal: 0 });
    const only = repo.list({ q: "", page: 1, pageSize: 10 }).items;
    expect(only).toEqual([{ id: 1, name: "Rina Old", email: "Rina@X.example", disabled: true }]);
  });

  test("a failing insert stores nothing and does not answer 200", async () => {
    const { repo } = setup();
    const broken = {
      ...repo,
      insertMany: () => {
        throw new Error("disk full");
      },
    };
    const app = new Elysia().use(
      createAdminRoutes({ sessionSecret: secret, now: () => 1_000_000 }).use(
        createParticipantsRoutes({ repo: broken }),
      ),
    );
    const cookie = `session=${encodeURIComponent(signSession(1_000_000 + SESSION_TTL_MS, secret))}`;
    const res = await upload(app, "/import", csvFile(SAMPLE), cookie);
    expect(res.status).toBe(500);
    expect(repo.list({ q: "", page: 1, pageSize: 10 }).total).toBe(0);
  });
});

describe("upload rejections", () => {
  test("a file over 5 MiB answers 413 file_too_large", async () => {
    const { app, cookie } = setup();
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.csv");
    for (const path of ["/import/preview", "/import"]) {
      const res = await upload(app, path, big, cookie);
      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({ error: "file_too_large" });
    }
  });

  test("a binary .csv, a .txt file, and a truncated .xlsx answer 422 unsupported_file", async () => {
    const { app, cookie } = setup();
    const files = [
      new File([new Uint8Array([0, 1, 2, 0xff, 0xfe])], "guests.csv"),
      csvFile("name,email\nRina,r@x.example\n", "notes.txt"),
      new File([new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3])], "guests.xlsx"),
    ];
    for (const file of files) {
      const res = await upload(app, "/import/preview", file, cookie);
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "unsupported_file" });
    }
  });

  test("a file without an email header answers 422 missing_columns", async () => {
    const { app, cookie } = setup();
    const res = await upload(app, "/import/preview", csvFile("name,mail\nRina,r@x.example\n"), cookie);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "missing_columns" });
  });

  test("a request without a file answers 422 invalid_input", async () => {
    const { app, cookie } = setup();
    for (const path of ["/import/preview", "/import"]) {
      const res = await upload(app, path, undefined, cookie);
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "invalid_input" });
    }
  });

  test("no session answers 401 for both endpoints, including an invalid body", async () => {
    const { app } = setup();
    for (const path of ["/import/preview", "/import"]) {
      expect((await upload(app, path, csvFile(SAMPLE))).status).toBe(401);
      expect((await upload(app, path)).status).toBe(401);
    }
  });
});

describe("POST /api/admin/participants", () => {
  test("adds a participant, trimmed, and it shows up in the list", async () => {
    const { app, repo, cookie } = setup();
    const res = await call(app, "POST", "", {
      cookie,
      body: { name: "  Rina Pratama ", email: " rina@x.example  " },
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: 1,
      name: "Rina Pratama",
      email: "rina@x.example",
      disabled: false,
    });
    expect(repo.list({ q: "", page: 1, pageSize: 10 }).total).toBe(1);
  });

  test("answers 409 email_taken for an email that exists in any case and leaves the old one alone", async () => {
    const { app, repo, cookie } = setup();
    repo.insertMany([{ name: "Rina Old", email: "Rina@X.example" }]);
    const res = await call(app, "POST", "", {
      cookie,
      body: { name: "Rina New", email: "rina@x.example" },
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "email_taken" });
    expect(repo.list({ q: "", page: 1, pageSize: 10 }).items.map((p) => p.name)).toEqual(["Rina Old"]);
  });

  test("answers 422 invalid_input for a missing, too long, or malformed name or email", async () => {
    const { app, repo, cookie } = setup();
    const bodies: unknown[] = [
      {},
      { name: "Rina" },
      { email: "rina@x.example" },
      { name: "", email: "rina@x.example" },
      { name: "   ", email: "rina@x.example" },
      { name: "x".repeat(201), email: "rina@x.example" },
      { name: "Rina", email: "" },
      { name: "Rina", email: "not-an-email" },
      { name: "Rina", email: `${"a".repeat(245)}@x.example` },
      { name: 12345, email: "rina@x.example" },
      { name: "Rina", email: ["rina@x.example"] },
    ];
    for (const body of bodies) {
      const res = await call(app, "POST", "", { cookie, body });
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "invalid_input" });
    }
    expect(repo.list({ q: "", page: 1, pageSize: 10 }).total).toBe(0);
  });

  test("keeps formula-like and non-Latin text as it is", async () => {
    const { app, cookie } = setup();
    const res = await call(app, "POST", "", {
      cookie,
      body: { name: "=1+1 山田 太郎", email: "yamada@x.example" },
    });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { name: string }).name).toBe("=1+1 山田 太郎");
  });

  test("answers 401 without a session, including for an invalid or malformed body", async () => {
    const { app, repo } = setup();
    expect((await call(app, "POST", "", { body: { name: "Rina", email: "rina@x.example" } })).status).toBe(401);
    expect((await call(app, "POST", "", { body: {} })).status).toBe(401);
    expect((await call(app, "POST", "", { rawBody: "{not json" })).status).toBe(401);
    expect(repo.list({ q: "", page: 1, pageSize: 10 }).total).toBe(0);
  });
});
