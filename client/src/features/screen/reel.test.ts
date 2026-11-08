import { describe, expect, test } from "bun:test";
import { MIN_STRIP, buildReelStrip } from "./reel";

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
