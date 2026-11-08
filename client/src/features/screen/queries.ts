import { queryOptions } from "@tanstack/react-query";
import { getScreen } from "./api";

/**
 * How often the screen asks again. A draw reaches the screen only when it asks, so this is how late the reel
 * starts: it has to be short next to a 2 second reel (see `queries.test.ts`).
 */
export const SCREEN_POLL_MS = 400;

/** How long to wait before asking again after a failed request, so a dead server is not asked every poll. */
export const SCREEN_RETRY_MS = 1500;

export const screenQueryOptions = queryOptions({
  queryKey: ["screen"],
  queryFn: getScreen,
  refetchInterval: SCREEN_POLL_MS,
  // The screen lives in a window on the projector, which rarely has the focus.
  refetchIntervalInBackground: true,
  // Never give up: after a network failure the screen keeps the last state and picks up again by itself.
  retry: true,
  retryDelay: SCREEN_RETRY_MS,
});
