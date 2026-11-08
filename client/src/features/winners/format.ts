/** `2026-11-08T13:05:00.000Z` as the organizer's local time of day, `14:05` for example. */
export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
