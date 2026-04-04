export type PeriodIsoDate = string;

export interface AppFeatureToggles {
  gstEnabled: boolean;
  inventoryEnabled: boolean;
  payrollEnabled: boolean;
  multiCurrencyEnabled: boolean;
}

export interface FinancialYearConfig {
  startDate: PeriodIsoDate;
  endDate: PeriodIsoDate;
}

export interface InvoiceNumberingConfig {
  prefix?: string;
  suffix?: string;
  startingNumber?: number;
}

export interface AppSettings {
  financialYear: FinancialYearConfig;
  lockDate?: PeriodIsoDate;
  features: AppFeatureToggles;
  invoiceNumbering?: InvoiceNumberingConfig;
}

const STORAGE_KEY = 'pve_app_settings';

const isoToday = () => new Date().toISOString().slice(0, 10);

const computeDefaultFinancialYear = (): FinancialYearConfig => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = now.getMonth();

  const startYear = mm >= 3 ? yyyy : yyyy - 1;
  const endYear = startYear + 1;

  const startDate = `${startYear}-04-01`;
  const endDate = `${endYear}-03-31`;

  return { startDate, endDate };
};

const defaultSettings = (): AppSettings => ({
  financialYear: computeDefaultFinancialYear(),
  lockDate: '',
  features: {
    gstEnabled: true,
    inventoryEnabled: true,
    payrollEnabled: false,
    multiCurrencyEnabled: false,
  },
  invoiceNumbering: {
    prefix: 'INV-',
    suffix: '',
    startingNumber: 1,
  },
});

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const toDate = (iso: any): Date | null => {
  try {
    const s = String(iso ?? '').trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const toIso = (d: Date) => d.toISOString().slice(0, 10);

export const getAppSettings = (): AppSettings => {
  const base = defaultSettings();
  const parsed = safeParse<Partial<AppSettings>>(localStorage.getItem(STORAGE_KEY), {});

  const fy = (parsed as any)?.financialYear ?? {};
  const features = (parsed as any)?.features ?? {};
  const inv = (parsed as any)?.invoiceNumbering ?? {};

  const out: AppSettings = {
    financialYear: {
      startDate: String(fy?.startDate ?? base.financialYear.startDate),
      endDate: String(fy?.endDate ?? base.financialYear.endDate),
    },
    lockDate: String((parsed as any)?.lockDate ?? base.lockDate ?? ''),
    features: {
      gstEnabled: Boolean(features?.gstEnabled ?? base.features.gstEnabled),
      inventoryEnabled: Boolean(features?.inventoryEnabled ?? base.features.inventoryEnabled),
      payrollEnabled: Boolean(features?.payrollEnabled ?? base.features.payrollEnabled),
      multiCurrencyEnabled: Boolean(features?.multiCurrencyEnabled ?? base.features.multiCurrencyEnabled),
    },
    invoiceNumbering: {
      prefix: String(inv?.prefix ?? base.invoiceNumbering?.prefix ?? ''),
      suffix: String(inv?.suffix ?? base.invoiceNumbering?.suffix ?? ''),
      startingNumber: Number(inv?.startingNumber ?? base.invoiceNumbering?.startingNumber ?? 1),
    },
  };

  return out;
};

export const saveAppSettings = (next: AppSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('appSettingsUpdated'));
};

export const updateAppSettings = (partial: Partial<AppSettings>) => {
  const prev = getAppSettings();
  const next: AppSettings = {
    ...prev,
    ...partial,
    financialYear: {
      ...prev.financialYear,
      ...(partial as any)?.financialYear,
    },
    features: {
      ...prev.features,
      ...(partial as any)?.features,
    },
  };

  saveAppSettings(next);
};

export const validateTransactionDate = (txDateIso: string) => {
  const settings = getAppSettings();
  const tx = toDate(txDateIso);
  if (!tx) {
    return { ok: false, message: 'Invalid date' };
  }

  const fyStart = toDate(settings.financialYear.startDate);
  const fyEnd = toDate(settings.financialYear.endDate);
  if (fyStart && tx < fyStart) {
    return { ok: false, message: `Date is before financial year start (${settings.financialYear.startDate})` };
  }
  if (fyEnd) {
    const fyEndInclusive = new Date(fyEnd);
    fyEndInclusive.setHours(23, 59, 59, 999);
    if (tx > fyEndInclusive) {
      return { ok: false, message: `Date is after financial year end (${settings.financialYear.endDate})` };
    }
  }

  const lock = toDate(settings.lockDate);
  if (lock) {
    const lockInclusive = new Date(lock);
    lockInclusive.setHours(23, 59, 59, 999);
    if (tx <= lockInclusive) {
      return { ok: false, message: `Entries are locked up to ${toIso(lockInclusive)}. Change lock date in Settings.` };
    }
  }

  return { ok: true, message: '' };
};

export const getDefaultTodayForEntry = () => {
  const settings = getAppSettings();
  const v = validateTransactionDate(isoToday());
  if (v.ok) return isoToday();

  const fyStart = toDate(settings.financialYear.startDate);
  const lock = toDate(settings.lockDate);
  const candidates: Date[] = [];
  if (fyStart) candidates.push(fyStart);
  if (lock) {
    const next = new Date(lock);
    next.setDate(next.getDate() + 1);
    candidates.push(next);
  }

  const best = candidates
    .filter((d) => Number.isFinite(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return best ? toIso(best) : isoToday();
};
