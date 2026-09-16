import type { Platform, TicketPriority, TicketType } from '@/lib/types';

export interface TicketMetrics {
  rangeDays: number;
  summary: { openHighToday: number; unassigned: number; stagnant: number };
  volume: {
    createdByPlatform: Array<{ platform: string; count: number }>;
    urgencyByPlatform: Array<{
      platform: string;
      priority: TicketPriority;
      count: number;
    }>;
    typeDistribution: Array<{ type: TicketType; count: number }>;
    weeklyTrend: Array<{ week: string; created: number; resolved: number }>;
  };
  response: {
    ttaMinutes: number;
    ttrByPriority: Array<{
      priority: TicketPriority;
      count: number;
      mttrMinutes: number;
    }>;
    ttrByPlatform: Array<{
      platform: string;
      count: number;
      mttrMinutes: number;
    }>;
    sla: Array<{
      priority: TicketPriority;
      eligible: number;
      withinSla: number;
      percentage: number | null;
    }>;
    reopened: number;
  };
  quality: {
    mttrByPlatform: Array<{
      platform: string;
      count: number;
      mttrMinutes: number;
    }>;
    unassignedAfterHours: number;
    stagnantTickets: Array<{
      id: string;
      title: string;
      status: string;
      updatedAt: string;
    }>;
    similarGroups: Array<{
      type: TicketType;
      platform: Platform | 'UNASSIGNED';
      count: number;
      signature: string;
      tickets: Array<{ id: string; title: string }>;
    }>;
  };
}
