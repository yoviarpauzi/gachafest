export type ConfettiPiece = {
  /** Where the piece starts, across the 1920 px stage. */
  x: number;
  /** Seconds after the confetti starts. */
  delay: number;
  /** Seconds to fall the height of the stage. */
  duration: number;
  /** Sideways travel in px while falling. */
  drift: number;
  /** Degrees turned while falling; negative turns the other way. */
  rotation: number;
  width: number;
  height: number;
  tone: "gold" | "cream" | "bronze";
};

const STAGE_WIDTH = 1920;
const TONES = ["gold", "cream", "bronze"] as const;

// FNV-1a: a string to a 32-bit number.
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: a small seeded generator returning numbers in [0, 1).
function generator(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The confetti pieces for one reveal. Drawn from a generator seeded with `seed` (the reveal's `revealedAt`),
 * so every screen shows the same pieces and seeking the animation never reshuffles them.
 */
export function makeConfetti(seed: string, count: number): ConfettiPiece[] {
  const next = generator(hash(seed));
  return Array.from({ length: count }, () => ({
    x: next() * STAGE_WIDTH,
    delay: next() * 1.2,
    duration: 2.2 + next() * 1.8,
    drift: (next() - 0.5) * 240,
    rotation: (next() < 0.5 ? -1 : 1) * (180 + next() * 540),
    width: 10 + next() * 12,
    height: 18 + next() * 16,
    tone: TONES[Math.floor(next() * TONES.length)]!,
  }));
}
