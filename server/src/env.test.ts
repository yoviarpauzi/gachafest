import { describe, expect, test } from "bun:test";
import { parseEnv } from "./env";

const secret32 = "s".repeat(32);

describe("parseEnv", () => {
  test("accepts valid env", () => {
    const env = parseEnv({ ADMIN_PASSWORD: "hunter2", SESSION_SECRET: secret32 });
    expect(env).toEqual({ ADMIN_PASSWORD: "hunter2", SESSION_SECRET: secret32 });
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

  test("accepts SESSION_SECRET of exactly 32 chars", () => {
    expect(() => parseEnv({ ADMIN_PASSWORD: "hunter2", SESSION_SECRET: secret32 })).not.toThrow();
  });
});
