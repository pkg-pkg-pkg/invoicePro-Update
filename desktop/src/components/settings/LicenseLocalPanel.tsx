import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import { getDeviceId } from '../../services/deviceService';
import {
  maskLicenseKeyDisplay,
  migrateLicenseCacheIfNeeded,
  readLocalLicenseCache,
  verifyLicenseOnlineManual,
  type LocalLicenseCache,
} from '../../services/licenseService';
import { isElectronRuntime } from '../../utils/runtime';

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function formatExpiry(ms?: number | null): string {
  if (ms == null) return '—';
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

async function resolveDeviceLabel(deviceId: string): Promise<string> {
  if (isElectronRuntime() && window.electronAPI?.getAppSystemInfo) {
    try {
      const info = await window.electronAPI.getAppSystemInfo();
      if (info.hostName) return String(info.hostName);
    } catch {
      // fall through
    }
  }
  if (deviceId.length <= 12) return deviceId;
  return `${deviceId.slice(0, 8)}…`;
}

export default function LicenseLocalPanel() {
  const [cache, setCache] = useState<LocalLicenseCache | null>(null);
  const [deviceLabel, setDeviceLabel] = useState('—');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const loadCache = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      await migrateLicenseCacheIfNeeded(deviceId);
      const next = await readLocalLicenseCache(deviceId);
      setCache(next);
      setDeviceLabel(await resolveDeviceLabel(deviceId));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCache();
  }, [loadCache]);

  const licenseKey = cache?.licenseKey || cache?.activationKey || '';
  const isActive = Boolean(cache?.permanently_activated && licenseKey);

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyMessage(null);
    setVerifyError(null);
    try {
      const result = await verifyLicenseOnlineManual();
      if (!result.ok) {
        setVerifyError(result.reason);
        return;
      }
      await loadCache();
      const expiryLabel = formatExpiry(result.expiryDateMs);
      setVerifyMessage(`License verified — valid until ${expiryLabel}`);
    } catch (e: unknown) {
      setVerifyError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading licence…
        </Typography>
      </Box>
    );
  }

  if (!licenseKey) {
    return (
      <Alert severity="warning">
        No licence stored on this PC. Activate or sign in once while online.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Licence runs locally after first activation. Online verification is optional and only runs when you click the button below.
      </Typography>

      <Box sx={{ display: 'grid', gap: 1 }}>
        <Typography variant="body2">
          <strong>License Key:</strong> {maskLicenseKeyDisplay(licenseKey)}
        </Typography>
        <Typography variant="body2">
          <strong>Activated on:</strong> {formatDate(cache?.activated_at)}
        </Typography>
        <Typography variant="body2">
          <strong>Device:</strong> {deviceLabel}
        </Typography>
        <Typography variant="body2">
          <strong>Status:</strong>{' '}
          {isActive ? (
            <Box component="span" sx={{ color: 'success.main' }}>
              Active (Local)
            </Box>
          ) : (
            'Not activated locally'
          )}
        </Typography>
        <Typography variant="body2">
          <strong>Last online verify:</strong>{' '}
          {cache?.last_online_verify_at ? formatDate(cache.last_online_verify_at) : 'Never'}
        </Typography>
        {cache?.licenseExpiry != null && (
          <Typography variant="body2">
            <strong>Valid until:</strong> {formatExpiry(Number(cache.licenseExpiry))}
          </Typography>
        )}
      </Box>

      <Button
        variant="outlined"
        startIcon={verifying ? <CircularProgress size={16} /> : <VerifiedIcon />}
        onClick={() => void handleVerify()}
        disabled={verifying || !navigator.onLine}
      >
        Verify License Online
      </Button>

      {!navigator.onLine && (
        <Typography variant="caption" color="text.secondary">
          Connect to the internet to verify online.
        </Typography>
      )}

      {verifyMessage && <Alert severity="success">{verifyMessage}</Alert>}
      {verifyError && <Alert severity="error">{verifyError}</Alert>}
    </Stack>
  );
}
