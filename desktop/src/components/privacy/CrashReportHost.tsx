import { useEffect, useState } from 'react';
import type { PendingCrashReport } from '../../types/privacyDiagnostics';
import {
  getPendingCrashReport,
  subscribePendingCrashReport,
  clearPendingCrashReport,
} from '../../services/privacy/crashReportService';
import CrashReportDialog from './CrashReportDialog';

/** Global host for crash-report prompts (non-React error paths + ErrorBoundary). */
export default function CrashReportHost() {
  const [report, setReport] = useState<PendingCrashReport | null>(() => getPendingCrashReport());

  useEffect(() => subscribePendingCrashReport(setReport), []);

  if (!report) return null;

  return (
    <CrashReportDialog
      report={report}
      onDismiss={() => {
        clearPendingCrashReport();
        setReport(null);
      }}
      onReload={() => window.location.reload()}
    />
  );
}
