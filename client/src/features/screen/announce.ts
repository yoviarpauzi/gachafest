import type { Stage } from "./timing";
import type { ScreenState } from "./api";

/**
 * What a screen reader hears for a reveal. It changes only twice per draw: when the draw starts, and when the
 * winner's plate is shown, so the winner is never spoken before the audience sees the name.
 */
export function announce(args: { stage: Stage; prize: ScreenState["prize"]; winnerName: string }): string {
  const { stage, prize, winnerName } = args;
  if (stage === "plate" || stage === "done") return prize ? `${winnerName} wins ${prize.name}` : `${winnerName} wins`;
  return prize ? `Drawing for ${prize.name}` : "Drawing";
}
