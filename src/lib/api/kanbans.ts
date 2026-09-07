import { apiRequest } from '@/lib/api/request';
import type {
  CreateKanbanCardInput,
  CreateKanbanInput,
  CreateTeamInput,
  UpdateKanbanCardInput,
} from '@/lib/schemas';
import type {
  AppRole,
  AppUser,
  Kanban,
  Team,
  TeamMembershipRole,
} from '@/lib/types';

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const fetchKanbans = () => apiRequest<Kanban[]>('/api/kanbans');
export const createKanban = (input: CreateKanbanInput) =>
  apiRequest('/api/kanbans', json('POST', input));
export const updateKanban = (
  kanbanId: string,
  input: Partial<CreateKanbanInput>,
) => apiRequest(`/api/kanbans/${kanbanId}`, json('PATCH', input));
export const cancelKanban = (kanbanId: string) =>
  apiRequest(`/api/kanbans/${kanbanId}`, json('DELETE'));

export const createCard = (kanbanId: string, input: CreateKanbanCardInput) =>
  apiRequest(`/api/kanbans/${kanbanId}/cards`, json('POST', input));
export const updateCard = (
  kanbanId: string,
  cardId: string,
  input: UpdateKanbanCardInput,
) =>
  apiRequest(`/api/kanbans/${kanbanId}/cards/${cardId}`, json('PATCH', input));
export const cancelCard = (kanbanId: string, cardId: string) =>
  apiRequest(`/api/kanbans/${kanbanId}/cards/${cardId}`, json('DELETE'));

export const createState = (kanbanId: string, name: string) =>
  apiRequest(`/api/kanbans/${kanbanId}/states`, json('POST', { name }));
export const updateState = (kanbanId: string, stateId: string, name: string) =>
  apiRequest(
    `/api/kanbans/${kanbanId}/states/${stateId}`,
    json('PATCH', { name }),
  );
export const reorderStates = (kanbanId: string, stateIds: string[]) =>
  apiRequest(`/api/kanbans/${kanbanId}/states`, json('PUT', { stateIds }));
export const cancelState = (kanbanId: string, stateId: string) =>
  apiRequest(`/api/kanbans/${kanbanId}/states/${stateId}`, json('DELETE'));
export const createTag = (kanbanId: string, name: string) =>
  apiRequest(`/api/kanbans/${kanbanId}/tags`, json('POST', { name }));
export const updateTag = (kanbanId: string, tagId: string, name: string) =>
  apiRequest(`/api/kanbans/${kanbanId}/tags/${tagId}`, json('PATCH', { name }));
export const cancelTag = (kanbanId: string, tagId: string) =>
  apiRequest(`/api/kanbans/${kanbanId}/tags/${tagId}`, json('DELETE'));

export const fetchTeams = () => apiRequest<Team[]>('/api/teams');
export const createTeam = (input: CreateTeamInput) =>
  apiRequest('/api/teams', json('POST', input));
export const updateTeam = (teamId: string, name: string) =>
  apiRequest(`/api/teams/${teamId}`, json('PATCH', { name }));
export const cancelTeam = (teamId: string) =>
  apiRequest(`/api/teams/${teamId}`, json('DELETE'));
export const addTeamMember = (
  teamId: string,
  userId: string,
  role: TeamMembershipRole,
) => apiRequest(`/api/teams/${teamId}/members`, json('POST', { userId, role }));
export const updateTeamMember = (
  teamId: string,
  membershipId: string,
  role: TeamMembershipRole,
) =>
  apiRequest(
    `/api/teams/${teamId}/members/${membershipId}`,
    json('PATCH', { role }),
  );
export const cancelTeamMember = (teamId: string, membershipId: string) =>
  apiRequest(`/api/teams/${teamId}/members/${membershipId}`, json('DELETE'));

export const fetchUsers = () => apiRequest<AppUser[]>('/api/users');
export const updateUserRole = (userId: string, role: AppRole) =>
  apiRequest(`/api/users/${userId}/role`, json('PATCH', { role }));
