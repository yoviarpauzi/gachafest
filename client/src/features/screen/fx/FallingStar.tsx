import starBasic from "../../../assets/screen/star-basic.svg";
import starPremium from "../../../assets/screen/star-premium.svg";
import type { Tier } from "../timing";

/**
 * Where the falling star ends up (its resting place in Figma, with the star's head on the machine), and how far
 * up and to the left of it the fall starts. Premium: a 700 px gold star; basic: a smaller silver-cream one.
 */
const STAR = {
  premium: { left: 400, top: 200, size: 700, travel: 900, art: starPremium },
  basic: { left: 620, top: 355, size: 420, travel: 700, art: starBasic },
} as const;

/** Figma `FX falling star`. Hidden until the timeline brings it in. */
export function FallingStar({ tier }: { tier: Tier }) {
  const star = STAR[tier];
  return (
    <div
      aria-hidden="true"
      data-fx="star"
      data-travel={star.travel}
      className="pointer-events-none absolute opacity-0"
      style={{ left: star.left, top: star.top, width: star.size, height: star.size }}
    >
      <img src={star.art} alt="" className="block size-full max-w-none" />
    </div>
  );
}
