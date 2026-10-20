'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/kanbans';
import type {
  CreateKanbanCardInput,
  CreateKanbanInput,
  UpdateKanbanCardInput,
} from '@/lib/schemas';
import type { Kanban } from '@/lib/types';

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
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['team-kanban-card-update', kanbanId],
    mutationFn: ({
      cardId,
      input,
    }: {
      cardId: string;
      input: UpdateKanbanCardInput;
    }) => api.updateCard(kanbanId, cardId, input),
    onMutate: async ({ cardId, input }) => {
      await client.cancelQueries({ queryKey: kanbanKeys.all });
      const previous = client.getQueryData<Kanban[]>(kanbanKeys.all);
      if (previous) {
        client.setQueryData<Kanban[]>(
          kanbanKeys.all,
          previous.map((kanban) =>
            kanban.id !== kanbanId
              ? kanban
              : {
                  ...kanban,
                  cards: kanban.cards.map((card) =>
                    card.id === cardId ? { ...card, ...input } : card,
                  ),
                },
          ),
        );
      }
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous)
        client.setQueryData(kanbanKeys.all, context.previous);
    },
    onSettled: () => {
      if (
        client.isMutating({
          mutationKey: ['team-kanban-card-update', kanbanId],
        }) === 1
      )
        void client.invalidateQueries({ queryKey: kanbanKeys.all });
    },
  });
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
