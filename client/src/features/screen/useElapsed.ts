import { useEffect, useState } from "react";
import { elapsedMs } from "../draw/clock";
import type { ScreenState } from "./api";

/**
 * Milliseconds since the winner was saved, on the server's clock; 0 when nothing is being revealed. Checked
 * ten times a second while the reveal is still running, and left alone once it is over or skipped.
 */
export function useElapsed(state: ScreenState | undefined, fetchedAt: number): number {
  const [clientNow, setClientNow] = useState(() => Date.now());

  const reveal = state?.reveal ?? null;
  const elapsed =
    state && reveal
      ? elapsedMs({
          serverNow: state.now,
          revealedAt: reveal.revealedAt,
          // A fresh answer can arrive between two ticks, so never count from before it arrived.
          fetchedAt,
          clientNow: Math.max(clientNow, fetchedAt),
        })
      : 0;
  const duration = reveal ? Date.parse(reveal.animationEndsAt) - Date.parse(reveal.revealedAt) : 0;
  const running = reveal !== null && !reveal.skipped && elapsed < duration;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setClientNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  return elapsed;
}
