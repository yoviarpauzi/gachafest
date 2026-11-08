import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../lib/api";
import {
  addParticipant,
  importFile,
  listParticipants,
  previewImport,
  setParticipantDisabled,
  type ImportPreview,
  type ImportResult,
  type Participant,
} from "./api";

export const participantsQueryOptions = (search: { q: string; page: number }) =>
  queryOptions({
    queryKey: ["participants", { q: search.q, page: search.page }] as const,
    queryFn: () => listParticipants(search),
    placeholderData: keepPreviousData,
  });

export function usePreviewMutation() {
  return useMutation<ImportPreview, ApiError, File>({ mutationFn: previewImport });
}

export function useImportMutation() {
  const queryClient = useQueryClient();
  return useMutation<ImportResult, ApiError, File>({
    mutationFn: importFile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["participants"] }),
  });
}

export function useAddParticipantMutation() {
  const queryClient = useQueryClient();
  return useMutation<Participant, ApiError, { name: string; email: string }>({
    mutationFn: addParticipant,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["participants"] }),
  });
}

export function useToggleMutation() {
  const queryClient = useQueryClient();
  return useMutation<Participant, ApiError, { id: number; disabled: boolean }>({
    mutationFn: ({ id, disabled }) => setParticipantDisabled(id, disabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["participants"] }),
  });
}
