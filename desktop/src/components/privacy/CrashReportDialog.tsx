import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  FormControlLabel,
  Checkbox,
  Box,
  CircularProgress,
} from '@mui/material';
import type { PendingCrashReport } from '../../types/privacyDiagnostics';
import { getPrivacySettings } from '../../services/privacy/privacySettingsService';
import { buildDiagnosticsPayload, previewDiagnosticsPayload } from '../../services/privacy/diagnosticsService';
import { privacyFeedbackService } from '../../services/privacy/privacyFeedbackService';
import { clearPendingCrashReport } from '../../services/privacy/crashReportService';
import DiagnosticsPreviewDialog from './DiagnosticsPreviewDialog';

type Props = {
  report: PendingCrashReport;
  onDismiss: () => void;
  onReload?: () => void;
};

export default function CrashReportDialog({ report, onDismiss, onReload }: Props) {
  const settings = getPrivacySettings();
  const [includeDiagnostics, setIncludeDiagnostics] = useState(settings.sendCrashReports);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewJson, setPreviewJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setIncludeDiagnostics(settings.sendCrashReports);
  }, [report.id, settings.sendCrashReports]);

  const openPreview = async () => {
    const json = await previewDiagnosticsPayload({
      userConsented: includeDiagnostics,
    });
    setPreviewJson(json);
    setPreviewOpen(true);
  };

  const handleSend = async () => {
    setLoading(true);
    setError('');
    try {
      const diagnostics = includeDiagnostics
        ? await buildDiagnosticsPayload({ userConsented: true })
        : undefined;
      const res = await privacyFeedbackService.send({
        type: 'crash_report',
        category: 'bug',
        message: [
          `Crash: ${report.message}`,
          report.stack ? `\nStack:\n${report.stack}` : '',
          report.componentStack ? `\nComponent stack:\n${report.componentStack}` : '',
        ]
          .join('')
          .slice(0, 8000),
        includeDiagnostics: Boolean(diagnostics),
        diagnostics: diagnostics ?? undefined,
      });
      setSent(true);
      clearPendingCrashReport();
      if (res.success) {
        window.setTimeout(onDismiss, 1200);
      }
    } catch (e) {
      setError((e as Error).message || 'Could not send crash report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open maxWidth="sm" fullWidth disableEscapeKeyDown={loading}>
        <DialogTitle sx={{ fontWeight: 800 }}>Send Error Report to PVE?</DialogTitle>
        <DialogContent>
          {sent ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              Error report queued. Thank you for helping improve InvoicePro.
            </Alert>
          ) : null}
          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            An unexpected error occurred. You can send an anonymous report to PVE for investigation.
          </Typography>
          <Box
            component="pre"
            sx={{
              p: 1.25,
              bgcolor: 'grey.100',
              borderRadius: 1,
              fontSize: '0.75rem',
              maxHeight: 160,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              mb: 2,
            }}
          >
            {report.message}
            {report.stack ? `\n\n${report.stack.slice(0, 1200)}` : ''}
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeDiagnostics}
                onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                disabled={loading || sent}
              />
            }
            label="Include optional anonymous diagnostics (app version, OS, error logs, usage counters)"
          />
          <Button size="small" onClick={() => void openPreview()} sx={{ mt: 0.5 }} disabled={loading}>
            Preview diagnostics payload
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={onDismiss} disabled={loading}>
            Dismiss
          </Button>
          {onReload ? (
            <Button onClick={onReload} disabled={loading}>
              Reload app
            </Button>
          ) : null}
          <Button
            variant="contained"
            onClick={() => void handleSend()}
            disabled={loading || sent}
            startIcon={loading ? <CircularProgress size={18} /> : undefined}
          >
            {loading ? 'Sending…' : 'Send report'}
          </Button>
        </DialogActions>
      </Dialog>

      <DiagnosticsPreviewDialog
        open={previewOpen}
        previewJson={previewJson}
        onClose={() => setPreviewOpen(false)}
        readOnly
      />
    </>
  );
}
