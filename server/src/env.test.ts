import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "./env";

const secret32 = "s".repeat(32);

describe("parseEnv", () => {
  test("accepts valid env", () => {
    const env = parseEnv({ ADMIN_PASSWORD: "hunter2", SESSION_SECRET: secret32 });
    expect(env).toEqual({
      ADMIN_PASSWORD: "hunter2",
      SESSION_SECRET: secret32,
      DATABASE_PATH: "data/gachafest.db",
    });
  });

  test("uses the given DATABASE_PATH", () => {
    const env = parseEnv({
      ADMIN_PASSWORD: "hunter2",
      SESSION_SECRET: secret32,
      DATABASE_PATH: "/tmp/other.db",
    });
    expect(env.DATABASE_PATH).toBe("/tmp/other.db");
  });

  test("throws naming DATABASE_PATH when empty", () => {
    expect(() =>
      parseEnv({ ADMIN_PASSWORD: "hunter2", SESSION_SECRET: secret32, DATABASE_PATH: "" }),
    ).toThrow(/DATABASE_PATH/);
  });

  test("throws naming ADMIN_PASSWORD when missing or empty", () => {
    expect(() => parseEnv({ SESSION_SECRET: secret32 })).toThrow(/ADMIN_PASSWORD/);
    expect(() => parseEnv({ ADMIN_PASSWORD: "", SESSION_SECRET: secret32 })).toThrow(
      /ADMIN_PASSWORD/,
    );
  });

  test("throws naming SESSION_SECRET when 31 chars", () => {
    expect(() =>
      parseEnv({ ADMIN_PASSWORD: "hunter2", SESSION_SECRET: "s".repeat(31) }),
    ).toThrow(/SESSION_SECRET/);
  });

  test("the .env.example file parses once its required values are filled in", () => {
    const source: Record<string, string> = {};
    for (const line of readFileSync(join(import.meta.dir, "../.env.example"), "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const at = trimmed.indexOf("=");
      source[trimmed.slice(0, at)] = trimmed.slice(at + 1);
    }
    source.ADMIN_PASSWORD ||= "hunter2";
    source.SESSION_SECRET ||= secret32;
    expect(() => parseEnv(source)).not.toThrow();
  });

  test("accepts SESSION_SECRET of exactly 32 chars", () => {
    expect(() => parseEnv({ ADMIN_PASSWORD: "hunter2", SESSION_SECRET: secret32 })).not.toThrow();
  });
});
