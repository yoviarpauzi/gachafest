/** How wide one character is, as a share of the font size. A measured average for Montserrat Black. */
export const WIDTH_FACTOR = 0.62;

const MAX_SIZE = 120;
const READABLE_SIZE = 64;
const MIN_SIZE = 24;

/**
 * Font size and line count for a name in a space `maxWidth` px wide. One line while it stays at 64 px or more
 * (never above 120 px), then two lines at 64 px, and only for names that are not realistic (over about 43
 * characters) three lines at a size that shrinks to fit. A name is never cut off.
 */
export function nameFontSize(name: string, maxWidth: number): { fontSize: number; lines: 1 | 2 | 3 } {
  const perLine = (lines: number) => Math.floor((lines * maxWidth) / (WIDTH_FACTOR * name.length));

  const oneLine = perLine(1);
  if (oneLine >= READABLE_SIZE) return { fontSize: Math.min(MAX_SIZE, oneLine), lines: 1 };

  const twoLinesFit = name.length <= Math.floor((2 * maxWidth) / (WIDTH_FACTOR * READABLE_SIZE));
  if (twoLinesFit) return { fontSize: READABLE_SIZE, lines: 2 };

  return { fontSize: Math.max(MIN_SIZE, Math.min(READABLE_SIZE, perLine(3))), lines: 3 };
}

const LINE_HEIGHT = 1.1;
const ABSOLUTE_MIN = 20;

/**
 * Font size and line count for a text that has to fit a box of `width` by `height` px, never above `maxSize`.
 * Fewer lines are better as long as the size stays at 55% of the maximum or more; a long prize name then
 * takes two lines at a good size instead of one line too small to read from the back of the room. The block
 * never grows taller than `height`, and the size never goes under 20 px.
 */
export function fitBox(
  text: string,
  box: { width: number; height: number; maxSize: number },
): { fontSize: number; lines: 1 | 2 | 3 } {
  const sizeFor = (lines: number) =>
    Math.min(
      box.maxSize,
      Math.floor((lines * box.width) / (WIDTH_FACTOR * text.length)),
      Math.floor(box.height / (lines * LINE_HEIGHT)),
    );
  const options = ([1, 2, 3] as const).map((lines) => ({ lines, fontSize: sizeFor(lines) }));

  const good = options.find((option) => option.fontSize >= box.maxSize * 0.55);
  const best = good ?? options.reduce((a, b) => (b.fontSize > a.fontSize ? b : a));
  return { fontSize: Math.max(ABSOLUTE_MIN, best.fontSize), lines: best.lines };
}
