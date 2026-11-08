import { describe, expect, test } from "bun:test";
import { scheduleFor, stageAt } from "./timing";

describe("scheduleFor", () => {
  // The totals mirror ANIMATION_MS on the server (8000 premium, 4000 basic).
  test("premium runs 8 seconds with a 4 second reel", () => {
    expect(scheduleFor("premium")).toEqual({ reelEnd: 4000, starEnd: 5200, flashEnd: 6400, total: 8000 });
  });

  test("basic runs 4 seconds with a 2 second reel", () => {
    expect(scheduleFor("basic")).toEqual({ reelEnd: 2000, starEnd: 2600, flashEnd: 3300, total: 4000 });
  });
});

describe("stageAt", () => {
  test.each([
    [-5, "reel"],
    [0, "reel"],
    [3999, "reel"],
    [4000, "star"],
    [5199, "star"],
    [5200, "flash"],
    [6399, "flash"],
    [6400, "plate"],
    [7999, "plate"],
    [8000, "done"],
    [99999, "done"],
  ] as const)("premium at %d ms is %s", (elapsed, stage) => {
    expect(stageAt("premium", elapsed)).toBe(stage);
  });

  test.each([
    [1999, "reel"],
    [2000, "star"],
    [2599, "star"],
    [2600, "flash"],
    [3299, "flash"],
    [3300, "plate"],
    [3999, "plate"],
    [4000, "done"],
  ] as const)("basic at %d ms is %s", (elapsed, stage) => {
    expect(stageAt("basic", elapsed)).toBe(stage);
  });
});
