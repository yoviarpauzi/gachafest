import flashBasic from "../../../assets/screen/flash-basic.svg";
import flashPremium from "../../../assets/screen/flash-premium.svg";
import type { Tier } from "../timing";

/** Where the flash sits in Figma, centered on the machine. Premium has rays and a 1800 px glow; basic 520 px. */
const FLASH = {
  premium: { left: 60, top: -200, size: 1800, art: flashPremium },
  basic: { left: 700, top: 440, size: 520, art: flashBasic },
} as const;

/** Figma `FX flash`. Hidden until the timeline brings it in. */
export function Flash({ tier }: { tier: Tier }) {
  const flash = FLASH[tier];
  return (
    <div
      aria-hidden="true"
      data-fx="flash"
      className="pointer-events-none absolute opacity-0"
      style={{ left: flash.left, top: flash.top, width: flash.size, height: flash.size }}
    >
      <img src={flash.art} alt="" className="block size-full max-w-none" />
    </div>
  );
}
