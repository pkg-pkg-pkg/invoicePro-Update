import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type {
  FinancialYearLabelFormat,
  ResetSequencePolicy,
  VoucherNumberProfileKey,
  VoucherTypeNumberConfig,
} from '../../types/voucherNumbering';
import { VOUCHER_NUMBER_PROFILE_LABELS } from '../../types/voucherNumbering';
import {
  buildPreviewNumber,
  getVoucherNumberingSettings,
  saveVoucherNumberingSettings,
} from '../../services/vouchers/voucherNumberService';

const PROFILE_KEYS = Object.keys(VOUCHER_NUMBER_PROFILE_LABELS) as VoucherNumberProfileKey[];

export default function VoucherNumberSettingsPanel() {
  const [settings, setSettings] = useState(getVoucherNumberingSettings());
  const [saved, setSaved] = useState(false);
  const [activeProfile, setActiveProfile] = useState<VoucherNumberProfileKey>('SALES');

  useEffect(() => {
    setSettings(getVoucherNumberingSettings());
  }, []);

  const activeConfig = settings.types[activeProfile];

  const preview = useMemo(
    () => buildPreviewNumber(activeProfile, activeConfig, activeConfig.startingNumber),
    [activeProfile, activeConfig]
  );

  const patchProfile = (patch: Partial<VoucherTypeNumberConfig>) => {
    setSettings((prev) => ({
      ...prev,
      types: {
        ...prev.types,
        [activeProfile]: { ...prev.types[activeProfile], ...patch },
      },
    }));
    setSaved(false);
  };

  const handleSave = () => {
    saveVoucherNumberingSettings(settings);
    setSaved(true);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Configure human-readable voucher numbers (e.g. SALES/26-27/0001). Changes apply to new vouchers only —
        existing saved numbers are never altered.
      </Typography>

      {settings.migrationCompleted ? (
        <Alert severity="success" variant="outlined">
          Legacy internal voucher IDs were migrated
          {settings.migrationCompletedAt
            ? ` on ${new Date(settings.migrationCompletedAt).toLocaleString()}`
            : ''}
          .
        </Alert>
      ) : (
        <Alert severity="info" variant="outlined">
          Legacy vch-* numbers will be reassigned automatically on next app start.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Voucher type</InputLabel>
            <Select
              label="Voucher type"
              value={activeProfile}
              onChange={(e) => setActiveProfile(e.target.value as VoucherNumberProfileKey)}
            >
              {PROFILE_KEYS.map((key) => (
                <MenuItem key={key} value={key}>
                  {VOUCHER_NUMBER_PROFILE_LABELS[key]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            fullWidth
            size="small"
            label="Prefix"
            value={activeConfig.prefix}
            onChange={(e) => patchProfile({ prefix: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <TextField
            fullWidth
            size="small"
            label="Separator"
            value={activeConfig.separator}
            onChange={(e) => patchProfile({ separator: e.target.value })}
            inputProps={{ maxLength: 3 }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Pad digits"
            value={activeConfig.padDigits}
            onChange={(e) => patchProfile({ padDigits: Math.max(1, Number(e.target.value) || 4) })}
            inputProps={{ min: 1, max: 8 }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Starting number (current period)"
            value={activeConfig.startingNumber}
            onChange={(e) => patchProfile({ startingNumber: Math.max(1, Number(e.target.value) || 1) })}
            inputProps={{ min: 1 }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Reset sequence</InputLabel>
            <Select
              label="Reset sequence"
              value={activeConfig.resetSequence}
              onChange={(e) => patchProfile({ resetSequence: e.target.value as ResetSequencePolicy })}
            >
              <MenuItem value="yearly">Yearly (on FY change)</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="never">Never</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControlLabel
            control={
              <Switch
                checked={activeConfig.includeFinancialYear}
                onChange={(e) => patchProfile({ includeFinancialYear: e.target.checked })}
              />
            }
            label="Include financial year"
          />
        </Grid>
        {activeConfig.includeFinancialYear ? (
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>FY format</InputLabel>
              <Select
                label="FY format"
                value={activeConfig.fyFormat}
                onChange={(e) => patchProfile({ fyFormat: e.target.value as FinancialYearLabelFormat })}
              >
                <MenuItem value="short">Short (26-27)</MenuItem>
                <MenuItem value="long">Long (2026-27)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        ) : null}
      </Grid>

      <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={700}>
          Next voucher number preview
        </Typography>
        <Typography variant="h6" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
          {preview}
        </Typography>
      </Box>

      <Button variant="contained" onClick={handleSave}>
        Save voucher number settings
      </Button>

      {saved ? <Alert severity="success">Voucher number settings saved.</Alert> : null}
    </Stack>
  );
}
