import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { ApiError } from "../../lib/api";

export const meQueryOptions = queryOptions({
  queryKey: ["auth", "me"] as const,
  queryFn: () => apiFetch<{ authenticated: true }>("/api/auth/me"),
  retry: false,
  staleTime: 60_000,
});

/**
 * Route-guard helper: fetchQuery honors staleTime, so an expired session is noticed after 60 s.
 * Any failure counts as "not signed in", so the login page still renders when the API is down
 * (submitting then shows the generic error instead of the router's error screen).
 */
export async function isAuthenticated(queryClient: QueryClient): Promise<boolean> {
  try {
    await queryClient.fetchQuery(meQueryOptions);
    return true;
  } catch {
    return false;
  }
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: true }, ApiError, void>({
    mutationFn: () => apiFetch<{ ok: true }>("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: meQueryOptions.queryKey });
    },
  });
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
