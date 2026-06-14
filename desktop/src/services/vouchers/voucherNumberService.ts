import type { Voucher, VoucherType } from '../../types/vouchers';
import type {
  VoucherNumberProfileKey,
  VoucherNumberingSettings,
  VoucherTypeNumberConfig,
} from '../../types/voucherNumbering';
import {
  createDefaultVoucherNumberingSettings,
  DEFAULT_VOUCHER_TYPE_CONFIG,
  salesDocKindToProfileKey,
  voucherTypeToProfileKey,
} from '../../types/voucherNumbering';
import type { SalesDocKind } from '../../types/salesDocuments';
import { indianFYStartYearForDate } from '../../utils/indianFY';
import { companyScopedKey } from '../../utils/companyStorage';
import { getAppSettings, saveAppSettings } from '../appSettingsService';
import { readList, writeList } from '../masters/storageHelpers';

const VOUCHERS_KEY = companyScopedKey('pve_vouchers');
const COUNTERS_KEY = companyScopedKey('pve_voucher_number_counters_v2');
const LEGACY_INVOICE_COUNTER_KEY = companyScopedKey('pve_invoice_counter');

type CounterState = Record<string, { periodKey: string; lastNumber: number }>;

const DEFAULT_TYPE_CONFIG = DEFAULT_VOUCHER_TYPE_CONFIG;

function fyKeyShort(date = new Date()): string {
  const y = indianFYStartYearForDate(date);
  return `${String(y).slice(-2)}-${String(y + 1).slice(-2)}`;
}

function fyKeyLong(date = new Date()): string {
  const y = indianFYStartYearForDate(date);
  return `${y}-${y + 1}`;
}

function periodKeyForConfig(config: VoucherTypeNumberConfig, date: Date): string {
  if (config.resetSequence === 'never') return 'all';
  if (config.resetSequence === 'monthly') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  return config.fyFormat === 'long' ? fyKeyLong(date) : fyKeyShort(date);
}

function readCounters(): CounterState {
  try {
    const raw = localStorage.getItem(COUNTERS_KEY);
    return raw ? (JSON.parse(raw) as CounterState) : {};
  } catch {
    return {};
  }
}

function writeCounters(state: CounterState): void {
  localStorage.setItem(COUNTERS_KEY, JSON.stringify(state));
}

export function getDefaultVoucherNumberingSettings(): VoucherNumberingSettings {
  return createDefaultVoucherNumberingSettings();
}

export function getVoucherNumberingSettings(): VoucherNumberingSettings {
  const settings = getAppSettings();
  const stored = settings.voucherNumbering;
  const defaults = getDefaultVoucherNumberingSettings();
  const types = { ...defaults.types };
  if (stored?.types) {
    for (const key of Object.keys(defaults.types) as VoucherNumberProfileKey[]) {
      types[key] = { ...defaults.types[key], ...(stored.types[key] ?? {}) };
    }
  }
  return {
    types,
    migrationCompleted: Boolean(stored?.migrationCompleted),
    migrationCompletedAt: stored?.migrationCompletedAt,
  };
}

export function saveVoucherNumberingSettings(next: VoucherNumberingSettings): void {
  const settings = getAppSettings();
  saveAppSettings({ ...settings, voucherNumbering: next });
}

export function getTypeNumberConfig(profile: VoucherNumberProfileKey): VoucherTypeNumberConfig {
  return getVoucherNumberingSettings().types[profile] ?? DEFAULT_TYPE_CONFIG[profile];
}

export function isInternalVoucherNumber(number: string | null | undefined): boolean {
  const n = String(number ?? '').trim();
  if (!n) return true;
  return /^vch-[a-z0-9-]+$/i.test(n);
}

export function isLegacyAutoVoucherNumber(number: string | null | undefined): boolean {
  const n = String(number ?? '').trim();
  if (!n) return false;
  return /^(PAY|REC|PUR|PR|JV|CON|EXP|SALES|SINV|PINV)-\d{8}(-\d+)?$/i.test(n);
}

