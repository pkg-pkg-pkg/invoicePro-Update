import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PaymentIcon from '@mui/icons-material/Payment';
import { networkService } from '../services/networkService';
import { APP_DISPLAY_NAME } from '../constants/appBranding';

type Props = {
  initialServerUrl?: string;
  initialError?: string;
  initialChecking?: boolean;
  onConnected?: () => void;
  /** Turn off multi-user client mode and return to normal single-PC use */
  onExitSingleUser?: () => void;
  /** Same exit + open Settings on Network & payment (UPI) tab */
  onOpenLanPaymentSettings?: () => void;
};

function normalizeServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `http://${trimmed}`;
}

export default function ConnectToHost({
  initialServerUrl,
  initialError,
  initialChecking,
  onConnected,
  onExitSingleUser,
  onOpenLanPaymentSettings,
}: Props) {
  const [serverUrl, setServerUrl] = useState(initialServerUrl ?? '');
  const [busy, setBusy] = useState(!!initialChecking);
  const [error, setError] = useState<string | undefined>(initialError);

  const suggested = useMemo(() => {
    const s = String(initialServerUrl ?? '').trim();
    return s;
  }, [initialServerUrl]);

  useEffect(() => {
    if (suggested && !serverUrl) setServerUrl(suggested);
  }, [suggested, serverUrl]);

  const handleConnect = async () => {
    const normalized = normalizeServerUrl(serverUrl);
    if (!normalized) {
      setError('Enter Host URL (example: http://192.168.1.10:3000)');
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      const ok = await networkService.connectToServer(normalized);
      if (!ok) {
        setError('Cannot connect to host. Check Host IP, Port, and ensure server is running.');
        return;
      }

      onConnected?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 11000,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 520 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Connect to Host
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Multi-user mode is enabled. This computer must connect to the licensed Host server to use {APP_DISPLAY_NAME}.
            If you turned this on by mistake, use the options below—you are not stuck here.
          </Typography>

          {error && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            label="Host URL"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            fullWidth
            placeholder="http://192.168.1.10:3000"
            disabled={busy}
            sx={{ mb: 2 }}
          />

          <Button variant="contained" fullWidth onClick={handleConnect} disabled={busy}>
            {busy ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={18} />
                <span>Connecting...</span>
              </Box>
            ) : (
              'Connect'
            )}
          </Button>

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">
              or exit multi-user
            </Typography>
          </Divider>

          <Stack spacing={1}>
            {onExitSingleUser && (
              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                startIcon={<ArrowBackIcon />}
                onClick={() => onExitSingleUser()}
                disabled={busy}
              >
                Back — use on this PC only
              </Button>
            )}
            {onOpenLanPaymentSettings && (
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                startIcon={<PaymentIcon />}
                onClick={() => onOpenLanPaymentSettings()}
                disabled={busy}
              >
                Multi-user payment (UPI) &amp; network settings
              </Button>
            )}
          </Stack>

          {(onExitSingleUser || onOpenLanPaymentSettings) && (
            <Alert severity="info" sx={{ mt: 2 }} icon={false}>
              <Typography variant="caption" component="div">
                These actions turn off <strong>multi-user client mode</strong> on this PC so you can use the app again.
                You can re-enable LAN from Settings → Network &amp; Multi-User when ready.
              </Typography>
            </Alert>
          )}

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Tip: Start the server on Host PC from Settings → Network & Multi-User, then enter Host IP here.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
