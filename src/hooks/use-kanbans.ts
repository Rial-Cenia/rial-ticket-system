'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/kanbans';
import type {
  CreateKanbanCardInput,
  CreateKanbanInput,
  UpdateKanbanCardInput,
} from '@/lib/schemas';

export const kanbanKeys = {
  all: ['team-kanbans'] as const,
  comments: (kanbanId: string, cardId: string) =>
    ['team-kanbans', kanbanId, 'cards', cardId, 'comments'] as const,
};

export function useKanbans() {
  return useQuery({ queryKey: kanbanKeys.all, queryFn: api.fetchKanbans });
}

function useRefreshMutation<TInput, TOutput = unknown>(
  mutationFn: (input: TInput) => Promise<TOutput>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: kanbanKeys.all });
    },
  });
}

export function useCreateKanban() {
  return useRefreshMutation<CreateKanbanInput>(api.createKanban);
}

export function useCreateKanbanCard(kanbanId: string) {
  return useRefreshMutation<CreateKanbanCardInput>((input) =>
    api.createCard(kanbanId, input),
  );
}

export function useUpdateKanbanCard(kanbanId: string) {
  return useRefreshMutation<{ cardId: string; input: UpdateKanbanCardInput }>(
    ({ cardId, input }) => api.updateCard(kanbanId, cardId, input),
  );
}

export function useCancelKanbanCard(kanbanId: string) {
  return useRefreshMutation<string>((cardId) =>
    api.cancelCard(kanbanId, cardId),
  );
}

export function useKanbanCardComments(kanbanId: string, cardId: string) {
  return useQuery({
    queryKey: kanbanKeys.comments(kanbanId, cardId),
    queryFn: () => api.fetchCardComments(kanbanId, cardId),
  });
}

export function useCreateKanbanCardComment(kanbanId: string, cardId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      api.createCardComment(kanbanId, cardId, formData),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: kanbanKeys.comments(kanbanId, cardId),
      }),
  });
}

export function useDeleteKanbanCardComment(kanbanId: string, cardId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      api.deleteCardComment(kanbanId, cardId, commentId),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: kanbanKeys.comments(kanbanId, cardId),
      }),
  });
}

export function useArchiveFinalStateCards(kanbanId: string) {
  return useRefreshMutation<string, { stateId: string; archivedCount: number }>(
    (stateId) => api.archiveFinalStateCards(kanbanId, stateId),
  );
}

export function useTransferKanbanCard(kanbanId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      cardId,
      targetKanbanId,
    }: {
      cardId: string;
      targetKanbanId: string;
    }) => api.transferCard(kanbanId, cardId, targetKanbanId),
    onSuccess: () => client.invalidateQueries({ queryKey: kanbanKeys.all }),
  });
}
