import { describe, expect, test } from "bun:test";
import { scheduleFor, stageAt } from "./timing";

describe("scheduleFor", () => {
  // The totals mirror ANIMATION_MS on the server (8000 premium, 4000 basic).
  test("premium runs 8 seconds, the star lands at 3.5 s and the reel stops at 4 s under the white", () => {
    expect(scheduleFor("premium")).toEqual({ starStart: 2300, impact: 3500, reelEnd: 4000, flashEnd: 4700, total: 8000 });
  });

  test("basic runs 4 seconds, the star lands at 1.5 s and the reel stops at 1.9 s under the white", () => {
    expect(scheduleFor("basic")).toEqual({ starStart: 1000, impact: 1500, reelEnd: 1900, flashEnd: 2300, total: 4000 });
  });

  // The star is part of the spin, not something that comes after it, and it does not land at the very moment the
  // reel stops: it lands while the reel is still turning, and the reel finishes under the white of the impact. So
  // the winner is never seen settled in the window before the plate.
  test.each(["premium", "basic"] as const)("the %s star falls over a spinning reel and lands before the reel stops", (tier) => {
    const schedule = scheduleFor(tier);
    expect(schedule.starStart).toBeGreaterThan(0);
    expect(schedule.starStart).toBeLessThan(schedule.impact);
    expect(schedule.impact).toBeLessThan(schedule.reelEnd);
  });

  test.each(["premium", "basic"] as const)("the %s reel has stopped before the white starts to clear", (tier) => {
    const schedule = scheduleFor(tier);
    expect(schedule.reelEnd).toBeLessThanOrEqual(schedule.flashEnd);
    expect(schedule.flashEnd).toBeLessThan(schedule.total);
  });

  test("the screen stays white for at least a second (premium) or most of a second (basic)", () => {
    const premium = scheduleFor("premium");
    const basic = scheduleFor("basic");
    expect(premium.flashEnd - premium.impact).toBeGreaterThanOrEqual(1000);
    expect(basic.flashEnd - basic.impact).toBeGreaterThanOrEqual(700);
  });

  test("the reel spins at most 4 seconds (premium) and 2 seconds (basic)", () => {
    expect(scheduleFor("premium").reelEnd).toBeLessThanOrEqual(4000);
    expect(scheduleFor("basic").reelEnd).toBeLessThanOrEqual(2000);
  });
});

describe("stageAt", () => {
  test.each([
    [-5, "reel"],
    [0, "reel"],
    [3499, "reel"],
    [3500, "flash"],
    [4699, "flash"],
    [4700, "plate"],
    [7999, "plate"],
    [8000, "done"],
    [99999, "done"],
  ] as const)("premium at %d ms is %s", (elapsed, stage) => {
    expect(stageAt("premium", elapsed)).toBe(stage);
  });

  test.each([
    [1499, "reel"],
    [1500, "flash"],
    [2299, "flash"],
    [2300, "plate"],
    [3999, "plate"],
    [4000, "done"],
  ] as const)("basic at %d ms is %s", (elapsed, stage) => {
    expect(stageAt("basic", elapsed)).toBe(stage);
  });
});
