import { z } from 'zod';
import {
  PLATFORMS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
} from '@/lib/types';

export const ticketTypeSchema = z.enum(TICKET_TYPES);
export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export const platformSchema = z.enum(PLATFORMS);
export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES);

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
