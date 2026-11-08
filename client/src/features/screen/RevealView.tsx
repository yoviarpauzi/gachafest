import { useRef } from "react";
import type { ScreenState } from "./api";
import { EventLockup } from "./EventLockup";
import { LiveBadge } from "./LiveBadge";
import { PrizeRibbon } from "./PrizeRibbon";
import { ReelStrip } from "./ReelStrip";
import { SlotMachine } from "./SlotMachine";
import { useReveal } from "./useReveal";
import type { View } from "./view";

/** Figma `Big screen / Drawing`: the prize large, the machine at 1.2 times its Standby size, no history. */
export function RevealView({
  view,
  state,
  dataUpdatedAt,
}: {
  view: Extract<View, { kind: "reveal" }>;
  state: ScreenState | undefined;
  dataUpdatedAt: number;
}) {
  const scope = useRef<HTMLDivElement>(null);
  useReveal(scope, { state, dataUpdatedAt, view });

  return (
    <div ref={scope} className="absolute inset-0">
      <EventLockup size="compact" className="absolute top-13 left-20" />
      <LiveBadge />
      <PrizeRibbon prize={view.prize} scale={1125 / 990} textScale={1.25} className="absolute top-32.5 left-99.5" />
      <SlotMachine scale={1.2} className="absolute top-110 left-102.5">
        <ReelStrip reel={view.reel} winner={view.winnerName} />
      </SlotMachine>
    </div>
  );
}
