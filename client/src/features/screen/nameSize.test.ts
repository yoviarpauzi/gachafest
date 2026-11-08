import { describe, expect, test } from "bun:test";
import { estimateWidthEm, fitBox, fitMax, nameFontSize } from "./nameSize";

const WIDTH = 860;
// A fixed measure, so the numbers below do not depend on how the estimate is tuned: 0.62 em per character.
const m = (text: string) => text.length * 0.62;

describe("estimateWidthEm", () => {
  // Widths measured for Montserrat 800 in a browser: ALL CAPS up to 0.735 em per character, mixed case up to 0.68.
  test("is not below the measured width of ALL CAPS names", () => {
    expect(estimateWidthEm("MUHAMMAD RIZKY")).toBeGreaterThanOrEqual(14 * 0.735);
    expect(estimateWidthEm("BUDI SANTOSO")).toBeGreaterThanOrEqual(12 * 0.684);
  });

  test("is not below the measured width of mixed-case names", () => {
    expect(estimateWidthEm("Muhammad Rizky Ramadhan")).toBeGreaterThanOrEqual(23 * 0.679);
  });

  test("grows with every character", () => {
    expect(estimateWidthEm("ab")).toBeGreaterThan(estimateWidthEm("a"));
  });
});

describe("nameFontSize", () => {
  test("a short name fits on one line at a large size", () => {
    expect(nameFontSize("Rina Pratama", WIDTH, m)).toEqual({ fontSize: 115, lines: 1 });
  });

  test("a one-character name is capped at 120 px", () => {
    expect(nameFontSize("A", WIDTH, m)).toEqual({ fontSize: 120, lines: 1 });
  });

  test("a name too wide for one line at 64 px takes two lines at 64 px", () => {
    expect(nameFontSize("Maria Fernanda Gonzales y", WIDTH, m)).toEqual({ fontSize: 64, lines: 2 });
  });

  test("a 200-character name takes three lines at the smallest size", () => {
    expect(nameFontSize("x".repeat(200), WIDTH, m)).toEqual({ fontSize: 24, lines: 3 });
  });

  test("the size never grows when the name gets longer", () => {
    let previous = Infinity;
    for (let length = 1; length <= 200; length++) {
      const { fontSize } = nameFontSize("x".repeat(length), WIDTH, m);
      expect(fontSize).toBeLessThanOrEqual(previous);
      previous = fontSize;
    }
  });

  test("a wider window allows a bigger size for the same name", () => {
    expect(nameFontSize("Rina Pratama", 600, m).fontSize).toBeLessThan(nameFontSize("Rina Pratama", WIDTH, m).fontSize);
  });

  // The bug a reviewer found: with the old fixed 0.62 em, "MUHAMMAD RIZKY" got one line at 94 px that is
  // about 950 px wide in an 876 px box. Whatever the names, a one-line answer must fit the width.
  test.each(["MUHAMMAD RIZKY", "BUDI SANTOSO", "Muhammad Rizky Ramadhan", "SITI NURHALIZA PUTRI", "I Gusti Ngurah Bagus"])(
    "a one-line answer for %s fits the box with the default estimate",
    (name) => {
      const { fontSize, lines } = nameFontSize(name, 876);
      if (lines === 1) expect(fontSize * estimateWidthEm(name)).toBeLessThanOrEqual(876);
      else expect(fontSize * estimateWidthEm(name) * 1.08).toBeLessThanOrEqual(lines * 876 + 1);
    },
  );
});

describe("fitBox", () => {
  const ribbon = { width: 700, height: 140, maxSize: 70 };
  const hero = { width: 1100, height: 230, maxSize: 132 };

  test("a short text stays on one line", () => {
    expect(fitBox("Dinner untuk 2 orang", ribbon, m)).toEqual({ fontSize: 56, lines: 1 });
    expect(fitBox("Staycation 1 malam", hero, m)).toEqual({ fontSize: 98, lines: 1 });
  });

  test("never goes above the maximum size", () => {
    expect(fitBox("A", ribbon, m)).toEqual({ fontSize: 70, lines: 1 });
  });

  test("a long prize name takes two lines instead of shrinking to one tiny line", () => {
    const name = "Weekend getaway 3 hari 2 malam (GRAND PRIZE)";
    expect(fitBox(name, ribbon, m)).toEqual({ fontSize: 47, lines: 2 });
    expect(fitBox(name, hero, m)).toEqual({ fontSize: 74, lines: 2 });
  });

  test("a 60-character name takes three lines", () => {
    expect(fitBox("x".repeat(60), ribbon, m)).toEqual({ fontSize: 42, lines: 3 });
  });

  test("an absurdly long text still gets a size and lines, never below 20 px", () => {
    const fit = fitBox("x".repeat(200), ribbon, m);
    expect(fit.lines).toBe(3);
    expect(fit.fontSize).toBeGreaterThanOrEqual(20);
  });

  test("the block never grows taller than the box", () => {
    for (let length = 1; length <= 200; length++) {
      const { fontSize, lines } = fitBox("x".repeat(length), ribbon, m);
      if (fontSize > 20) expect(fontSize * lines * 1.1).toBeLessThanOrEqual(ribbon.height + 1);
    }
  });
});

describe("fitMax", () => {
  // One slot of the reel: 640 px wide and 87 px high, never above 85 px.
  const slot = { width: 640, height: 87, maxSize: 85 };

  test("a short name is one line at the full size", () => {
    expect(fitMax("Rina Pratama", slot, m)).toEqual({ fontSize: 85, lines: 1 });
  });

  test("a name of about 20 characters stays on one line, smaller", () => {
    expect(fitMax("Siti Nurhaliza Putri", slot, m)).toEqual({ fontSize: 51, lines: 1 });
  });

  test("a longer name takes two lines that still fit the slot", () => {
    expect(fitMax("x".repeat(30), slot, m)).toEqual({ fontSize: 39, lines: 2 });
  });

  test("a 200-character name takes four lines in the slot", () => {
    expect(fitMax("x".repeat(200), slot, m)).toEqual({ fontSize: 19, lines: 4 });
  });

  // The other bug a reviewer found: a two-line name at 64 px is 141 px tall in an 87 px slot and runs over its
  // neighbours. Whatever the length, the block must fit the slot, so names never overlap.
  test("the text block is never taller than the slot, for any length", () => {
    for (let length = 1; length <= 200; length++) {
      const { fontSize, lines } = fitMax("x".repeat(length), slot, m);
      // One line takes the whole slot as its line box; several lines are 1.1 times their size each.
      expect(lines === 1 ? fontSize : fontSize * lines * 1.1).toBeLessThanOrEqual(slot.height + 1);
    }
  });

  test("with the default estimate a one-line answer fits the slot width", () => {
    for (const name of ["MUHAMMAD RIZKY", "Siti Nurhaliza Putri", "BUDI SANTOSO", "Rina Pratama"]) {
      const { fontSize, lines } = fitMax(name, slot);
      if (lines === 1) expect(fontSize * estimateWidthEm(name)).toBeLessThanOrEqual(slot.width);
    }
  });
});
