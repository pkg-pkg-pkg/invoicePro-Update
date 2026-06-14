import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { invoiceProMiddlewareSync } from '../../services/sync/invoiceProMiddlewareSync';
import { ensureSyncReady } from '../../services/sync/middlewareSyncAuth';
import { syncElectronStore } from '../../services/sync/syncElectronStore';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { notifySyncStatusChanged } from '../../services/sync/syncStatusEvents';

/** Settings panel — enable/disable Invoice Pro cloud middleware sync (System 2). */
export default function CloudMiddlewareSyncSettings() {
  const [enabled, setEnabled] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [userId, setUserId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const syncStatus = useSyncStatus();

  const load = async () => {
    const cfg = await invoiceProMiddlewareSync.getConfig();
    if (cfg) {
      setEnabled(cfg.enabled);
      setApiUrl(cfg.apiUrl);
      setUserId(cfg.userId);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await syncElectronStore.setSyncEnabled(enabled);
      await syncElectronStore.setMiddlewareUrl(apiUrl.trim());
      await syncElectronStore.setUserUUID(userId.trim());
      await invoiceProMiddlewareSync.setConfig({ enabled, apiUrl, userId });
      notifySyncStatusChanged();
      setMessage('Cloud sync settings saved.');
      await load();
    } finally {
      setLoading(false);
    }
  };

  const handleFlush = async () => {
    setLoading(true);
    await ensureSyncReady();
    const result = await invoiceProMiddlewareSync.flushQueue();
    setMessage(
      `Pushed ${result.succeeded}/${result.attempted}, failed ${result.failed}. Queue: ${await invoiceProMiddlewareSync.getQueueDepth()}`
    );
    setLoading(false);
  };

  const statusLabel =
    syncStatus.state === 'off'
      ? '🔴 Sync Off'
      : syncStatus.state === 'syncing'
        ? '🔵 Syncing...'
        : syncStatus.state === 'pending'
          ? `🟡 Pending (${syncStatus.pendingCount})`
          : `🟢 Synced${syncStatus.lastSyncedLabel ? ` ${syncStatus.lastSyncedLabel}` : ''}`;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Mobile Cloud Sync (Middleware)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Pushes only changed records to the cloud middleware. Your full database stays on this PC.
        Disable anytime — no data is removed locally.
      </Typography>

      <Stack spacing={2}>
        <Alert severity="info" sx={{ py: 0.5 }}>
          Status: {statusLabel}
        </Alert>
        <FormControlLabel
          control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
          label="Enable cloud sync to mobile app"
        />
        <TextField
          label="Middleware API URL"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          fullWidth
          placeholder="https://your-middleware-host:3001"
        />
        <TextField
          label="User UUID (from mobile registration)"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          fullWidth
        />
        {message && <Alert severity="info">{message}</Alert>}
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={handleSave} disabled={loading}>
            Save
          </Button>
          <Button variant="outlined" onClick={handleFlush} disabled={loading || !enabled}>
            Push pending now
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
