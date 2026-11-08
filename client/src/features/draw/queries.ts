import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../lib/api";
import { drawNow, finishReveal, getDraw, selectPrize, skipAnimation, type DrawState } from "./api";

/** How often the page asks again: it follows another tab, and the big screen's presence. */
export const DRAW_POLL_MS = 3000;

export const drawQueryOptions = queryOptions({
  queryKey: ["draw"],
  queryFn: getDraw,
  refetchInterval: DRAW_POLL_MS,
});

// The answer to an action already is the new draw state. It goes into the cache at once, before the lists
// around it (winners, prizes) are fetched again: otherwise the winners list can arrive first, and the page,
// still on the old draw state, shows the new winner in "Latest winners" before the animation has even begun.
function useWriteDrawState() {
  const queryClient = useQueryClient();
  return (state: DrawState) => queryClient.setQueryData<DrawState>(drawQueryOptions.queryKey, state);
}

// A draw changes the draw state, the winners list and every prize's `drawn`, so all three are refreshed when
// the request settles; that also puts right a page that went stale (another tab pressed Done).
function useRefreshOnSettled() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["draw"] }),
      queryClient.invalidateQueries({ queryKey: ["winners"] }),
      queryClient.invalidateQueries({ queryKey: ["prizes"] }),
    ]);
}

export function useSelectPrizeMutation() {
  const refresh = useRefreshOnSettled();
  const write = useWriteDrawState();
  return useMutation<DrawState, ApiError, number>({ mutationFn: selectPrize, onSuccess: write, onSettled: refresh });
}

export function useDrawMutation() {
  const refresh = useRefreshOnSettled();
  const write = useWriteDrawState();
  return useMutation<DrawState, ApiError, void>({ mutationFn: drawNow, onSuccess: write, onSettled: refresh });
}

export function useSkipMutation() {
  const refresh = useRefreshOnSettled();
  const write = useWriteDrawState();
  return useMutation<DrawState, ApiError, void>({ mutationFn: skipAnimation, onSuccess: write, onSettled: refresh });
}

export function useDoneMutation() {
  const refresh = useRefreshOnSettled();
  const write = useWriteDrawState();
  return useMutation<DrawState, ApiError, void>({ mutationFn: finishReveal, onSuccess: write, onSettled: refresh });
}
