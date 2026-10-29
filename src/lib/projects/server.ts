import 'server-only';
import type { AuthenticatedUser } from '@/lib/auth';
import { HttpError } from '@/lib/http';
import type { CreateProjectInput, UpdateProjectInput } from '@/lib/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Project } from '@/lib/types';

const projectFields =
  'id, name, description, status, platforms, urgency, importance, createdByUserId, createdAt, updatedAt';

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await createAdminClient()
    .from('Project')
    .select(projectFields)
    .order('updatedAt', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Project[];
}

export async function createProject(
  actor: AuthenticatedUser,
  input: CreateProjectInput,
): Promise<Project> {
  const { data, error } = await createAdminClient()
    .from('Project')
    .insert({ ...input, createdByUserId: actor.id })
    .select(projectFields)
    .single();
  if (error) throw new Error(error.message);
  return data as Project;
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  const { data, error } = await createAdminClient()
    .from('Project')
    .update(input)
    .eq('id', projectId)
    .select(projectFields)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError('Proyecto no encontrado', 404);
  return data as Project;
}
