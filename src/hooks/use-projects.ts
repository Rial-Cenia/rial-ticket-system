'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/projects';
import type { CreateProjectInput, UpdateProjectInput } from '@/lib/schemas';
import type { Project } from '@/lib/types';

const projectKey = ['projects'] as const;

export function useProjects() {
  return useQuery({ queryKey: projectKey, queryFn: api.fetchProjects });
}

export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api.createProject(input),
    onSuccess: () => client.invalidateQueries({ queryKey: projectKey }),
  });
}

export function useUpdateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: UpdateProjectInput;
    }) => api.updateProject(projectId, input),
    onMutate: async ({ projectId, input }) => {
      await client.cancelQueries({ queryKey: projectKey });
      const previous = client.getQueryData<Project[]>(projectKey);
      if (previous)
        client.setQueryData<Project[]>(
          projectKey,
          previous.map((project) =>
            project.id === projectId ? { ...project, ...input } : project,
          ),
        );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) client.setQueryData(projectKey, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: projectKey }),
  });
}
