import type { PendingCrashReport } from '../../types/privacyDiagnostics';
import { pushStructuredError } from '../errorLogger';

let pending: PendingCrashReport | null = null;
const listeners = new Set<(report: PendingCrashReport | null) => void>();

function notify(): void {
  listeners.forEach((fn) => fn(pending));
}

export function captureCrash(error: Error, componentStack?: string): PendingCrashReport {
  const report: PendingCrashReport = {
    id: `crash-${Date.now()}`,
    message: error.message || 'Unknown error',
    stack: error.stack,
    componentStack,
    capturedAt: new Date().toISOString(),
  };
  pushStructuredError('error', report.message, { stack: report.stack, componentStack });
  pending = report;
  notify();
  return report;
}

export function getPendingCrashReport(): PendingCrashReport | null {
  return pending;
}

export function clearPendingCrashReport(): void {
  pending = null;
  notify();
}

export function subscribePendingCrashReport(
  listener: (report: PendingCrashReport | null) => void
): () => void {
  listeners.add(listener);
  listener(pending);
  return () => listeners.delete(listener);
}

export function initGlobalCrashHandlers(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    const err = event.error instanceof Error ? event.error : new Error(String(event.message || 'Script error'));
    captureCrash(err);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const err =
      reason instanceof Error
        ? reason
        : new Error(typeof reason === 'string' ? reason : 'Unhandled promise rejection');
    captureCrash(err);
  });
}
