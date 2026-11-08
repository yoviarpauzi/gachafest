import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../lib/api";
import { drawNow, finishReveal, getDraw, selectPrize, skipAnimation, type DrawState } from "./api";

/** Checked again every 3 seconds, so the page follows another tab and the big screen's presence. */
export const drawQueryOptions = queryOptions({
  queryKey: ["draw"],
  queryFn: getDraw,
  refetchInterval: 3000,
});

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
  return useMutation<DrawState, ApiError, number>({ mutationFn: selectPrize, onSettled: refresh });
}

export function useDrawMutation() {
  const refresh = useRefreshOnSettled();
  return useMutation<DrawState, ApiError, void>({ mutationFn: drawNow, onSettled: refresh });
}

export function useSkipMutation() {
  const refresh = useRefreshOnSettled();
  return useMutation<DrawState, ApiError, void>({ mutationFn: skipAnimation, onSettled: refresh });
}

export function useDoneMutation() {
  const refresh = useRefreshOnSettled();
  return useMutation<DrawState, ApiError, void>({ mutationFn: finishReveal, onSettled: refresh });
}
