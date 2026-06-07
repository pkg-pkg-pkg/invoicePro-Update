import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Computer as ComputerIcon,
  ContentCopy as CopyIcon,
  FolderOpen as FolderOpenIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { loadSystemInfoSnapshot, type SystemInfoSnapshot } from '../../services/systemInfoService';
import { revealPathInFolder } from '../../services/fileDialogService';

function InfoRow({
  label,
  value,
  mono = false,
  openPath,
}: {
  label: string;
  value: string;
  mono?: boolean;
  openPath?: string;
}) {
  const display = value || '—';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(display);
    } catch {
      /* ignore */
    }
  };

  const handleOpen = async () => {
    if (!openPath || openPath === '—') return;
    await revealPathInFolder(openPath);
  };

  return (
    <Grid container spacing={1} sx={{ py: 0.75, alignItems: 'flex-start' }}>
      <Grid item xs={12} sm={4}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={8}>
        <Stack direction="row" spacing={0.5} alignItems="flex-start">
          <Typography
            variant="body2"
            sx={{
              flex: 1,
              wordBreak: 'break-all',
              fontFamily: mono ? 'monospace' : undefined,
              fontSize: mono ? '0.8rem' : undefined,
            }}
          >
            {display}
          </Typography>
          {display !== '—' && (
            <Tooltip title="Copy">
              <IconButton size="small" onClick={handleCopy} aria-label={`Copy ${label}`}>
                <CopyIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
          {openPath && openPath !== '—' && (
            <Tooltip title="Open folder">
              <IconButton size="small" onClick={handleOpen} aria-label={`Open ${label}`}>
                <FolderOpenIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Grid>
    </Grid>
  );
}

const SystemInformationPanel: React.FC = () => {
  const [info, setInfo] = useState<SystemInfoSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await loadSystemInfoSnapshot();
      setInfo(snapshot);
    } catch (err) {
      setError((err as Error)?.message || 'Failed to load system information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          <ComputerIcon sx={{ mr: 1 }} />
          System Information
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={refresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Read-only profile of this installation — similar to Tally&apos;s System Information screen.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!info && loading && (
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      )}

      {info && (
        <Box>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Application
          </Typography>
          <InfoRow label="Product" value={info.appName} />
          <InfoRow label="Version" value={`v${info.appVersion}`} />
          <InfoRow label="Application path" value={info.applicationPath} mono openPath={info.applicationPath} />

          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Company &amp; Data
          </Typography>
          <InfoRow label="Active company" value={info.companyName} />
          <InfoRow label="Company ID" value={info.companyId} mono />
          <InfoRow label="Financial year" value={`${info.financialYear} (${info.fyRange})`} />
          <InfoRow label="Company data path" value={info.companyDataPath} mono openPath={info.companyDataPath} />
          <InfoRow label="User data path" value={info.userDataPath} mono openPath={info.userDataPath} />

          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Backup
          </Typography>
          <InfoRow label="Manual backup folder" value={info.backupFolder} mono openPath={info.backupFolder} />
          <InfoRow label="Last backup date" value={info.lastBackupDate} />
          <InfoRow
            label="Last backup file"
            value={info.lastBackupFile}
            mono
            openPath={info.lastBackupFile.includes('\\') || info.lastBackupFile.includes('/') ? info.lastBackupFile : undefined}
          />

          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" color="primary" gutterBottom>
            License &amp; Network
          </Typography>
          <Grid container spacing={1} sx={{ py: 0.75, alignItems: 'center' }}>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary">
                License edition
              </Typography>
            </Grid>
            <Grid item xs={12} sm={8}>
              <Chip
                size="small"
                label={info.licenseEdition}
                color={info.licenseEdition === 'Platinum' ? 'secondary' : 'default'}
              />
            </Grid>
          </Grid>
          <InfoRow label="License key" value={info.licenseKeyMasked} mono />
          <InfoRow
            label="Gateway (updates) valid till"
            value={
              info.gatewayValidUntil === '—'
                ? '—'
                : `${info.gatewayValidUntil}${info.gatewayUpdatesEntitled ? '' : ' (expired)'}`
            }
          />
          <InfoRow
            label="Multi-user LAN"
            value={
              info.multiUserEnabled
                ? `${info.multiUserRole}${info.multiUserServerUrl !== '—' ? ` · ${info.multiUserServerUrl}` : ''}`
                : 'Disabled'
            }
          />

          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Computer
          </Typography>
          <InfoRow label="Operating system" value={info.osLabel} />
          <InfoRow label="Host name" value={info.hostName} />
          <InfoRow
            label="Platform / RAM"
            value={
              info.totalMemoryGb != null
                ? `${info.platform} · ${info.totalMemoryGb} GB RAM`
                : info.platform
            }
          />
        </Box>
      )}
    </Paper>
  );
};

export default SystemInformationPanel;
