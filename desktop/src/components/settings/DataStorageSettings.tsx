import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import StorageIcon from '@mui/icons-material/Storage';
import {
  checkDataFolderWritable,
  getDataStorageConfig,
  getDataStorageDiagnostics,
  openDataPath,
  pickCustomDataFolder,
  setDataStorageLocation,
  showDataPathInFolder,
  type DataLocationType,
  type DataStorageConfig,
  type DataStorageDiagnostics,
} from '../../services/dataStorageService';
import { getProfileCompletionStatus } from '../../services/companyProfileDbService';
import type { CompanyProfileCompletionStatus } from '../../types/electron';

export default function DataStorageSettings() {
  const [config, setConfig] = useState<DataStorageConfig | null>(null);
  const [diag, setDiag] = useState<DataStorageDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [pendingType, setPendingType] = useState<DataLocationType>('appdata');
  const [customPath, setCustomPath] = useState('');
  const [useInstallFolder, setUseInstallFolder] = useState(false);
  const [moveExisting, setMoveExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profileStatus, setProfileStatus] = useState<CompanyProfileCompletionStatus | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, diagnostics, profile] = await Promise.all([
        getDataStorageConfig(),
        getDataStorageDiagnostics(),
        getProfileCompletionStatus(),
      ]);
      setConfig(cfg);
      setDiag(diagnostics);
      setProfileStatus(profile);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data storage info');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Path copied to clipboard');
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setError('Could not copy path');
    }
  };

  const applyLocationChange = async () => {
    setBusy(true);
    setError(null);
    try {
      let type: DataLocationType = pendingType;
      if (useInstallFolder) type = 'install';

      if (type === 'install') {
        const probe = await checkDataFolderWritable(config?.installDataRoot || '');
        if (!probe.ok) {
          setError(
            `Installation folder is not writable. ${probe.error || ''} Data will stay in AppData.`
          );
          setBusy(false);
          return;
        }
      }

      const res = await setDataStorageLocation({
        dataLocationType: type,
        customPath: type === 'custom' ? customPath : undefined,
        moveExisting,
      });

      if (!res.success) {
        setError(res.error || 'Failed to change data location');
        return;
      }

      if (res.fallbackApplied) {
        setMessage('Install folder not writable — using recommended AppData location.');
      } else {
        setMessage('Data location updated. Restart the app if anything looks out of sync.');
      }
      setChangeOpen(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <Typography color="text.secondary">Loading data storage…</Typography>;
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <StorageIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>
          Data Storage
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <Field label="Current Data Location" value={config?.dataRoot || '—'} />
          <Field label="Location Type" value={config?.dataLocationType || '—'} />
          <Field label="Current Database Path" value={config?.databasePath || diag?.databasePath || profileStatus?.databasePath || '—'} />
          <Field label="Current Backup Path" value={config?.backupPath || diag?.backupPath || '—'} />
          <Field label="Config File" value={config?.configPath || '—'} mono />
          <Field label="Business Profile Source" value="SQLite Database" />
          <Field
            label="Migration Status"
            value={
              profileStatus?.migrationStatus === 'completed' ||
              profileStatus?.MIGRATION_STATUS === 'completed'
                ? 'Completed'
                : 'Pending'
            }
          />
          {profileStatus && (
            <>
              <Field
                label="Profile Completed"
                value={profileStatus.profileCompleted || profileStatus.PROFILE_COMPLETED ? 'Yes' : 'No'}
              />
              <Field label="Profile check reason" value={profileStatus.reason || profileStatus.REASON || '—'} />
              <Field label="Company" value={profileStatus.companyName || profileStatus.COMPANY_NAME || '—'} />
            </>
          )}
          {diag && (
            <>
              <Field label="Database size" value={`${Math.round((diag.databaseSizeBytes || 0) / 1024)} KB`} />
            </>
          )}
        </Stack>
      </Paper>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
        <Button variant="contained" onClick={() => setChangeOpen(true)}>
          Change Data Location
        </Button>
        <Button
          variant="outlined"
          startIcon={<FolderOpenIcon />}
          onClick={() => config?.dataRoot && void openDataPath(config.dataRoot)}
          disabled={!config?.dataRoot}
        >
          Open Data Folder
        </Button>
        <Button
          variant="outlined"
          startIcon={<FolderOpenIcon />}
          onClick={() => config?.backupPath && void openDataPath(config.backupPath)}
          disabled={!config?.backupPath}
        >
          Open Backup Folder
        </Button>
        <Button
          variant="outlined"
          startIcon={<ContentCopyIcon />}
          onClick={() => config?.databasePath && void copyText(config.databasePath)}
          disabled={!config?.databasePath}
        >
          Copy Database Path
        </Button>
        <Button
          variant="text"
          onClick={() => config?.databasePath && void showDataPathInFolder(config.databasePath)}
          disabled={!config?.databasePath}
        >
          Show DB in Explorer
        </Button>
      </Stack>

      <Dialog open={changeOpen} onClose={() => !busy && setChangeOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Data Location</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={pendingType === 'appdata' && !useInstallFolder}
                  onChange={() => {
                    setPendingType('appdata');
                    setUseInstallFolder(false);
                  }}
                />
              }
              label="Recommended (AppData)"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={pendingType === 'custom' && !useInstallFolder}
                  onChange={() => {
                    setPendingType('custom');
                    setUseInstallFolder(false);
                  }}
                />
              }
              label="Custom folder"
            />
            {pendingType === 'custom' && !useInstallFolder && (
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  label="Custom folder (e.g. D:\\PVE Data)"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                />
                <Button
                  variant="outlined"
                  onClick={async () => {
                    const picked = await pickCustomDataFolder();
                    if (picked) setCustomPath(picked);
                  }}
                >
                  Browse
                </Button>
              </Stack>
            )}
            <FormControlLabel
              control={
                <Checkbox
                  checked={useInstallFolder}
                  onChange={(e) => {
                    setUseInstallFolder(e.target.checked);
                    if (e.target.checked) setPendingType('install');
                  }}
                />
              }
              label="Use Application Folder For Data"
            />
            {useInstallFolder && (
              <Typography variant="body2" color="text.secondary">
                Data will be stored beside the installed app. Write permission is checked before enabling.
              </Typography>
            )}
            <FormControlLabel
              control={
                <Checkbox checked={moveExisting} onChange={(e) => setMoveExisting(e.target.checked)} />
              }
              label="Move existing data to new location"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangeOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void applyLocationChange()} disabled={busy}>
            {busy ? 'Applying…' : 'Apply'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all' }}>
        {value}
      </Typography>
    </Box>
  );
}
