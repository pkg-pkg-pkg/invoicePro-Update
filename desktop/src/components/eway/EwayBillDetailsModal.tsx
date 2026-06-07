import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import type { EwayBillFormValues, TransportMode } from '../../types/ewayBill';
import { TRANSPORT_MODES } from '../../types/ewayBill';
import { emptyEwayFormValues } from '../../services/ewayBillService';

type Props = {
  open: boolean;
  initialValues?: EwayBillFormValues;
  title?: string;
  onClose: () => void;
  onSave: (values: EwayBillFormValues) => void;
  busy?: boolean;
};

export function EwayBillDetailsModal({
  open,
  initialValues,
  title = 'E-Way Bill Details',
  onClose,
  onSave,
  busy = false,
}: Props) {
  const [values, setValues] = useState<EwayBillFormValues>(emptyEwayFormValues());

  useEffect(() => {
    if (open) setValues(initialValues ?? emptyEwayFormValues());
  }, [open, initialValues]);

  const setField = <K extends keyof EwayBillFormValues>(key: K, value: EwayBillFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label="E-Way Bill Number"
            value={values.ewayBillNo}
            onChange={(e) => setField('ewayBillNo', e.target.value)}
            fullWidth
            size="small"
            helperText="Optional — enter manually or generate later via GSP"
          />
          <TextField
            label="Transporter Name"
            value={values.transporterName}
            onChange={(e) => setField('transporterName', e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="Transporter GSTIN"
            value={values.transporterGstin}
            onChange={(e) => setField('transporterGstin', e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="Vehicle Number"
            value={values.vehicleNo}
            onChange={(e) => setField('vehicleNo', e.target.value)}
            fullWidth
            size="small"
          />
          <FormControl fullWidth size="small">
            <InputLabel>Transport Mode</InputLabel>
            <Select
              label="Transport Mode"
              value={values.transportMode}
              onChange={(e) => setField('transportMode', e.target.value as TransportMode)}
            >
              {TRANSPORT_MODES.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {mode}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Dispatch From"
            value={values.dispatchFrom}
            onChange={(e) => setField('dispatchFrom', e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="Dispatch To"
            value={values.dispatchTo}
            onChange={(e) => setField('dispatchTo', e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="Distance (KM)"
            value={values.distanceKm}
            onChange={(e) => setField('distanceKm', e.target.value.replace(/[^\d.]/g, ''))}
            fullWidth
            size="small"
            inputMode="decimal"
          />
          <TextField
            label="Remarks"
            value={values.remarks}
            onChange={(e) => setField('remarks', e.target.value)}
            fullWidth
            size="small"
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => onSave(values)}
          disabled={busy}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Save EWB
        </Button>
      </DialogActions>
    </Dialog>
  );
}
