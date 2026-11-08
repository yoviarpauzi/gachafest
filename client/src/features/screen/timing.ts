export type Tier = "basic" | "premium";

export type Stage = "reel" | "star" | "flash" | "plate" | "done";

/** Where each stage of a reveal ends, in milliseconds from the moment the winner was saved. */
export type Schedule = { reelEnd: number; starEnd: number; flashEnd: number; total: number };

// `total` is the server's ANIMATION_MS for the tier, so the last stage ends exactly at `animationEndsAt`.
const SCHEDULES: Record<Tier, Schedule> = {
  premium: { reelEnd: 4000, starEnd: 5200, flashEnd: 6400, total: 8000 },
  basic: { reelEnd: 2000, starEnd: 2600, flashEnd: 3300, total: 4000 },
};

export function scheduleFor(tier: Tier): Schedule {
  return SCHEDULES[tier];
}

/** The stage a reveal is in after `elapsed` ms; anything before the start counts as the reel. */
export function stageAt(tier: Tier, elapsed: number): Stage {
  const s = SCHEDULES[tier];
  if (elapsed < s.reelEnd) return "reel";
  if (elapsed < s.starEnd) return "star";
  if (elapsed < s.flashEnd) return "flash";
  if (elapsed < s.total) return "plate";
  return "done";
}
