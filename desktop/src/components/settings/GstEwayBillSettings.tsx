import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { EwayBillProvider } from '../../types/ewayBill';
import {
  loadEwayBillSettings,
  saveEwayBillSettings,
  type EwayBillSettings,
} from '../../services/ewayBillSettingsService';

export default function GstEwayBillSettings() {
  const [settings, setSettings] = useState<EwayBillSettings>(() => loadEwayBillSettings());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadEwayBillSettings());
  }, []);

  const handleSave = () => {
    saveEwayBillSettings(settings);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h6" fontWeight={800}>
          GST &amp; E-Way Bill
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure E-Way Bill reminders and future GSP provider. No paid API is connected yet.
        </Typography>
      </Box>

      {saved ? <Alert severity="success">Settings saved.</Alert> : null}

      <FormControlLabel
        control={
          <Switch
            checked={settings.askAboveThreshold}
            onChange={(e) => setSettings((s) => ({ ...s, askAboveThreshold: e.target.checked }))}
          />
        }
        label="Ask for EWB above threshold"
      />
      <FormControlLabel
        control={
          <Switch
            checked={settings.showReminderPopup}
            onChange={(e) => setSettings((s) => ({ ...s, showReminderPopup: e.target.checked }))}
          />
        }
        label="Show reminder popup on save"
      />
      <FormControlLabel
        control={
          <Switch
            checked={settings.autoGenerateFuture}
            disabled
            onChange={(e) => setSettings((s) => ({ ...s, autoGenerateFuture: e.target.checked }))}
          />
        }
        label="Auto Generate EWB (Future API)"
      />

      <TextField
        label="Threshold Amount (₹)"
        type="number"
        size="small"
        value={settings.thresholdAmount}
        onChange={(e) =>
          setSettings((s) => ({
            ...s,
            thresholdAmount: Number(e.target.value) || 50000,
          }))
        }
        sx={{ maxWidth: 280 }}
      />

      <FormControl size="small" sx={{ maxWidth: 320 }}>
        <InputLabel>Provider</InputLabel>
        <Select
          label="Provider"
          value={settings.provider}
          onChange={(e) =>
            setSettings((s) => ({ ...s, provider: e.target.value as EwayBillProvider }))
          }
        >
          <MenuItem value="manual">Manual Entry</MenuItem>
          <MenuItem value="masters_india" disabled>
            Masters India (Coming Soon)
          </MenuItem>
          <MenuItem value="cleartax" disabled>
            ClearTax (Coming Soon)
          </MenuItem>
        </Select>
      </FormControl>

      <Button
        variant="contained"
        onClick={handleSave}
        sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
      >
        Save Settings
      </Button>
    </Stack>
  );
}
