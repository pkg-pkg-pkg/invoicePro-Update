import { APP_VERSION } from '@/constants/appBranding';
import { getLogs, type ErrorLogEntry } from '../errorLogger';
import { isElectronRuntime, isTauriRuntime } from '../../utils/runtime';
import {
  EMPTY_FEATURE_COUNTERS,
  type FeatureUsageCounters,
  type SanitizedDiagnosticsPayload,
} from '../../types/privacyDiagnostics';
import { getFeatureUsageCounters } from './featureAnalyticsService';
import { getPrivacySettings } from './privacySettingsService';

const PII_PATTERNS: RegExp[] = [
  /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/gi,
  /\b[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/gi,
  /\b\d{10}\b/g,
  /\b[\w.+-]+@[\w.-]+\.\w+\b/gi,
  /₹\s*[\d,]+(?:\.\d{1,2})?/g,
];

export function scrubDiagnosticText(value: string): string {
  let out = String(value ?? '');
  for (const pattern of PII_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out.slice(0, 2000);
}

function scrubErrorLogs(logs: ErrorLogEntry[]): ErrorLogEntry[] {
  return logs.slice(-50).map((entry) => ({
    ...entry,
    message: scrubDiagnosticText(entry.message),
  }));
}

export function getRuntimeLabel(): SanitizedDiagnosticsPayload['runtime'] {
  if (isElectronRuntime()) return 'electron';
  if (isTauriRuntime()) return 'tauri';
  return 'browser';
}

export async function getOsVersionLabel(): Promise<string> {
  try {
    if (isElectronRuntime() && window.electronAPI?.getAppSystemInfo) {
      const info = await window.electronAPI.getAppSystemInfo();
      const platform = String(info?.platform ?? '').trim();
      const osLabel = String(info?.osLabel ?? '').trim();
      if (platform && osLabel) return `${platform} / ${osLabel}`;
      if (osLabel) return osLabel;
    }
  } catch {
    // fall through
  }
  return scrubDiagnosticText(navigator.platform || navigator.userAgent.slice(0, 120));
}

export type BuildDiagnosticsOptions = {
  /** User explicitly consented to attach diagnostics for this submission. */
  userConsented: boolean;
  includeAppInfo?: boolean;
  includeErrorLogs?: boolean;
  includeFeatureCounters?: boolean;
};

export async function buildDiagnosticsPayload(
  options: BuildDiagnosticsOptions
): Promise<SanitizedDiagnosticsPayload | null> {
  if (!options.userConsented) return null;

  const settings = getPrivacySettings();
  const includeAppInfo = options.includeAppInfo ?? settings.sendAnonymousDiagnostics;
  const includeErrorLogs = options.includeErrorLogs ?? settings.sendAnonymousDiagnostics;
  const includeFeatureCounters = options.includeFeatureCounters ?? settings.participateInProductImprovement;

  if (!includeAppInfo && !includeErrorLogs && !includeFeatureCounters) return null;

  const counters: FeatureUsageCounters = includeFeatureCounters
    ? getFeatureUsageCounters()
    : { ...EMPTY_FEATURE_COUNTERS };

  return {
    appVersion: includeAppInfo ? APP_VERSION : '',
    osVersion: includeAppInfo ? await getOsVersionLabel() : '',
    runtime: includeAppInfo ? getRuntimeLabel() : 'browser',
    errorLogs: includeErrorLogs ? scrubErrorLogs(getLogs()) : [],
    featureUsageCounters: counters,
    collectedAt: new Date().toISOString(),
  };
}

/** Audit preview — JSON string shown to user before send. */
export async function previewDiagnosticsPayload(
  options: BuildDiagnosticsOptions
): Promise<string> {
  const payload = await buildDiagnosticsPayload(options);
  if (!payload) {
    return JSON.stringify(
      {
        note: 'No diagnostics will be attached. Enable privacy settings and consent to include data.',
      },
      null,
      2
    );
  }
  return JSON.stringify(payload, null, 2);
}

export function assertDiagnosticsPayloadSafe(payload: SanitizedDiagnosticsPayload): void {
  const allowedTopKeys = new Set([
    'appVersion',
    'osVersion',
    'runtime',
    'errorLogs',
    'featureUsageCounters',
    'collectedAt',
  ]);
  for (const key of Object.keys(payload)) {
    if (!allowedTopKeys.has(key)) {
      throw new Error(`Unexpected diagnostics field: ${key}`);
    }
  }
}
