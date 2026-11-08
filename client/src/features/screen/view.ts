import type { ScreenState } from "./api";
import { stageAt, type Stage, type Tier } from "./timing";

export type View =
  | { kind: "empty" }
  | { kind: "idle" }
  | { kind: "standby"; prize: ScreenState["prize"]; latest: ScreenState["latest"] }
  | {
      kind: "reveal";
      /** One per draw (`revealedAt`), so a new draw gets a new timeline. */
      key: string;
      tier: Tier;
      stage: Stage;
      prize: ScreenState["prize"];
      winnerName: string;
      reel: string[];
      skipped: boolean;
    };

/**
 * What the screen shows, from the server's answer and the time elapsed since the winner was saved. Nothing
 * is stored: the same answer and the same time always give the same view.
 */
export function deriveView(state: ScreenState | undefined, elapsed: number): View {
  if (!state) return { kind: "empty" };
  if (state.phase === "idle") return { kind: "idle" };

  const { reveal } = state;
  if (state.phase === "reveal" && reveal) {
    const tier = state.prize?.tier ?? "basic";
    return {
      kind: "reveal",
      key: reveal.revealedAt,
      tier,
      stage: reveal.skipped ? "done" : stageAt(tier, elapsed),
      prize: state.prize,
      winnerName: reveal.winnerName,
      reel: reveal.reel,
      skipped: reveal.skipped,
    };
  }

  return { kind: "standby", prize: state.prize, latest: state.latest };
}
