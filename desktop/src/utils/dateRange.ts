export const toLocalYmd = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Normalize ISO / date input to local calendar YYYY-MM-DD (avoids UTC slice bugs). */
export const normalizeToYmd = (input: string): string => {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return '';
  return toLocalYmd(d);
};

export const isDateWithinInclusive = (input: string, fromYmd: string, toYmd: string): boolean => {
  const at = normalizeToYmd(input);
  if (!at) return false;
  return at >= fromYmd && at <= toYmd;
};

export const currentCalendarMonthRange = (at: Date = new Date()): { from: string; to: string } => ({
  from: toLocalYmd(new Date(at.getFullYear(), at.getMonth(), 1)),
  to: toLocalYmd(new Date(at.getFullYear(), at.getMonth() + 1, 0)),
});
