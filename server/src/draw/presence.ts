/** How long after the big screen last asked for the state it still counts as open. */
export const SCREEN_OPEN_MS = 15_000;

/**
 * Whether the big screen is open, judged by when it last asked for the screen state. Kept in memory: the
 * screen's requests are public, and a public request must not write to the database.
 */
export function createScreenPresence(now: () => number = Date.now) {
  let lastSeen: number | null = null;
  return {
    seen(): void {
      lastSeen = now();
    },
    isOpen(): boolean {
      return lastSeen !== null && now() - lastSeen <= SCREEN_OPEN_MS;
    },
  };
}
