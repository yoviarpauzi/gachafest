export const MIN_STRIP = 40;

/**
 * The names the reel spins through, ending on the winner. The server's sample comes in a fixed order, so
 * every screen builds the same strip. A short sample is repeated to give the spin enough names; an empty one
 * leaves just the winner.
 */
export function buildReelStrip(reel: string[], winner: string, minLength: number = MIN_STRIP): string[] {
  if (reel.length === 0) return [winner];
  const before = minLength - 1;
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

/** How many names go past the window each second while the reel spins at full speed. */
const SLOTS_PER_SECOND = 18;

/**
 * How long a strip has to be for a reel of `reelMs` to turn at about 18 names a second, never shorter than the
 * minimum: 90% of the distance is covered at that speed, in `REEL_KNEE` of the time.
 */
export function stripLengthFor(reelMs: number): number {
  const slots = SLOTS_PER_SECOND * (REEL_KNEE / 0.9) * (reelMs / 1000);
  return Math.max(MIN_STRIP, Math.ceil(slots) + 1);
}

/** Where the braking starts: 9/11 of the time, because 90% of the distance at one speed and the last 10% braking to 0 only meet there. */
export const REEL_KNEE = 9 / 11;

/**
 * The reel's motion over a progress `p` from 0 to 1: one steady speed for 90% of the distance, then a brake over
 * the last part that starts at exactly that speed and ends standing still. So the reel is really spinning for
 * most of the reveal, including while the star falls, and stops as the star lands.
 */
export function reelEase(p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  if (p < REEL_KNEE) return (0.9 * p) / REEL_KNEE;
  const braking = (p - REEL_KNEE) / (1 - REEL_KNEE);
  return 0.9 + 0.1 * (1 - (1 - braking) ** 2);
}