export function shouldReplaceVoucherNumber(number: string | null | undefined): boolean {
  return isInternalVoucherNumber(number) || isLegacyAutoVoucherNumber(number);
}

export function buildPreviewNumber(
  profile: VoucherNumberProfileKey,
  config: VoucherTypeNumberConfig,
  nextSequence = config.startingNumber,
  date = new Date()
): string {
  const parts: string[] = [config.prefix.trim() || profile];
  if (config.includeFinancialYear) {
    parts.push(config.fyFormat === 'long' ? fyKeyLong(date) : fyKeyShort(date));
  }
  parts.push(String(nextSequence).padStart(Math.max(1, config.padDigits), '0'));
  return parts.join(config.separator || '/');
}

export function formatVoucherNumber(
  profile: VoucherNumberProfileKey,
  sequence: number,
  date = new Date()
): string {
  return buildPreviewNumber(profile, getTypeNumberConfig(profile), sequence, date);
}

function counterStorageKey(profile: VoucherNumberProfileKey, periodKey: string): string {
  return `${profile}::${periodKey}`;
}

function parseSequenceFromFormatted(number: string, profile: VoucherNumberProfileKey): number | null {
  const config = getTypeNumberConfig(profile);
  const sep = config.separator || '/';
  const parts = number.split(sep).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1];
  if (!/^\d+$/.test(last)) return null;
  const seq = parseInt(last, 10);
  return Number.isFinite(seq) ? seq : null;
}

async function maxSequenceFromExisting(
  profile: VoucherNumberProfileKey,
  config: VoucherTypeNumberConfig,
  dateForPeriod: Date
): Promise<number> {
  const vouchers = await readList<Voucher>(VOUCHERS_KEY);
  const voucherType = profile as VoucherType;
  let max = config.startingNumber - 1;
  const expectedPeriod = periodKeyForConfig(config, dateForPeriod);

  for (const v of vouchers) {
    if ((v.status ?? 'ACTIVE') === 'CANCELLED') continue;
    if (v.type !== voucherType) continue;
    if (shouldReplaceVoucherNumber(v.number)) continue;
    const vDate = new Date(v.date || v.createdAt);
    if (periodKeyForConfig(config, vDate) !== expectedPeriod) continue;
    const seq = parseSequenceFromFormatted(v.number, profile);
    if (seq != null && seq > max) max = seq;
  }
  return max;
}

export async function peekNextVoucherNumber(
  profile: VoucherNumberProfileKey,
  dateISO?: string
): Promise<string> {
  const config = getTypeNumberConfig(profile);
  const date = dateISO ? new Date(dateISO) : new Date();
  const periodKey = periodKeyForConfig(config, date);
  const storageKey = counterStorageKey(profile, periodKey);
  const counters = readCounters();
  const stored = counters[storageKey];
  const maxFromVouchers = await maxSequenceFromExisting(profile, config, date);
  let base = config.startingNumber - 1;
  if (stored?.periodKey === periodKey) base = Math.max(base, stored.lastNumber);
  base = Math.max(base, maxFromVouchers);
  const next = Math.max(base + 1, config.startingNumber);
  return formatVoucherNumber(profile, next, date);
}

export async function commitVoucherNumber(
  profile: VoucherNumberProfileKey,
  number: string,
  dateISO?: string
): Promise<void> {
  const config = getTypeNumberConfig(profile);
  const seq = parseSequenceFromFormatted(number, profile);
  if (seq == null) return;
  const date = dateISO ? new Date(dateISO) : new Date();
  const periodKey = periodKeyForConfig(config, date);
  const storageKey = counterStorageKey(profile, periodKey);
  const counters = readCounters();
  const stored = counters[storageKey];
  if (!stored || stored.periodKey !== periodKey || seq > stored.lastNumber) {
    counters[storageKey] = { periodKey, lastNumber: seq };
    writeCounters(counters);
  }
}

export async function allocateNextVoucherNumber(type: VoucherType, dateISO: string): Promise<string> {
  const profile = voucherTypeToProfileKey(type);
  const number = await peekNextVoucherNumber(profile, dateISO);
  await commitVoucherNumber(profile, number, dateISO);
  return number;
}

