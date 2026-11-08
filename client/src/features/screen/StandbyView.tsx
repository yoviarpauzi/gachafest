import { EventLockup } from "./EventLockup";
import { LiveBadge } from "./LiveBadge";
import { LuckyWinners } from "./LuckyWinners";
import { PrizeRibbon } from "./PrizeRibbon";
import { MachineText, SlotMachine } from "./SlotMachine";
import type { View } from "./view";

/** Figma `Big screen / Standby (after Done)`: the history on the left, the next prize and an idle machine. */
export function StandbyView({ view }: { view: Extract<View, { kind: "standby" }> }) {
  return (
    <>
      <EventLockup size="compact" className="absolute top-13 left-20" />
      <LiveBadge />
      <LuckyWinners items={view.latest} className="absolute top-47.5 left-20" />
      <PrizeRibbon prize={view.prize} className="absolute top-37.5 left-193.75" />
      <SlotMachine className="absolute top-105 left-207">
        <MachineText>{view.prize ? "Get ready" : "Congratulations"}</MachineText>
      </SlotMachine>
    </>
  );
}
