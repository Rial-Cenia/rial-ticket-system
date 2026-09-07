import { z } from 'zod';
import {
  APP_ROLES,
  KANBAN_PRIORITIES,
  PLATFORMS,
  TEAM_MEMBERSHIP_ROLES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
} from '@/lib/types';

export const ticketTypeSchema = z.enum(TICKET_TYPES);
export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export const platformSchema = z.enum(PLATFORMS);
export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES);
export const appRoleSchema = z.enum(APP_ROLES);
export const teamMembershipRoleSchema = z.enum(TEAM_MEMBERSHIP_ROLES);
export const kanbanPrioritySchema = z.enum(KANBAN_PRIORITIES);

export const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(100),
});
export const updateTeamSchema = createTeamSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Debes enviar al menos un cambio',
  );
export const teamMembershipSchema = z.object({
  userId: z.string().uuid(),
  role: teamMembershipRoleSchema.default('MEMBER'),
});
export const updateTeamMembershipSchema = z.object({
  role: teamMembershipRoleSchema,
});
export const updateAppRoleSchema = z.object({ role: appRoleSchema });

export const createKanbanSchema = z.object({
  name: z.string().trim().min(1).max(100),
  teamIds: z.array(z.string().uuid()).min(1),
});
export const updateKanbanSchema = createKanbanSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Debes enviar al menos un cambio',
  );
export const createKanbanStateSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
export const updateKanbanStateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    position: z.number().int().nonnegative().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    'Debes enviar al menos un cambio',
  );
export const reorderKanbanStatesSchema = z.object({
  stateIds: z.array(z.string().uuid()).min(1),
});
export const createKanbanTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
});
export const updateKanbanTagSchema = createKanbanTagSchema;
export const createKanbanCardSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string(),
  stateId: z.string().uuid(),
  priority: kanbanPrioritySchema.default('MEDIA'),
  assigneeUserId: z.string().uuid().nullable().optional(),
  reviewerUserId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).default([]),
});
export const updateKanbanCardSchema = createKanbanCardSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Debes enviar al menos un cambio',
  );

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type CreateKanbanInput = z.infer<typeof createKanbanSchema>;
export type CreateKanbanCardInput = z.infer<typeof createKanbanCardSchema>;
export type UpdateKanbanCardInput = z.infer<typeof updateKanbanCardSchema>;

export const createTicketSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  type: ticketTypeSchema.default('REQUERIMIENTO'),
  priority: ticketPrioritySchema.default('MEDIA'),
  platform: platformSchema.nullable().optional(),
});

export const updateTicketSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(4000).optional(),
    type: ticketTypeSchema.optional(),
    priority: ticketPrioritySchema.optional(),
    status: ticketStatusSchema.optional(),
    platform: platformSchema.nullable().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    'Debes enviar al menos un cambio',
  );

export const ticketFiltersSchema = z.object({
  platform: z.union([platformSchema, z.literal('UNASSIGNED')]).optional(),
  type: ticketTypeSchema.optional(),
  status: ticketStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
  unassignedOnly: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const discordRoleUpdateSchema = z.object({ enabled: z.boolean() });

export type CreateTicketInput = z.input<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
