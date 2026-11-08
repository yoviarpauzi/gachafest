import { useRef } from "react";
import { announce } from "./announce";
import type { ScreenState } from "./api";
import { Confetti } from "./fx/Confetti";
import { FallingStar } from "./fx/FallingStar";
import { Flash } from "./fx/Flash";
import { EventLockup } from "./EventLockup";
import { LiveBadge } from "./LiveBadge";
import { fitBox } from "./nameSize";
import { NamePlate } from "./NamePlate";
import { formatRupiah } from "../prizes/format";
import { PrizeRibbon } from "./PrizeRibbon";
import { ReelStrip } from "./ReelStrip";
import { SlotMachine } from "./SlotMachine";
import { useReveal } from "./useReveal";
import type { View } from "./view";

// Room for the prize name: beside the two rules when there is a value under it, or the whole hero area when there is none.
const HEADING_BOX = { width: 760, height: 120, maxSize: 56 };
const HERO_BOX = { width: 1100, height: 230, maxSize: 132 };

/**
 * Figma `Big screen / Drawing` and the `Reveal ... winner` frames in one view: the prize large and a machine
 * at 1.2 times its Standby size while it spins, then the prize heading, its value and the winner's plate.
 * The timeline (`useReveal`) fades the first group out and the second in; `view.stage` says which one the
 * page is in, for what is only mounted from the plate on and for what a screen reader hears.
 */
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

  const plateShown = view.stage === "plate" || view.stage === "done";
  const value = view.prize?.value ?? null;
  const headingName = view.prize?.name ?? "";
  const headingFit = fitBox(headingName || "x", HEADING_BOX);
  const heroFit = fitBox(headingName || "x", HERO_BOX);

  return (
    <div ref={scope} className="absolute inset-0">
      <EventLockup size="compact" className="absolute top-13 left-20" />
      <LiveBadge />
      <p role="status" className="sr-only">
        {announce({ stage: view.stage, prize: view.prize, winnerName: view.winnerName })}
      </p>

      <div data-fx="stage-art" className="absolute inset-0">
        <PrizeRibbon prize={view.prize} scale={1125 / 990} textScale={1.25} className="absolute top-32.5 left-99.5" />
        <SlotMachine scale={1.2} className="absolute top-110 left-102.5">
          <ReelStrip reel={view.reel} winner={view.winnerName} />
        </SlotMachine>
      </div>

      {/* The cinematic part: the screen dims, a star falls onto the machine, and a flash fills the screen. */}
      <div aria-hidden="true" data-fx="dim" className="pointer-events-none absolute inset-0 bg-black-950/70 opacity-0" />
      <Flash tier={view.tier} />
      <FallingStar tier={view.tier} />
      {view.tier === "premium" && <div aria-hidden="true" data-fx="burst" className="pointer-events-none absolute inset-0 bg-burst opacity-0" />}

      {view.prize && value !== null && (
        <>
          <div data-fx="heading" className="absolute top-42.5 left-97.5 flex min-h-17 w-285 items-center justify-center gap-10 opacity-0">
            <div aria-hidden="true" className="h-[3px] w-37.5 shrink-0 bg-gold-500" />
            <p
              className="max-w-190 text-center font-display font-bold tracking-[-0.56px] text-balance text-ink"
              style={{ fontSize: headingFit.fontSize, lineHeight: 1.1 }}
            >
              {headingName}
            </p>
            <div aria-hidden="true" className="h-[3px] w-37.5 shrink-0 bg-gold-500" />
          </div>
          <p
            data-fx="amount"
            className="text-gold-metal absolute top-62.5 left-97.5 w-285 text-center font-display text-[132px] leading-37.5 font-extrabold tracking-[-2.64px] whitespace-nowrap opacity-0"
          >
            {formatRupiah(value)}
          </p>
        </>
      )}
      {/* A prize with no value: its name is the hero, where the value would be. */}
      {view.prize && value === null && (
        <div data-fx="amount" className="absolute top-47.5 left-102.5 flex h-62.5 w-275 items-center justify-center opacity-0">
          <p
            className="text-gold-metal w-full text-center font-display font-extrabold tracking-[-2px] text-balance"
            style={{ fontSize: heroFit.fontSize, lineHeight: 1.1 }}
          >
            {headingName}
          </p>
        </div>
      )}
      <NamePlate name={plateShown ? view.winnerName : null} className="absolute top-120 left-115 opacity-0" />
      {view.tier === "premium" && <Confetti seed={view.key} count={80} />}
    </div>
  );
}
