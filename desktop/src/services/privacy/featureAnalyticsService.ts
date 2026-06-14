import {
  EMPTY_FEATURE_COUNTERS,
  type FeatureUsageCounters,
  type FeatureUsageEvent,
} from '../../types/privacyDiagnostics';
import { getPrivacySettings } from './privacySettingsService';

const STORAGE_KEY = 'pve_feature_usage_counters_v1';

function readCounters(): FeatureUsageCounters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_FEATURE_COUNTERS };
    const parsed = JSON.parse(raw) as Partial<FeatureUsageCounters>;
    return { ...EMPTY_FEATURE_COUNTERS, ...parsed };
  } catch {
    return { ...EMPTY_FEATURE_COUNTERS };
  }
}

function writeCounters(counters: FeatureUsageCounters): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counters));
}

/** Anonymous feature counters — only when product-improvement opt-in is enabled. */
export function trackFeatureUsage(event: FeatureUsageEvent): void {
  if (!getPrivacySettings().participateInProductImprovement) return;
  const counters = readCounters();
  counters[event] = Number(counters[event] ?? 0) + 1;
  writeCounters(counters);
}

export function getFeatureUsageCounters(): FeatureUsageCounters {
  return readCounters();
}

export function resetFeatureUsageCounters(): void {
  writeCounters({ ...EMPTY_FEATURE_COUNTERS });
}
