export function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 is Sunday, 1 is Monday, ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
  return monday.toISOString().split('T')[0]!;
}

export function formatCutoffTime(cutoffAt: string): string {
  if (!cutoffAt) return '';
  const d = new Date(cutoffAt);
  if (isNaN(d.getTime())) return cutoffAt;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}
