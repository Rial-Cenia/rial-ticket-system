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
  images: TicketImage[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketImage {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
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

export interface DiscordAccountLink {
  userId: string;
  discordUserId: string;
  discordUsername: string;
  discordDisplayName: string | null;
  discordAvatarHash: string | null;
  guildNickname: string | null;
  linkedAt: string;
  updatedAt: string;
}

export interface DiscordLinkedUser {
  userId: string;
  email: string;
  name: string;
  link: DiscordAccountLink | null;
  isGuildMember: boolean;
  hasTriagerRole: boolean;
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  PENDIENTE: '⏳ Pendientito',
  EN_PROGRESO: '🚧 Cocinándose',
  EN_STAGING: '🧪 En pruebibas',
  EN_ESPERA: '💤 En pausita',
  RESUELTO: '✨ Resuelto, slay',
};

export const TYPE_LABELS: Record<TicketType, string> = {
  REQUERIMIENTO: '📋 Nueva petición',
  MEJORA: '✨ Mejora con glow-up',
  DUDA: '💭 Dudita existencial',
  BUG: '🐛 Bug travieso',
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  NESTOR: '🌸 Nestor',
  DYLAN: '⭐ Dylan',
  ATOM: '⚛️ Atom',
  KAYS: '🎀 Kays',
};
