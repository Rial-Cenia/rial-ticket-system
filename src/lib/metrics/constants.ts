export const METRICS_DEFAULTS = {
  rangeDays: 30,
  staleDays: 3,
  unassignedHours: 4,
  slaHours: { BAJA: null, MEDIA: 72, ALTA: 24, CRITICA: 24 },
} as const;