export async function assertUniqueVoucherNumber(
  type: VoucherType,
  number: string,
  excludeVoucherId?: string
): Promise<void> {
  const vouchers = await readList<Voucher>(VOUCHERS_KEY);
  const dup = vouchers.find(
    (v) =>
      v.type === type &&
      v.number === number &&
      (v.status ?? 'ACTIVE') === 'ACTIVE' &&
      v.id !== excludeVoucherId
  );
  if (dup) throw new Error(`Voucher number "${number}" already exists for this type.`);
}

export async function migrateLegacyVoucherNumbers(): Promise<{ updated: number }> {
  const numbering = getVoucherNumberingSettings();
  if (numbering.migrationCompleted) return { updated: 0 };

  const vouchers = await readList<Voucher>(VOUCHERS_KEY);
  const toMigrate = vouchers.filter((v) => shouldReplaceVoucherNumber(v.number));
  if (toMigrate.length === 0) {
    saveVoucherNumberingSettings({
      ...numbering,
      migrationCompleted: true,
      migrationCompletedAt: new Date().toISOString(),
    });
    return { updated: 0 };
  }

  const groups = new Map<string, Voucher[]>();
  for (const v of toMigrate) {
    const profile = voucherTypeToProfileKey(v.type);
    const config = getTypeNumberConfig(profile);
    const date = new Date(v.date || v.createdAt);
    const period = periodKeyForConfig(config, date);
    const key = `${profile}::${period}`;
    const list = groups.get(key) ?? [];
    list.push(v);
    groups.set(key, list);
  }

  let updated = 0;
  const voucherById = new Map(vouchers.map((v) => [v.id, { ...v }]));

  for (const [groupKey, list] of groups) {
    const [profileKey] = groupKey.split('::') as [VoucherNumberProfileKey, string];
    const config = getTypeNumberConfig(profileKey);
    list.sort((a, b) => {
      const da = new Date(a.date || a.createdAt).getTime();
      const db = new Date(b.date || b.createdAt).getTime();
      if (da !== db) return da - db;
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });

    let seq = config.startingNumber;
    for (const v of list) {
      const date = new Date(v.date || v.createdAt);
      const number = formatVoucherNumber(profileKey, seq, date);
      const row = voucherById.get(v.id);
      if (row) {
        row.number = number;
        updated += 1;
      }
      seq += 1;
      await commitVoucherNumber(profileKey, number, v.date);
    }
  }

  await writeList(VOUCHERS_KEY, [...voucherById.values()]);
  saveVoucherNumberingSettings({
    ...numbering,
    migrationCompleted: true,
    migrationCompletedAt: new Date().toISOString(),
  });

  try {
    localStorage.removeItem(LEGACY_INVOICE_COUNTER_KEY);
  } catch {
    /* ignore */
  }

  return { updated };
}

export async function ensureVoucherNumbersMigrated(): Promise<void> {
  await migrateLegacyVoucherNumbers();
}

export async function peekNextPipelineNumber(kind: SalesDocKind, dateISO?: string): Promise<string> {
  const profile = salesDocKindToProfileKey(kind);
  if (!profile) return `DOC-${Date.now()}`;
  return peekNextVoucherNumber(profile, dateISO);
}

export async function commitPipelineNumber(
  kind: SalesDocKind,
  number: string,
  dateISO?: string
): Promise<void> {
  const profile = salesDocKindToProfileKey(kind);
  if (!profile) return;
  await commitVoucherNumber(profile, number, dateISO);
}

export async function resolveVoucherNumberForSave(
  type: VoucherType,
  dateISO: string,
  providedNumber?: string | null
): Promise<string> {
  const trimmed = String(providedNumber ?? '').trim();
  if (trimmed && !shouldReplaceVoucherNumber(trimmed)) {
    await assertUniqueVoucherNumber(type, trimmed);
    return trimmed;
  }
  return allocateNextVoucherNumber(type, dateISO);
}

export { voucherTypeToProfileKey, salesDocKindToProfileKey } from '../../types/voucherNumbering';
