import { useEffect, useState } from "react";
import type { DrawState } from "./api";

/**
 * Milliseconds left of the animation on the server's clock, never below 0. The server says what time it is
 * (`serverNow`) when it answers; the time since the answer arrived (`clientNow - fetchedAt`) is measured on
 * the browser's own clock, so a browser whose clock is minutes off still counts the same seconds.
 */
export function remainingMs(args: {
  serverNow: string;
  animationEndsAt: string;
  fetchedAt: number;
  clientNow: number;
}): number {
  const serverNowEstimate = Date.parse(args.serverNow) + (args.clientNow - args.fetchedAt);
  return Math.max(0, Date.parse(args.animationEndsAt) - serverNowEstimate);
}

/**
 * Time left of the reveal animation for the page: 0 when nothing is being revealed, when the animation was
 * skipped, or when it is over. Re-checked four times a second while it is still running.
 */
export function useAnimationRemaining(state: DrawState | undefined, fetchedAt: number): number {
  const [clientNow, setClientNow] = useState(() => Date.now());

  const reveal = state?.reveal ?? null;
  const running = state !== undefined && reveal !== null && !reveal.skipped;
  // A fresh answer can arrive between two ticks, so never count from before it arrived.
  const left = running
    ? remainingMs({
        serverNow: state.now,
        animationEndsAt: reveal.animationEndsAt,
        fetchedAt,
        clientNow: Math.max(clientNow, fetchedAt),
      })
    : 0;
  const over = left === 0;

  useEffect(() => {
    if (!running || over) return;
    const id = setInterval(() => setClientNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running, over]);

  return left;
}
