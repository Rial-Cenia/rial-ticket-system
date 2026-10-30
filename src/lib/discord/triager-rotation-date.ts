const TIME_ZONE = 'America/Santiago';

export function getSantiagoDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function getMonday(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

export function getRotationIndex(
  startsOn: string,
  weekStartsOn: string,
  size: number,
) {
  if (size < 1) return -1;
  const weeks = Math.floor(
    (Date.parse(`${weekStartsOn}T00:00:00Z`) -
      Date.parse(`${startsOn}T00:00:00Z`)) /
      (7 * 24 * 60 * 60 * 1000),
  );
  return weeks < 0 ? -1 : weeks % size;
}

export function isRotationReminderTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  const minute = Number(values.minute);
  return (
    values.weekday === 'Mon' &&
    values.hour === '09' &&
    minute >= 30 &&
    minute < 40
  );
}
