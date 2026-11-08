import { describe, expect, test } from "bun:test";
import { announce } from "./announce";

const prize = { name: "Grand Prize", value: 10_000_000, tier: "premium" as const, position: 1, total: 4 };

describe("announce", () => {
  test.each(["reel", "flash"] as const)("says the draw is under way while the stage is %s", (stage) => {
    expect(announce({ stage, prize, winnerName: "Rina Pratama" })).toBe("Drawing for Grand Prize");
  });

  test.each(["plate", "done"] as const)("names the winner from the stage %s on", (stage) => {
    expect(announce({ stage, prize, winnerName: "Rina Pratama" })).toBe("Rina Pratama wins Grand Prize");
  });

  test("works without a prize", () => {
    expect(announce({ stage: "reel", prize: null, winnerName: "Rina Pratama" })).toBe("Drawing");
    expect(announce({ stage: "done", prize: null, winnerName: "Rina Pratama" })).toBe("Rina Pratama wins");
  });

  test("never speaks the winner's name before the plate", () => {
    expect(announce({ stage: "flash", prize, winnerName: "Rina Pratama" })).not.toContain("Rina");
  });
});
