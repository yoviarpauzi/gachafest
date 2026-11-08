import { apiFetch } from "../../lib/api";
import type { Phase } from "../draw/api";
import type { Tier } from "./timing";

/** What the big screen may know (the server's `ScreenState`): no email, no id, no list of participants. */
export type ScreenState = {
  /** The server's clock when it answered; see `elapsedMs`. */
  now: string;
  phase: Phase;
  /** The active prize; while a winner is being revealed, the prize that winner was drawn for. */
  prize: { name: string; value: number | null; tier: Tier; position: number; total: number } | null;
  reveal: {
    winnerName: string;
    /** At most 50 names to spin through, never the winner. */
    reel: string[];
    revealedAt: string;
    animationEndsAt: string;
    skipped: boolean;
  } | null;
  /** The ten newest valid winners, newest first, without the winner being revealed. */
  latest: { winnerName: string; prizeName: string; prizeValue: number | null }[];
};

/** Public and read-only: no login. */
export const getScreen = () => apiFetch<ScreenState>("/api/screen");
