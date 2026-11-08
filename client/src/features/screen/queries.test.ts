import { describe, expect, test } from "bun:test";
import { SCREEN_POLL_MS, SCREEN_RETRY_MS } from "./queries";

describe("how often the screen asks", () => {
  // The screen learns about a draw only when it asks, and the reel of a basic prize spins for 2 seconds, most of
  // its distance in the first half. Measured on real draws: with a 1.5 s poll the first frame the audience saw was
  // 0.2 to 1.3 s into the reveal, and for basic prizes 84% of the spin was already over. The poll must be short.
  test("polls often enough that the audience sees the reel from nearly the start", () => {
    expect(SCREEN_POLL_MS).toBeLessThanOrEqual(500);
  });

  test("a failing server is not asked every poll", () => {
    expect(SCREEN_RETRY_MS).toBeGreaterThanOrEqual(1000);
  });
});
