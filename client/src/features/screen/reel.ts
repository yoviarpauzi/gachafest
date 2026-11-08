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
