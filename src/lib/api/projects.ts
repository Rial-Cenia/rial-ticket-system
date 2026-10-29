import { apiRequest } from '@/lib/api/request';
import type { CreateProjectInput, UpdateProjectInput } from '@/lib/schemas';
import type { Project } from '@/lib/types';

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const fetchProjects = () => apiRequest<Project[]>('/api/projects');
export const createProject = (input: CreateProjectInput) =>
  apiRequest<Project>('/api/projects', json('POST', input));
export const updateProject = (projectId: string, input: UpdateProjectInput) =>
  apiRequest<Project>(`/api/projects/${projectId}`, json('PATCH', input));
