export function isFirstDeliveryDueSoon(
  dueDate: string | null | undefined,
  now = new Date(),
) {
  if (!dueDate) return false;
  const [year, month, day] = dueDate.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntilDue = Math.ceil(
    (due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  return daysUntilDue <= 1;
}
