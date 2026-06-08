import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  completeDataStorageFirstRun,
  getDataStorageConfig,
  pickCustomDataFolder,
  restoreDetectedDataLocation,
  scanDetectedDataLocations,
  type DataLocationType,
  type DetectedDataLocation,
} from '../services/dataStorageService';

type Props = {
  open: boolean;
  onComplete: () => void;
};

export default function DataLocationFirstRunDialog({ open, onComplete }: Props) {
  const [choice, setChoice] = useState<DataLocationType>('appdata');
  const [customPath, setCustomPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedDataLocation[]>([]);

  useEffect(() => {
    if (!open) return;
    void scanDetectedDataLocations().then(setDetected);
  }, [open]);

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await completeDataStorageFirstRun({
        dataLocationType: choice,
        customPath: choice === 'custom' ? customPath : undefined,
        moveExisting: false,
      });
      if (!res.success) {
        setError(res.error || 'Could not save data location');
        return;
      }
      onComplete();
    } finally {
      setBusy(false);
    }
  };

  const restoreExisting = async (loc: DetectedDataLocation) => {
    setBusy(true);
    setError(null);
    try {
      const res = await restoreDetectedDataLocation(loc.path);
      if (!res.success) {
        setError(res.error || 'Restore failed');
        return;
      }
      onComplete();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogTitle>Where should company data be stored?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose one location. All database files, backups, exports and documents will use this folder.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {detected.length > 0 && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Existing data found
            </Typography>
            <Stack spacing={1}>
              {detected.map((loc) => (
                <Stack key={loc.id} direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2">{loc.label}</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {loc.path}
                    </Typography>
                  </Box>
                  <Button size="small" variant="outlined" disabled={busy} onClick={() => void restoreExisting(loc)}>
                    Restore
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}

        <FormControl component="fieldset" fullWidth>
          <RadioGroup
            value={choice}
            onChange={(e) => setChoice(e.target.value as DataLocationType)}
          >
            <FormControlLabel
              value="appdata"
              control={<Radio />}
              label="Recommended (AppData) — safest default"
            />
            <FormControlLabel value="custom" control={<Radio />} label="Custom folder (D:, E:, NAS, etc.)" />
            <FormControlLabel
              value="install"
              control={<Radio />}
              label="Installation folder (beside software)"
            />
          </RadioGroup>
        </FormControl>

        {choice === 'custom' && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Folder path"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="D:\PVE Data"
            />
            <Button variant="outlined" onClick={async () => {
              const p = await pickCustomDataFolder();
              if (p) setCustomPath(p);
            }}>
              Browse
            </Button>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" disabled={busy || (choice === 'custom' && !customPath.trim())} onClick={() => void finish()}>
          {busy ? 'Saving…' : 'Continue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export async function needsDataLocationFirstRun(): Promise<boolean> {
  const cfg = await getDataStorageConfig();
  return Boolean(cfg && !cfg.firstRunCompleted);
}
