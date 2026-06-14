import type { ErrorLogEntry } from '../services/errorLogger';

export type PrivacySettings = {
  sendAnonymousDiagnostics: boolean;
  participateInProductImprovement: boolean;
  sendCrashReports: boolean;
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  sendAnonymousDiagnostics: false,
  participateInProductImprovement: false,
  sendCrashReports: false,
};

export type FeatureUsageEvent =
  | 'invoiceCreated'
  | 'purchaseCreated'
  | 'backupCreated'
  | 'restorePerformed'
  | 'whatsappShare'
  | 'barcodeScan';

export type FeatureUsageCounters = Record<FeatureUsageEvent, number>;

export const EMPTY_FEATURE_COUNTERS: FeatureUsageCounters = {
  invoiceCreated: 0,
  purchaseCreated: 0,
  backupCreated: 0,
  restorePerformed: 0,
  whatsappShare: 0,
  barcodeScan: 0,
};

export type SanitizedDiagnosticsPayload = {
  appVersion: string;
  osVersion: string;
  runtime: 'electron' | 'browser' | 'tauri';
  errorLogs: ErrorLogEntry[];
  featureUsageCounters: FeatureUsageCounters;
  collectedAt: string;
};

export type FeedbackCategory =
  | 'bug'
  | 'feature-request'
  | 'improvement'
  | 'usability'
  | 'performance'
  | 'other';

export const FEEDBACK_CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature-request', label: 'Feature Request' },
  { value: 'improvement', label: 'Improvement Suggestion' },
  { value: 'usability', label: 'Usability / UX' },
  { value: 'performance', label: 'Performance' },
  { value: 'other', label: 'Other' },
];

export type PrivacyFeedbackPayload = {
  type: 'user_feedback' | 'crash_report';
  rating?: number;
  category: string;
  message: string;
  includeDiagnostics: boolean;
  diagnostics?: SanitizedDiagnosticsPayload;
};

export type PendingCrashReport = {
  id: string;
  message: string;
  stack?: string;
  componentStack?: string;
  capturedAt: string;
};
