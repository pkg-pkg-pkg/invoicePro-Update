import React from 'react';
import { Box, Stack, Typography, alpha, useTheme } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import type { SettingsHealthSnapshot } from '../../services/settingsHealthService';

interface HealthRowProps {
  ok: boolean;
  label: string;
}

function HealthRow({ ok, label }: HealthRowProps) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <FiberManualRecordIcon sx={{ fontSize: 10, color: ok ? 'success.main' : 'error.main' }} />
      <Typography variant="body2">{label}</Typography>
    </Stack>
  );
}

interface Props {
  health: SettingsHealthSnapshot;
}

export default function SettingsHealthPanel({ health }: Props) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3,
        border: '1px solid var(--border)',
        bgcolor: 'var(--bg-card)',
        boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.04)}`,
        height: '100%',
      }}
    >
      <Typography variant="subtitle1" fontWeight={800} gutterBottom>
        System Health
      </Typography>
      <Stack spacing={0.75} sx={{ mb: 1.5 }}>
        <HealthRow ok={health.databaseConnected} label="Database Connected" />
        <HealthRow ok={health.backupWorking} label="Backup Working" />
        <HealthRow ok={health.gstActive} label="GST Active" />
        <HealthRow ok={health.whatsAppConnected} label="WhatsApp Connected" />
        <HealthRow ok={health.networkAvailable} label="Network Available" />
      </Stack>
      <Typography variant="caption" color="text.secondary" display="block">
        Version: {health.version}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        Last Sync: {health.lastSync}
      </Typography>
    </Box>
  );
}
