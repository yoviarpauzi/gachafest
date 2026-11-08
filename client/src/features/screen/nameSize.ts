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
