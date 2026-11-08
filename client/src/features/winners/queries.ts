import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../lib/api";
import { cancelWinner, deleteWinner, drawWinner, listWinners, type Winner } from "./api";

export const winnersQueryOptions = queryOptions({ queryKey: ["winners"], queryFn: listWinners });

// A draw or a cancel changes the winners list and every prize's `drawn`, so both are refreshed when the
// request settles, which also puts right a list that went stale (a winner cancelled in another tab).
function useRefreshOnSettled() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["winners"] }),
      queryClient.invalidateQueries({ queryKey: ["prizes"] }),
    ]);
}

export function useDrawWinnerMutation() {
  const refresh = useRefreshOnSettled();
  return useMutation<Winner, ApiError, number>({ mutationFn: drawWinner, onSettled: refresh });
}

// Deleting a winner puts the guest back in the pool, so the Draw page's "eligible guests" changes as well.
export function useDeleteWinnerMutation() {
  const refresh = useRefreshOnSettled();
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, number>({
    mutationFn: deleteWinner,
    onSettled: async () => {
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["draw"] })]);
    },
  });
}

export function useCancelWinnerMutation() {
  const refresh = useRefreshOnSettled();
  return useMutation<Winner, ApiError, number>({ mutationFn: cancelWinner, onSettled: refresh });
}
