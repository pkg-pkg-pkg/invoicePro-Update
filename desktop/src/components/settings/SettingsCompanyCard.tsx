import React from 'react';
import { Box, Button, Grid, Stack, Typography, Chip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import BackupIcon from '@mui/icons-material/Backup';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { financialYearLabel } from '../dashboard/dashboardTheme';
import { getActiveCompanyId } from '../../utils/companyStorage';
import { backupService } from '../../services/backupService';

export interface SettingsCompanySnapshot {
  name: string;
  gstin: string;
  statePin: string;
  currentUser: string;
}

interface Props {
  snapshot: SettingsCompanySnapshot;
  onOpen: () => void;
  onEdit: () => void;
  onBackup: () => void;
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25, wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function SettingsCompanyCard({ snapshot, onOpen, onEdit, onBackup }: Props) {
  const history = backupService.getBackupHistory() as Array<{ date?: string; createdAt?: string }>;
  const lastBackup = history[0]?.date || history[0]?.createdAt || 'Never';
  const parsedState = snapshot.statePin.split(',').map((s) => s.trim()).filter(Boolean);
  const state = parsedState[0] || snapshot.statePin || '—';
  const backupLabel = lastBackup === 'Never' ? lastBackup : new Date(lastBackup).toLocaleString();

  return (
    <Box
      sx={{
        mt: 0.5,
        pt: 2,
        borderTop: '1px solid var(--border)',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle1" fontWeight={900}>
            {snapshot.name || 'Company'}
          </Typography>
          <Chip size="small" label="Active" color="primary" sx={{ fontWeight: 700, height: 22 }} />
          <Chip size="small" variant="outlined" label={getActiveCompanyId()} sx={{ height: 22 }} />
        </Stack>
        <Stack direction="row" spacing={0.75} flexShrink={0}>
          <Button size="small" variant="text" startIcon={<OpenInNewIcon />} onClick={onOpen}>
            Open
          </Button>
          <Button size="small" variant="contained" startIcon={<EditIcon />} onClick={onEdit}>
            Edit
          </Button>
          <Button size="small" variant="outlined" startIcon={<BackupIcon />} onClick={onBackup}>
            Backup
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={6} sm={4} md={2}>
          <MetaItem label="GSTIN" value={snapshot.gstin || '—'} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetaItem label="State" value={state} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetaItem label="Financial Year" value={financialYearLabel()} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetaItem label="Database" value="Local SQLite" />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetaItem label="Last Backup" value={backupLabel} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetaItem label="Current User" value={snapshot.currentUser || '—'} />
        </Grid>
      </Grid>
    </Box>
  );
}
