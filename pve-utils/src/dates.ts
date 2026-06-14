/** Format a Date or ISO string as DD/MM/YYYY. */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Return current timestamp as ISO string for sync payloads. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Parse DD/MM/YYYY or ISO date string to Date. */
export function parseDate(value: string): Date {
  if (value.includes('/')) {
    const [day, month, year] = value.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}
