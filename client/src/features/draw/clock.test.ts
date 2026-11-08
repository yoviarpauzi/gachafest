import { describe, expect, test } from "bun:test";
import { elapsedMs } from "./clock";

const serverNow = "2026-11-09T10:00:05.000Z";
const revealedAt = "2026-11-09T10:00:00.000Z";

describe("elapsedMs", () => {
  test("is the server's time since the reveal at the moment the answer arrived", () => {
    expect(elapsedMs({ serverNow, revealedAt, fetchedAt: 1000, clientNow: 1000 })).toBe(5000);
  });

  test("grows with the time since the answer, measured on the browser's own clock", () => {
    expect(elapsedMs({ serverNow, revealedAt, fetchedAt: 1000, clientNow: 1500 })).toBe(5500);
  });

  test("does not depend on how far the browser's clock is from the server's", () => {
    expect(elapsedMs({ serverNow, revealedAt, fetchedAt: 9_000_000, clientNow: 9_000_500 })).toBe(5500);
  });

  test("is never negative", () => {
    expect(
      elapsedMs({ serverNow: revealedAt, revealedAt: serverNow, fetchedAt: 1000, clientNow: 1000 }),
    ).toBe(0);
  });
});
