import { apiFetch } from "../../lib/api";
import type { Winner } from "../winners/api";

export type Phase = "idle" | "standby" | "reveal";

export type PrizeView = {
  id: number;
  name: string;
  value: number | null;
  winners: number;
  drawn: number;
  tier: "basic" | "premium";
  /** 1-based place in the draw order. */
  position: number;
  total: number;
};

export type Reveal = {
  winner: Winner;
  prize: PrizeView;
  revealedAt: string;
  animationEndsAt: string;
  skipped: boolean;
};

export type DrawState = {
  /** The server's clock when it answered; see `remainingMs`. */
  now: string;
  phase: Phase;
  activePrize: PrizeView | null;
  /** Guests who can still be drawn for the active prize; null when there is no active prize. */
  eligibleCount: number | null;
  reveal: Reveal | null;
  screenOpen: boolean;
};

const BASE = "/api/admin/draw";

export const getDraw = () => apiFetch<DrawState>(BASE);

export const selectPrize = (prizeId: number) =>
  apiFetch<DrawState>(`${BASE}/select`, { method: "POST", body: JSON.stringify({ prizeId }) });

/** Draws one winner for the active prize and puts them on the big screen. */
export const drawNow = () => apiFetch<DrawState>(BASE, { method: "POST" });

/** Skips the animation, on the big screen too. */
export const skipAnimation = () => apiFetch<DrawState>(`${BASE}/skip`, { method: "POST" });

/** Done with the winner on screen: back to standby. */
export const finishReveal = () => apiFetch<DrawState>(`${BASE}/done`, { method: "POST" });
