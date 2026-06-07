import type { EwayBillProvider } from '../types/ewayBill';
import { DEFAULT_EWAY_THRESHOLD } from '../types/ewayBill';
import { companyScopedKey } from '../utils/companyStorage';

export interface EwayBillSettings {
  askAboveThreshold: boolean;
  showReminderPopup: boolean;
  autoGenerateFuture: boolean;
  thresholdAmount: number;
  provider: EwayBillProvider;
}

const STORAGE_KEY = companyScopedKey('pve_eway_bill_settings');

const DEFAULT_SETTINGS: EwayBillSettings = {
  askAboveThreshold: true,
  showReminderPopup: true,
  autoGenerateFuture: false,
  thresholdAmount: DEFAULT_EWAY_THRESHOLD,
  provider: 'manual',
};

export function loadEwayBillSettings(): EwayBillSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<EwayBillSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      thresholdAmount: Number(parsed.thresholdAmount ?? DEFAULT_EWAY_THRESHOLD) || DEFAULT_EWAY_THRESHOLD,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveEwayBillSettings(settings: EwayBillSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
