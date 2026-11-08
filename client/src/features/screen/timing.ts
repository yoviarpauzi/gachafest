export type Tier = "basic" | "premium";

/**
 * `reel` is the spin, with the star falling over it. `flash` starts when the star lands: the screen goes white and
 * stays white for a moment, and the reel comes to a stop under it. `plate` is the white clearing and the winner's
 * plate coming in, and `done` is everything after the end.
 */
export type Stage = "reel" | "flash" | "plate" | "done";

/**
 * Where things happen in a reveal, in milliseconds from the moment the winner was saved. The star starts falling
 * at `starStart` and lands at `impact`, while the reel is still turning. The reel stops at `reelEnd`, hidden by
 * the white. The white starts to clear, and the plate to come in, at `flashEnd`.
 */
export type Schedule = { starStart: number; impact: number; reelEnd: number; flashEnd: number; total: number };

// `total` is the server's ANIMATION_MS for the tier, so the last stage ends exactly at `animationEndsAt`.
const SCHEDULES: Record<Tier, Schedule> = {
  premium: { starStart: 2300, impact: 3500, reelEnd: 4000, flashEnd: 4700, total: 8000 },
  basic: { starStart: 1000, impact: 1500, reelEnd: 1900, flashEnd: 2300, total: 4000 },
};

export function scheduleFor(tier: Tier): Schedule {
  return SCHEDULES[tier];
}

/** The stage a reveal is in after `elapsed` ms; anything before the start counts as the reel. */
export function stageAt(tier: Tier, elapsed: number): Stage {
  const s = SCHEDULES[tier];
  if (elapsed < s.impact) return "reel";
  if (elapsed < s.flashEnd) return "flash";
  if (elapsed < s.total) return "plate";
  return "done";
}
