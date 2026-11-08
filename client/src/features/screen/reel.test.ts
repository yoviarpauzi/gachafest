import { describe, expect, test } from "bun:test";
import { MIN_STRIP, NEIGHBOR_SCALE, REEL_KNEE, buildReelStrip, emphasis, reelEase, stripLengthFor } from "./reel";

const names = (n: number) => Array.from({ length: n }, (_, i) => `Guest ${i + 1}`);

describe("buildReelStrip", () => {
  test("ends on the winner", () => {
    expect(buildReelStrip(["Ana", "Budi"], "Citra").at(-1)).toBe("Citra");
    expect(buildReelStrip(names(50), "Citra").at(-1)).toBe("Citra");
  });

  test("a short reel is repeated in server order up to the minimum length", () => {
    const strip = buildReelStrip(["a", "b", "c"], "W");
    expect(strip.length).toBeGreaterThanOrEqual(MIN_STRIP);
    expect(strip.slice(0, 7)).toEqual(["a", "b", "c", "a", "b", "c", "a"]);
  });

  test("a reel of 38 names gives exactly the minimum length", () => {
    expect(buildReelStrip(names(38), "W")).toHaveLength(MIN_STRIP);
  });

  test("a full reel of 50 names is used as it is, then the winner", () => {
    const reel = names(50);
    const strip = buildReelStrip(reel, "W");
    expect(strip).toHaveLength(51);
    expect(strip.slice(0, 50)).toEqual(reel);
  });

  test("an empty reel gives just the winner", () => {
    expect(buildReelStrip([], "W")).toEqual(["W"]);
  });

  test("a one-name reel reaches the minimum length", () => {
    const strip = buildReelStrip(["only"], "W");
    expect(strip).toHaveLength(MIN_STRIP);
    expect(strip.at(-1)).toBe("W");
  });

  test("does not change its input", () => {
    const reel = ["a", "b"];
    buildReelStrip(reel, "W");
    expect(reel).toEqual(["a", "b"]);
  });

  test("gives the same strip for the same input, so two screens agree", () => {
    expect(buildReelStrip(names(7), "W")).toEqual(buildReelStrip(names(7), "W"));
  });
});

describe("emphasis", () => {
  test("the name in the middle of the window is full size and fully dark", () => {
    expect(emphasis(0)).toEqual({ scale: 1, t: 0 });
  });

  test("a name one line away is the smaller, faded size from the design", () => {
    expect(emphasis(1)).toEqual({ scale: NEIGHBOR_SCALE, t: 1 });
    expect(NEIGHBOR_SCALE).toBeCloseTo(67.2 / 102, 2);
  });

  test("above or below the middle makes no difference", () => {
    expect(emphasis(-1)).toEqual(emphasis(1));
  });

  test("names further out stay at the neighbour look", () => {
    expect(emphasis(3)).toEqual({ scale: NEIGHBOR_SCALE, t: 1 });
  });

  test("a name halfway between two lines is halfway between the two looks", () => {
    const half = emphasis(0.5);
    expect(half.t).toBe(0.5);
    expect(half.scale).toBeCloseTo((1 + NEIGHBOR_SCALE) / 2, 5);
  });
});

describe("buildReelStrip with a longer strip", () => {
  test("a faster spin gets a longer strip, still ending on the winner", () => {
    const strip = buildReelStrip(["a", "b", "c"], "W", 67);
    expect(strip).toHaveLength(67);
    expect(strip.at(-1)).toBe("W");
  });
});

describe("stripLengthFor", () => {
  test("a 4 second reel needs about 18 names a second, a short one never less than the minimum", () => {
    expect(stripLengthFor(4000)).toBe(67);
    expect(stripLengthFor(1900)).toBe(MIN_STRIP);
    expect(stripLengthFor(0)).toBe(MIN_STRIP);
  });
});

// The reel turns at one speed while the star falls and brakes only for the last part, so the star is seen over a
// reel that is really spinning (a reel that slows down from the first moment is almost still when the star comes).
describe("reelEase", () => {
  test("starts at 0 and ends at 1", () => {
    expect(reelEase(0)).toBe(0);
    expect(reelEase(1)).toBeCloseTo(1, 10);
  });

  test("never goes backwards", () => {
    let previous = 0;
    for (let i = 1; i <= 1000; i++) {
      const value = reelEase(i / 1000);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  test("covers 90% of the distance at a constant speed before it brakes", () => {
    expect(reelEase(REEL_KNEE)).toBeCloseTo(0.9, 6);
    expect(reelEase(REEL_KNEE / 2)).toBeCloseTo(0.45, 6);
  });

  test("the speed does not jump where the braking starts", () => {
    const e = 1e-6;
    const before = (reelEase(REEL_KNEE - e) - reelEase(REEL_KNEE - 2 * e)) / e;
    const after = (reelEase(REEL_KNEE + 2 * e) - reelEase(REEL_KNEE + e)) / e;
    expect(Math.abs(after - before) / before).toBeLessThan(0.01);
  });

  test("comes to a standstill at the end", () => {
    expect(reelEase(1) - reelEase(0.999)).toBeLessThan(0.0002);
  });
});
