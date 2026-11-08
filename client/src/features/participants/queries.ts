import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../lib/api";
import {
  addParticipant,
  deleteParticipant,
  importFile,
  listParticipants,
  previewImport,
  setParticipantDisabled,
  updateParticipant,
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

export function useUpdateParticipantMutation() {
  const queryClient = useQueryClient();
  return useMutation<Participant, ApiError, { id: number; name: string; email: string }>({
    mutationFn: ({ id, name, email }) => updateParticipant(id, { name, email }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["participants"] }),
  });
}

export function useDeleteParticipantMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, number>({
    mutationFn: deleteParticipant,
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
