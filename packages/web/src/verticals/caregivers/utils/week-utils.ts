export function formatWeekLabel(weekStartStr: string): string {
  if (!weekStartStr) return '';
  const [year, month, day] = weekStartStr.split('-').map((n) => parseInt(n, 10)) as [number, number, number];
  const start = new Date(Date.UTC(year, month - 1, day));
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);

  const startFormatted = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const endFormatted = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return `${startFormatted} – ${endFormatted}`;
}

export function shiftWeek(weekStartStr: string, deltaWeeks: number): string {
  const [year, month, day] = weekStartStr.split('-').map((n) => parseInt(n, 10)) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + deltaWeeks * 7);
  return date.toISOString().split('T')[0]!;
}
