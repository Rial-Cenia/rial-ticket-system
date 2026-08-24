export const TICKET_TYPES = ['REQUERIMIENTO', 'MEJORA', 'DUDA', 'BUG'] as const;
export const TICKET_STATUSES = [
  'PENDIENTE',
  'EN_PROGRESO',
  'EN_STAGING',
  'EN_ESPERA',
  'RESUELTO',
] as const;
export const PLATFORMS = ['NESTOR', 'DYLAN', 'ATOM', 'KAYS'] as const;

export type TicketType = (typeof TICKET_TYPES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type Platform = (typeof PLATFORMS)[number];
export type ActivitySource = 'WEB' | 'DISCORD';
export type OutboxJobType =
  'CREATE_TRIAGE_THREAD' | 'SEND_THREAD_MESSAGE' | 'ARCHIVE_THREAD';

export interface Ticket {
  id: number;
  publicId: string;
  title: string;
  description: string;
  type: TicketType;
  status: TicketStatus;
  platform: Platform | null;
  createdByName: string;
  createdByDiscordId: string | null;
  discordThreadId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketActivity {
  id: number;
  ticketPublicId: string;
  source: ActivitySource;
  action: string;
  actorName: string;
  actorId: string | null;
  changes: Record<string, unknown>;
  createdAt: string;
}

export interface OutboxJob {
  id: string;
  ticketPublicId: string;
  type: OutboxJobType;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'DEAD_LETTER';
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  lockedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketFilters {
  platform?: Platform | 'UNASSIGNED';
  type?: TicketType;
  status?: TicketStatus;
  search?: string;
  unassignedOnly?: boolean;
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  EN_STAGING: 'En staging',
  EN_ESPERA: 'En espera',
  RESUELTO: 'Resuelto',
};

export const TYPE_LABELS: Record<TicketType, string> = {
  REQUERIMIENTO: 'Requerimiento',
  MEJORA: 'Mejora',
  DUDA: 'Duda',
  BUG: 'Bug',
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  NESTOR: 'Nestor',
  DYLAN: 'Dylan',
  ATOM: 'Atom',
  KAYS: 'Kays',
};
