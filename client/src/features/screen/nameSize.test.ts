import { describe, expect, test } from "bun:test";
import { fitBox, nameFontSize } from "./nameSize";

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

describe("fitBox", () => {
  const ribbon = { width: 700, height: 140, maxSize: 70 };
  const hero = { width: 1100, height: 230, maxSize: 132 };

  test("a short text stays on one line", () => {
    expect(fitBox("Dinner untuk 2 orang", ribbon)).toEqual({ fontSize: 56, lines: 1 });
    expect(fitBox("Staycation 1 malam", hero)).toEqual({ fontSize: 98, lines: 1 });
  });

  test("never goes above the maximum size", () => {
    expect(fitBox("A", ribbon)).toEqual({ fontSize: 70, lines: 1 });
  });

  test("a long prize name takes two lines instead of shrinking to one tiny line", () => {
    const name = "Weekend getaway 3 hari 2 malam (GRAND PRIZE)";
    expect(fitBox(name, ribbon)).toEqual({ fontSize: 51, lines: 2 });
    expect(fitBox(name, hero)).toEqual({ fontSize: 80, lines: 2 });
  });

  test("a 60-character name takes three lines", () => {
    expect(fitBox("x".repeat(60), ribbon)).toEqual({ fontSize: 42, lines: 3 });
  });

  test("an absurdly long text still gets a size and lines, never below 20 px", () => {
    const fit = fitBox("x".repeat(200), ribbon);
    expect(fit.lines).toBe(3);
    expect(fit.fontSize).toBeGreaterThanOrEqual(20);
  });

  test("the block never grows taller than the box", () => {
    for (let length = 1; length <= 200; length++) {
      const { fontSize, lines } = fitBox("x".repeat(length), ribbon);
      if (fontSize > 20) expect(fontSize * lines * 1.1).toBeLessThanOrEqual(ribbon.height + 1);
    }
  });
});
