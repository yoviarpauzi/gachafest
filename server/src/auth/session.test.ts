import { describe, expect, test } from "bun:test";
import { signSession, verifySession } from "./session";

const secret = "k".repeat(32);

describe("session tokens", () => {
  test("valid token verifies before expiry", () => {
    const token = signSession(1_000, secret);
    expect(verifySession(token, secret, 999)).toBe(true);
  });

  test("token is invalid at now === expiresAt", () => {
    const token = signSession(1_000, secret);
    expect(verifySession(token, secret, 1_000)).toBe(false);
    expect(verifySession(token, secret, 1_001)).toBe(false);
  });

  test("changing the expiry digits invalidates", () => {
    const [, digest] = signSession(1_000, secret).split(":");
    expect(verifySession(`9999999:${digest}`, secret, 999)).toBe(false);
  });

  test("wrong secret invalidates", () => {
    const token = signSession(1_000, secret);
    expect(verifySession(token, "x".repeat(32), 999)).toBe(false);
  });

  test("malformed input returns false and never throws", () => {
    const hex64 = "a".repeat(64);
    const inputs: unknown[] = [
      undefined,
      "",
      "abc",
      "123:",
      ":abc",
      "12:zz",
      "1e3:abc",
      `-5:${hex64}`,
      123,
      {},
    ];
    for (const input of inputs) {
      expect(() => verifySession(input, secret, 0)).not.toThrow();
      expect(verifySession(input, secret, 0)).toBe(false);
    }
  });
});
