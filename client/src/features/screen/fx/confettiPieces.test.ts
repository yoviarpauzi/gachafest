import { describe, expect, test } from "bun:test";
import { makeConfetti } from "./confettiPieces";

describe("makeConfetti", () => {
  test("the same seed gives the same pieces, so two screens show the same confetti", () => {
    expect(makeConfetti("2026-11-09T10:00:00.000Z", 80)).toEqual(makeConfetti("2026-11-09T10:00:00.000Z", 80));
  });

  test("a different seed gives different pieces", () => {
    expect(makeConfetti("a", 80)).not.toEqual(makeConfetti("b", 80));
  });

  test("gives as many pieces as asked", () => {
    expect(makeConfetti("a", 80)).toHaveLength(80);
    expect(makeConfetti("a", 0)).toEqual([]);
  });

  test("every piece starts inside the stage and within the first 1.2 seconds", () => {
    for (const piece of makeConfetti("a", 200)) {
      expect(piece.x).toBeGreaterThanOrEqual(0);
      expect(piece.x).toBeLessThanOrEqual(1920);
      expect(piece.delay).toBeGreaterThanOrEqual(0);
      expect(piece.delay).toBeLessThanOrEqual(1.2);
      expect(["gold", "cream", "bronze"]).toContain(piece.tone);
    }
  });
});
