import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "../../lib/api";

export const meQueryOptions = queryOptions({
  queryKey: ["auth", "me"] as const,
  queryFn: () => apiFetch<{ authenticated: true }>("/api/auth/me"),
  retry: false,
  staleTime: 60_000,
});

/** Route-guard helper: fetchQuery honors staleTime, so an expired session is noticed after 60 s. */
export async function isAuthenticated(queryClient: QueryClient): Promise<boolean> {
  try {
    await queryClient.fetchQuery(meQueryOptions);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return false;
    throw error;
  }
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: true }, ApiError, { password: string }>({
    mutationFn: (input) =>
      apiFetch<{ ok: true }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.setQueryData(meQueryOptions.queryKey, { authenticated: true as const });
    },
  });
}
