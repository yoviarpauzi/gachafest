import { queryOptions } from "@tanstack/react-query";
import { getScreen } from "./api";

/** How often the screen asks again (PRD: the current state within 2 seconds of opening). */
export const SCREEN_POLL_MS = 1500;

export const screenQueryOptions = queryOptions({
  queryKey: ["screen"],
  queryFn: getScreen,
  refetchInterval: SCREEN_POLL_MS,
  // The screen lives in a window on the projector, which rarely has the focus.
  refetchIntervalInBackground: true,
  // Never give up: after a network failure the screen keeps the last state and picks up again by itself.
  retry: true,
  retryDelay: SCREEN_POLL_MS,
});
