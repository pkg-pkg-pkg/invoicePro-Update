import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  FormControlLabel,
  Switch,
  Typography,
  Button,
  Stack,
} from '@mui/material';
import { SettingsSectionBlock } from './SettingsShell';
import type { PrivacySettings } from '../../types/privacyDiagnostics';
import {
  getPrivacySettings,
  savePrivacySettings,
  subscribePrivacySettings,
} from '../../services/privacy/privacySettingsService';
import { previewDiagnosticsPayload } from '../../services/privacy/diagnosticsService';
import DiagnosticsPreviewDialog from '../privacy/DiagnosticsPreviewDialog';

export default function PrivacySettingsPanel() {
  const [settings, setSettings] = useState<PrivacySettings>(() => getPrivacySettings());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewJson, setPreviewJson] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => subscribePrivacySettings(() => setSettings(getPrivacySettings())), []);

  const update = (patch: Partial<PrivacySettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    savePrivacySettings(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const openAuditPreview = async () => {
    const json = await previewDiagnosticsPayload({
      userConsented: true,
    });
    setPreviewJson(json);
    setPreviewOpen(true);
  };

  return (
    <>
      <SettingsSectionBlock
        title="Privacy Settings"
        subtitle="All diagnostics are off by default. You choose what to share, and can preview payloads before sending."
      >
        {saved ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Privacy settings saved.
          </Alert>
        ) : null}

        <Stack spacing={1.5}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.sendAnonymousDiagnostics}
                onChange={(e) => update({ sendAnonymousDiagnostics: e.target.checked })}
              />
            }
            label="Send Anonymous Diagnostics"
          />
          <Typography variant="caption" color="text.secondary" sx={{ pl: 4, mt: -1 }}>
            When you opt in while sending feedback or crash reports: app version, OS version, and
            scrubbed error logs only.
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={settings.participateInProductImprovement}
                onChange={(e) => update({ participateInProductImprovement: e.target.checked })}
              />
            }
            label="Participate in Product Improvement"
          />
          <Typography variant="caption" color="text.secondary" sx={{ pl: 4, mt: -1 }}>
            Tracks anonymous counters only (e.g. invoices created, backups). No amounts, parties, or
            document numbers.
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={settings.sendCrashReports}
                onChange={(e) => update({ sendCrashReports: e.target.checked })}
              />
            }
            label="Send Crash Reports"
          />
          <Typography variant="caption" color="text.secondary" sx={{ pl: 4, mt: -1 }}>
            Pre-selects diagnostics on crash prompts. You always review before sending.
          </Typography>
        </Stack>

        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={() => void openAuditPreview()}>
            Preview diagnostics payload (audit)
          </Button>
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          We never collect customer data, ledger data, invoices, GST data, mobile numbers, or
          financial records in diagnostics.
        </Alert>
      </SettingsSectionBlock>

      <DiagnosticsPreviewDialog
        open={previewOpen}
        previewJson={previewJson}
        onClose={() => setPreviewOpen(false)}
        readOnly
        title="Privacy audit — diagnostics payload preview"
      />
    </>
  );
}
