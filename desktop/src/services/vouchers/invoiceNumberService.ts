import type { Voucher } from '../../types/vouchers';
import { indianFYBounds, indianFYStartYearForDate } from '../../utils/indianFY';
import { companyScopedKey } from '../../utils/companyStorage';
import { getAppSettings } from '../appSettingsService';
import { readList, writeList } from '../masters/storageHelpers';

const VOUCHERS_KEY = companyScopedKey('pve_vouchers');
const COUNTER_KEY = companyScopedKey('pve_invoice_counter');

interface InvoiceCounterState {
  fyKey: string;
  lastNumber: number;
}

function fyKeyForDate(date = new Date()): string {
  const y = indianFYStartYearForDate(date);
  return `${y}-${String(y + 1).slice(-2)}`;
}

function numberingConfig() {
  const inv = getAppSettings().invoiceNumbering ?? {};
  return {
    prefix: inv.prefix ?? 'INV-',
    suffix: inv.suffix ?? '',
    startingNumber: Math.max(1, Number(inv.startingNumber ?? 1)),
    pad: 4,
  };
}

function parseSequenceFromNumber(
  number: string,
  prefix: string,
  suffix: string
): number | null {
  if (!number.startsWith(prefix)) return null;
  let core = number.slice(prefix.length);
  if (suffix && core.endsWith(suffix)) core = core.slice(0, -suffix.length);
  const digits = core.replace(/\D/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

function formatInvoiceNumber(seq: number, prefix: string, suffix: string, pad: number): string {
  return `${prefix}${String(seq).padStart(pad, '0')}${suffix}`;
}

function readCounter(): InvoiceCounterState {
  try {
    const raw = localStorage.getItem(COUNTER_KEY);
    if (!raw) return { fyKey: '', lastNumber: 0 };
    return JSON.parse(raw) as InvoiceCounterState;
  } catch {
    return { fyKey: '', lastNumber: 0 };
  }
}

function writeCounter(state: InvoiceCounterState): void {
  localStorage.setItem(COUNTER_KEY, JSON.stringify(state));
}

function isInCurrentFY(dateISO: string, fyStartYear: number): boolean {
  const { fromISODate, toISODate } = indianFYBounds(fyStartYear);
  const d = dateISO.slice(0, 10);
  return d >= fromISODate && d <= toISODate;
}

async function maxSequenceInFY(vouchers: Voucher[]): Promise<number> {
  const { prefix, suffix, startingNumber } = numberingConfig();
  const fyStart = indianFYStartYearForDate(new Date());
  let maxSeq = startingNumber - 1;

  for (const v of vouchers) {
    if (v.type !== 'SALES') continue;
    if (!isInCurrentFY(v.date, fyStart)) continue;
    const seq = parseSequenceFromNumber(v.number, prefix, suffix);
    if (seq != null && seq > maxSeq) maxSeq = seq;
  }
  return maxSeq;
}

/** Next auto invoice number for current financial year (does not reserve). */
export async function peekNextInvoiceNumber(): Promise<string> {
  const { prefix, suffix, startingNumber, pad } = numberingConfig();
  const fyKey = fyKeyForDate();
  const vouchers = await readList<Voucher>(VOUCHERS_KEY);
  const maxFromVouchers = await maxSequenceInFY(vouchers);
  const stored = readCounter();

  let base = startingNumber - 1;
  if (stored.fyKey === fyKey) {
    base = Math.max(base, stored.lastNumber);
  }
  base = Math.max(base, maxFromVouchers);

  const next = Math.max(base + 1, startingNumber);
  return formatInvoiceNumber(next, prefix, suffix, pad);
}

export async function assertUniqueSalesInvoiceNumber(
  number: string,
  excludeVoucherId?: string
): Promise<void> {
  const vouchers = await readList<Voucher>(VOUCHERS_KEY);
  const dup = vouchers.find(
    (v) =>
      v.type === 'SALES' &&
      v.number === number &&
      (v.status ?? 'ACTIVE') === 'ACTIVE' &&
      v.id !== excludeVoucherId
  );
  if (dup) {
    throw new Error(`Invoice number "${number}" already exists. Use the next available number.`);
  }
}

/** Persist counter after successful SALES voucher save. */
export async function commitInvoiceNumber(number: string): Promise<void> {
  const { prefix, suffix } = numberingConfig();
  const seq = parseSequenceFromNumber(number, prefix, suffix);
  if (seq == null) return;

  const fyKey = fyKeyForDate();
  const stored = readCounter();
  if (stored.fyKey !== fyKey || seq > stored.lastNumber) {
    writeCounter({ fyKey, lastNumber: seq });
  }
}
