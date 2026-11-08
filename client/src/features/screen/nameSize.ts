/** Width of a text in em (a width of 1 is the font size), as measured or estimated for the font on screen. */
export type Measure = (text: string) => number;

// Widths of Montserrat ExtraBold per character in em, rounded up so the estimate is never too small: measured
// in a browser, ALL CAPS names run to 0.74 em per character and mixed case to 0.68. A name that is too wide
// is cut off on the projector, which is worse than one that is a little too small.
const UPPER = 0.82;
const LOWER = 0.72;
const DIGIT = 0.72;
const SPACE = 0.3;
const OTHER = 0.7;

/** The fallback when the font cannot be measured (tests, or before it has loaded). Deliberately on the wide side. */
export const estimateWidthEm: Measure = (text) => {
  let width = 0;
  for (const char of text) {
    if (char === " ") width += SPACE;
    else if (/\p{Lu}/u.test(char)) width += UPPER;
    else if (/\p{Ll}/u.test(char)) width += LOWER;
    else if (/\p{Nd}/u.test(char)) width += DIGIT;
    else width += OTHER;
  }
  return width;
};

// Text that wraps never fills its lines completely (a word does not fit, so it moves down).
const WRAP_WASTE = 1.08;

const MAX_SIZE = 120;
const READABLE_SIZE = 64;
const MIN_SIZE = 24;

/**
 * Font size and line count for a name in a space `maxWidth` px wide. One line while it stays at 64 px or more
 * (never above 120 px), then two lines at 64 px, and only for names that are not realistic three lines at a
 * size that shrinks to fit. A name is never cut off.
 */
export function nameFontSize(
  name: string,
  maxWidth: number,
  measure: Measure = estimateWidthEm,
): { fontSize: number; lines: 1 | 2 | 3 } {
  const widthEm = Math.max(measure(name), 0.01);

  const oneLine = Math.floor(maxWidth / widthEm);
  if (oneLine >= READABLE_SIZE) return { fontSize: Math.min(MAX_SIZE, oneLine), lines: 1 };

  if (widthEm * READABLE_SIZE * WRAP_WASTE <= 2 * maxWidth) return { fontSize: READABLE_SIZE, lines: 2 };

  const three = Math.floor((3 * maxWidth) / (WRAP_WASTE * widthEm));
  return { fontSize: Math.max(MIN_SIZE, Math.min(READABLE_SIZE, three)), lines: 3 };
}

const LINE_HEIGHT = 1.1;
const ABSOLUTE_MIN = 20;

/** The largest size that fits `lines` lines of `widthEm` wide text in the box, line height included. */
function sizeFor(lines: number, widthEm: number, box: { width: number; height: number; maxSize: number }, lineHeight: number) {
  return Math.min(
    box.maxSize,
    Math.floor((lines * box.width) / (widthEm * (lines > 1 ? WRAP_WASTE : 1))),
    Math.floor(box.height / (lines * lineHeight)),
  );
}

/**
 * Font size and line count for a text that has to fit a box of `width` by `height` px, never above `maxSize`.
 * Fewer lines are better as long as the size stays at 55% of the maximum or more; a long prize name then
 * takes two lines at a good size instead of one line too small to read from the back of the room. The block
 * never grows taller than `height`, and the size never goes under 20 px.
 */
export function fitBox(
  text: string,
  box: { width: number; height: number; maxSize: number },
  measure: Measure = estimateWidthEm,
): { fontSize: number; lines: 1 | 2 | 3 } {
  const widthEm = Math.max(measure(text), 0.01);
  const options = ([1, 2, 3] as const).map((lines) => ({ lines, fontSize: sizeFor(lines, widthEm, box, LINE_HEIGHT) }));

  const good = options.find((option) => option.fontSize >= box.maxSize * 0.55);
  const best = good ?? options.reduce((a, b) => (b.fontSize > a.fontSize ? b : a));
  return { fontSize: Math.max(ABSOLUTE_MIN, best.fontSize), lines: best.lines };
}

const REEL_MIN = 12;

/**
 * For one slot of the reel (a fixed `height`, so a name can never run into the next one): the line count, up to
 * four, that gives the largest size. A single line uses the whole slot as its line box; several lines take
 * 1.1 times their size each. Ties go to fewer lines.
 */
export function fitMax(
  text: string,
  box: { width: number; height: number; maxSize: number },
  measure: Measure = estimateWidthEm,
): { fontSize: number; lines: 1 | 2 | 3 | 4 } {
  const widthEm = Math.max(measure(text), 0.01);
  const options = ([1, 2, 3, 4] as const).map((lines) => ({
    lines,
    fontSize: sizeFor(lines, widthEm, box, lines === 1 ? 1 : LINE_HEIGHT),
  }));
  const best = options.reduce((a, b) => (b.fontSize > a.fontSize ? b : a));
  return { fontSize: Math.max(REEL_MIN, best.fontSize), lines: best.lines };
}
