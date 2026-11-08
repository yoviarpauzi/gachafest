import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../lib/api";
import {
  createPrize,
  deletePrize,
  listPrizes,
  reorderPrizes,
  updatePrize,
  type Prize,
  type PrizeInput,
  type PrizesList,
} from "./api";

const PRIZES_KEY = ["prizes"] as const;

export const prizesQueryOptions = queryOptions({ queryKey: PRIZES_KEY, queryFn: listPrizes });

// Every mutation refreshes the list when it settles, so a request that failed because the list had changed
// elsewhere (a prize deleted in another tab) still ends with the list as the server has it.
function useRefreshOnSettled() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PRIZES_KEY });
}

export function useCreatePrizeMutation() {
  const refresh = useRefreshOnSettled();
  return useMutation<Prize, ApiError, PrizeInput>({ mutationFn: createPrize, onSettled: refresh });
}

export function useUpdatePrizeMutation() {
  const refresh = useRefreshOnSettled();
  return useMutation<Prize, ApiError, { id: number } & PrizeInput>({
    mutationFn: ({ id, ...input }) => updatePrize(id, input),
    onSettled: refresh,
  });
}

export function useDeletePrizeMutation() {
  const refresh = useRefreshOnSettled();
  return useMutation<void, ApiError, number>({ mutationFn: deletePrize, onSettled: refresh });
}

/** Shows the new order at once; puts the old one back if saving fails. */
export function useReorderPrizesMutation() {
  const queryClient = useQueryClient();
  const refresh = useRefreshOnSettled();
  return useMutation<void, ApiError, number[], { previous: PrizesList | undefined }>({
    mutationFn: reorderPrizes,
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: PRIZES_KEY });
      const previous = queryClient.getQueryData<PrizesList>(PRIZES_KEY);
      if (previous) {
        const byId = new Map(previous.items.map((prize) => [prize.id, prize]));
        const items = ids.flatMap((id) => byId.get(id) ?? []);
        if (items.length === previous.items.length) queryClient.setQueryData<PrizesList>(PRIZES_KEY, { items });
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(PRIZES_KEY, context.previous);
    },
    onSettled: refresh,
  });
}
