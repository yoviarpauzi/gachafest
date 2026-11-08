import { describe, expect, test } from "bun:test";
import { nameFontSize } from "./nameSize";

const WIDTH = 860;

describe("nameFontSize", () => {
  test("a short name fits on one line at a large size", () => {
    expect(nameFontSize("Rina Pratama", WIDTH)).toEqual({ fontSize: 115, lines: 1 });
  });

  test("a one-character name is capped at 120 px", () => {
    expect(nameFontSize("A", WIDTH)).toEqual({ fontSize: 120, lines: 1 });
  });

  test("a name too wide for one line at 64 px takes two lines at 64 px", () => {
    expect(nameFontSize("Maria Fernanda Gonzales y", WIDTH)).toEqual({ fontSize: 64, lines: 2 });
  });

  test("a 200-character name takes three lines at the smallest size", () => {
    expect(nameFontSize("x".repeat(200), WIDTH)).toEqual({ fontSize: 24, lines: 3 });
  });

  test("the size never grows when the name gets longer", () => {
    let previous = Infinity;
    for (let length = 1; length <= 200; length++) {
      const { fontSize } = nameFontSize("x".repeat(length), WIDTH);
      expect(fontSize).toBeLessThanOrEqual(previous);
      previous = fontSize;
    }
  });

  test("a wider window allows a bigger size for the same name", () => {
    expect(nameFontSize("Rina Pratama", 600).fontSize).toBeLessThan(nameFontSize("Rina Pratama", WIDTH).fontSize);
  });
});
