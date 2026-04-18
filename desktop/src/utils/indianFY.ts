import { parseISO } from 'date-fns';

/** Calendar year in which FY *starts* (1 Apr) for a given date. Apr–Dec → that year; Jan–Mar → previous year. */
export function indianFYStartYearForDate(date: Date = new Date()): number {
  const m = date.getMonth();
  const y = date.getFullYear();
  return m >= 3 ? y : y - 1;
}

/** FY = 1 Apr `fyStartYear` … 31 Mar `fyStartYear + 1` (inclusive). */
export function indianFYBounds(fyStartYear: number): { fromISODate: string; toISODate: string } {
  const fromISODate = `${fyStartYear}-04-01`;
  const toISODate = `${fyStartYear + 1}-03-31`;
  return { fromISODate, toISODate };
}

/** Short label e.g. FY 25–26 */
export function labelIndianFY(fyStartYear: number): string {
  const a = String(fyStartYear % 100).padStart(2, '0');
  const b = String((fyStartYear + 1) % 100).padStart(2, '0');
  return `FY ${a}–${b}`;
}

/** For header / tooltips: same as labelIndianFY from “today”. */
export function formatIndianFinancialYearLabel(date: Date = new Date()): string {
  return labelIndianFY(indianFYStartYearForDate(date));
}

/** Display like `1-Apr-26 to 31-Mar-27` for FY starting `fyStartYear` (1 Apr … 31 Mar next year). */
export function formatIndianFYRangeShort(fyStartYear: number): string {
  const yy = (y: number) => String(y % 100).padStart(2, '0');
  return `1-Apr-${yy(fyStartYear)} to 31-Mar-${yy(fyStartYear + 1)}`;
}

/** FY start years that actually contain at least one voucher date (newest first). */
export function indianFYStartYearsWithVoucherDates(isoDates: Iterable<string | undefined | null>): number[] {
  const set = new Set<number>();
  for (const raw of isoDates) {
    if (raw == null || !String(raw).trim()) continue;
    const d = parseISO(String(raw).slice(0, 10));
    if (Number.isNaN(d.getTime())) continue;
    set.add(indianFYStartYearForDate(d));
  }
  return [...set].sort((a, b) => b - a);
}
