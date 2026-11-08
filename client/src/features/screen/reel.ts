export const MIN_STRIP = 40;

/**
 * The names the reel spins through, ending on the winner. The server's sample comes in a fixed order, so
 * every screen builds the same strip. A short sample is repeated to give the spin enough names; an empty one
 * leaves just the winner.
 */
export function buildReelStrip(reel: string[], winner: string): string[] {
  if (reel.length === 0) return [winner];
  const before = MIN_STRIP - 1;
  const names = reel.length >= before ? [...reel] : Array.from({ length: before }, (_, i) => reel[i % reel.length]!);
  return [...names, winner];
}

/** Size of a name one line off the middle, against the one in the middle (67.2 px over 102 px in Figma). */
export const NEIGHBOR_SCALE = 67.2 / 102;

/**
 * How a name in the reel window looks at `distance` lines from the middle: full size and dark in the middle,
 * the smaller faded look from one line out. `t` is 0 for the middle look and 1 for the neighbour look.
 */
export function emphasis(distance: number): { scale: number; t: number } {
  const t = Math.min(1, Math.abs(distance));
  return { scale: 1 - (1 - NEIGHBOR_SCALE) * t, t };
}
