export const toLocalYmd = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const isDateWithinInclusive = (input: string, fromYmd: string, toYmd: string): boolean => {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return false;
  const at = toLocalYmd(d);
  return at >= fromYmd && at <= toYmd;
};

export const currentCalendarMonthRange = (at: Date = new Date()): { from: string; to: string } => ({
  from: toLocalYmd(new Date(at.getFullYear(), at.getMonth(), 1)),
  to: toLocalYmd(new Date(at.getFullYear(), at.getMonth() + 1, 0)),
});
