'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/kanbans';
import type {
  CreateKanbanCardInput,
  CreateKanbanInput,
  UpdateKanbanCardInput,
} from '@/lib/schemas';

export const kanbanKeys = { all: ['team-kanbans'] as const };

export function useKanbans() {
  return useQuery({ queryKey: kanbanKeys.all, queryFn: api.fetchKanbans });
}

function useRefreshMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: kanbanKeys.all }),
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
