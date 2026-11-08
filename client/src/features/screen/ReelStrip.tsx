import { useMemo } from "react";
import { nameFontSize } from "./nameSize";
import { buildReelStrip } from "./reel";
import { WINDOW_HEIGHT, WINDOW_WIDTH } from "./SlotMachine";

/** Distance in Figma px between two names in the reel (the middle name's line plus half of a neighbour's). */
export const ITEM_PITCH = 87;
const MAX_SIZE = 85;

/**
 * The names the reel spins through, stacked in one tall strip that `revealTimeline` moves. Item 0 starts in
 * the middle of the window and the winner (the last entry of the strip) stops there. One name after the
 * winner and the empty space before the first are only there so the winner has neighbours, like in Figma.
 */
export function ReelStrip({ reel, winner }: { reel: string[]; winner: string }) {
  const strip = useMemo(() => buildReelStrip(reel, winner), [reel, winner]);
  const items = useMemo(() => (reel.length > 0 ? [...strip, reel[0]!] : strip), [strip, reel]);

  return (
    <div
      aria-hidden="true"
      data-fx="reel-strip"
      data-count={strip.length}
      data-pitch={ITEM_PITCH}
      className="absolute inset-x-0 will-change-transform"
      style={{ top: WINDOW_HEIGHT / 2 - ITEM_PITCH / 2, height: items.length * ITEM_PITCH }}
    >
      {items.map((name, index) => {
        const { fontSize, lines } = nameFontSize(name, WINDOW_WIDTH);
        return (
          <p
            key={index}
            data-reel-item
            // A name that does not fit on one line wraps into the space around it instead of running out of the window.
            className={`absolute inset-x-0 flex items-center justify-center text-center font-display font-extrabold tracking-[-0.85px] ${
              lines === 1 ? "whitespace-nowrap" : "text-balance"
            }`}
            style={{
              top: index * ITEM_PITCH,
              height: ITEM_PITCH,
              lineHeight: lines === 1 ? `${ITEM_PITCH}px` : 1.1,
              fontSize: Math.min(MAX_SIZE, fontSize),
              color: "color-mix(in srgb, var(--color-black-950) calc((1 - var(--t, 0)) * 100%), rgb(143 97 40 / 0.55))",
              filter: "blur(calc((var(--blur, 0) + var(--t, 0) * 0.6) * 1px))",
            }}
          >
            {name}
          </p>
        );
      })}
    </div>
  );
}
