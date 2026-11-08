import { useGSAP } from "@gsap/react";
import { useEffect, useRef, type RefObject } from "react";
import { elapsedMs } from "../draw/clock";
import type { ScreenState } from "./api";
import { buildRevealTimeline, refreshStrip } from "./revealTimeline";
import type { View } from "./view";

/** How far the timeline may drift from the server's clock before it is moved, in seconds. */
const MAX_DRIFT = 0.3;

/**
 * Keeps one GSAP timeline per reveal in step with the server. The timeline is built when a new reveal starts
 * (its key is `revealedAt`) and thrown away when the screen leaves the reveal. Each answer from the server
 * puts it at the elapsed time on the server's clock: a screen opened mid-reveal starts in the right place,
 * Skip jumps to the end, and small drift between polls is left alone so the motion stays smooth.
 */
export function useReveal(
  scope: RefObject<HTMLElement | null>,
  { state, dataUpdatedAt, view }: { state: ScreenState | undefined; dataUpdatedAt: number; view: View },
): void {
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const key = view.kind === "reveal" ? view.key : null;
  const tier = view.kind === "reveal" ? view.tier : "basic";

  useGSAP(
    () => {
      if (!scope.current || key === null) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      timeline.current = buildRevealTimeline(scope.current, { tier, reducedMotion });
      return () => {
        timeline.current = null;
      };
    },
    { scope, dependencies: [key, tier] },
  );

  useEffect(() => {
    const tl = timeline.current;
    const reveal = state?.reveal;
    if (!tl || !scope.current || !state || !reveal) return;

    const elapsed = elapsedMs({
      serverNow: state.now,
      revealedAt: reveal.revealedAt,
      fetchedAt: dataUpdatedAt,
      clientNow: Date.now(),
    });
    if (reveal.skipped || elapsed / 1000 >= tl.duration()) {
      tl.progress(1).pause();
    } else {
      if (tl.paused() || Math.abs(tl.time() - elapsed / 1000) > MAX_DRIFT) tl.time(elapsed / 1000);
      if (tl.paused()) tl.play();
    }
    refreshStrip(scope.current);
  }, [state, dataUpdatedAt, key, scope]);
}
