export const TICKET_TYPES = ['REQUERIMIENTO', 'MEJORA', 'DUDA', 'BUG'] as const;
export const TICKET_STATUSES = [
  'PENDIENTE',
  'EN_PROGRESO',
  'EN_STAGING',
  'EN_ESPERA',
  'RESUELTO',
] as const;
export const PLATFORMS = [
  'NESTOR',
  'DYLAN',
  'ATOM',
  'KAYS',
  'EXTERNO',
] as const;
export const TICKET_PRIORITIES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;

export type TicketType = (typeof TICKET_TYPES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type Platform = (typeof PLATFORMS)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type ActivitySource = 'WEB' | 'DISCORD';
export type OutboxJobType =
  'CREATE_TRIAGE_THREAD' | 'SEND_THREAD_MESSAGE' | 'ARCHIVE_THREAD';
export const APP_ROLES = ['ADMIN', 'USER'] as const;
export const TEAM_MEMBERSHIP_ROLES = ['LEADER', 'MEMBER'] as const;
export const KANBAN_PRIORITIES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
export type AppRole = (typeof APP_ROLES)[number];
export type TeamMembershipRole = (typeof TEAM_MEMBERSHIP_ROLES)[number];
export type KanbanPriority = (typeof KANBAN_PRIORITIES)[number];
export type RecordStatus = 'ACTIVE' | 'CANCELLED';

export interface Ticket {
  id: number;
  publicId: string;
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
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

export interface DiscordConversationAttachment {
  id: string;
  fileName: string;
  url: string;
}

export interface DiscordConversationMessage {
  id: string;
  authorName: string;
  isBot: boolean;
  content: string;
  attachments: DiscordConversationAttachment[];
  createdAt: string;
}

export interface DiscordConversation {
  threadUrl: string;
  messages: DiscordConversationMessage[];
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
  membershipUnavailable?: boolean;
}

export interface AppUser {
  userId: string;
  email: string;
  name: string;
  role: AppRole;
}

export interface TeamMember extends AppUser {
  membershipId: string;
  membershipRole: TeamMembershipRole;
}

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  canManage: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanState {
  id: string;
  kanbanId: string;
  name: string;
  position: number;
}

export interface KanbanTag {
  id: string;
  kanbanId: string;
  name: string;
}

export interface KanbanCardUser {
  userId: string;
  name: string;
  email: string;
  isCurrentMember: boolean;
}

export interface KanbanCard {
  id: string;
  kanbanId: string;
  title: string;
  description: string;
  stateId: string;
  priority: KanbanPriority;
  assignee: KanbanCardUser | null;
  reviewer: KanbanCardUser | null;
  tags: KanbanTag[];
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Kanban {
  id: string;
  name: string;
  teams: Array<Pick<Team, 'id' | 'name'>>;
  states: KanbanState[];
  tags: KanbanTag[];
  members: AppUser[];
  cards: KanbanCard[];
  canManage: boolean;
  canDeleteCards: boolean;
  createdAt: string;
  updatedAt: string;
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

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  BAJA: '🌱 Suavecito, puede esperar',
  MEDIA: '✨ Importante, pero respiramos',
  ALTA: '🔥 Ojo aquí, urge prontito',
  CRITICA: '🚨 Todo arde, ayuda ya',
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  NESTOR: '🌸 Nestor',
  DYLAN: '⭐ Dylan',
  ATOM: '⚛️ Atom',
  KAYS: '🎀 Kays',
  EXTERNO: '🌍 Externo',
};
