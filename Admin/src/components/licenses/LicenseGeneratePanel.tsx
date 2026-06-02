import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { becomeAdmin, generateLicense, formatCallableError } from '../../services/adminApi';

type Props = {
  onGenerated: () => void;
};

type KeyMode = 'auto' | 'custom';

export default function LicenseGeneratePanel({ onGenerated }: Props) {
  const [keyMode, setKeyMode] = useState<KeyMode>('auto');
  const [customKey, setCustomKey] = useState('');
  const [maxActivations, setMaxActivations] = useState('1');
  const [validityDays, setValidityDays] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [bootstrapBusy, setBootstrapBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const runGenerate = async () => {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const ma = Number(maxActivations);
      const vd = validityDays.trim() ? Number(validityDays.trim()) : null;
      const custom = keyMode === 'custom' ? customKey.trim().toUpperCase() : '';
      if (keyMode === 'custom' && !custom) {
        setError('Enter a custom license key or switch to Auto generate.');
        return;
      }
      const res = await generateLicense({
        maxActivations: Number.isFinite(ma) ? ma : 1,
        validityDays: vd,
        note: note.trim() || undefined,
        customKey: custom || undefined,
      });
      setOkMsg(`Generated: ${res.licenseKey}`);
      if (keyMode === 'custom') setCustomKey('');
      onGenerated();
    } catch (e: unknown) {
      setError(formatCallableError(e));
    } finally {
      setBusy(false);
    }
  };

  const runBootstrap = async () => {
    setBootstrapBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      await becomeAdmin();
      setOkMsg('Admin access initialized. Sign out and sign in again if tabs still fail.');
    } catch (e: unknown) {
      setError(formatCallableError(e));
    } finally {
      setBootstrapBusy(false);
    }
  };

  return (
    <Paper sx={{ p: 2, height: 'fit-content' }}>
      <Typography variant="subtitle1" fontWeight={800} gutterBottom>
        Generate license
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Auto INV2 signed keys, or your own custom key (e.g. INVPRO0001)
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      )}
      {okMsg && (
        <Alert severity="success" sx={{ mb: 1.5, wordBreak: 'break-all' }}>
          {okMsg}
        </Alert>
      )}

      <Stack spacing={2}>
        <RadioGroup value={keyMode} onChange={(e) => setKeyMode(e.target.value as KeyMode)}>
          <FormControlLabel value="auto" control={<Radio size="small" />} label="Auto generate (INV2)" disabled={busy} />
          <FormControlLabel value="custom" control={<Radio size="small" />} label="Custom key" disabled={busy} />
        </RadioGroup>

        {keyMode === 'custom' && (
          <TextField
            label="Custom license key"
            size="small"
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value.toUpperCase())}
            disabled={busy}
            fullWidth
            placeholder="INVPRO0001 or INV2-BODY (signature added)"
            helperText="Legacy keys (INVPRO…) or INV2 body — full INV2 with valid signature also accepted"
          />
        )}

        <TextField
          label="Max activations (0 = unlimited)"
          size="small"
          value={maxActivations}
          onChange={(e) => setMaxActivations(e.target.value)}
          disabled={busy}
          fullWidth
        />
        <TextField
          label="Validity days (blank = no expiry)"
          size="small"
          value={validityDays}
          onChange={(e) => setValidityDays(e.target.value)}
          disabled={busy}
          fullWidth
        />
        <TextField
          label="Note (optional)"
          size="small"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy}
          fullWidth
        />
        <Button variant="contained" onClick={() => void runGenerate()} disabled={busy}>
          {busy ? 'Generating…' : 'Generate'}
        </Button>
        <Box sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
          <Button variant="outlined" size="small" fullWidth disabled={bootstrapBusy} onClick={() => void runBootstrap()}>
            {bootstrapBusy ? 'Working…' : 'Initialize admin access (owner email only)'}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}
