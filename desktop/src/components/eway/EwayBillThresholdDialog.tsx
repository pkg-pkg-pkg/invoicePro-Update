import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { formatCurrency } from '../../utils/formatters';
import { loadEwayBillSettings } from '../../services/ewayBillSettingsService';

type Props = {
  open: boolean;
  invoiceAmount: number;
  thresholdAmount?: number;
  onAddEway: () => void;
  onSkipSave: () => void;
  onCancel: () => void;
  busy?: boolean;
};

export function EwayBillThresholdDialog({
  open,
  invoiceAmount,
  thresholdAmount,
  onAddEway,
  onSkipSave,
  onCancel,
  busy = false,
}: Props) {
  const threshold = thresholdAmount ?? loadEwayBillSettings().thresholdAmount;
  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LocalShippingIcon color="warning" />
        E-Way Bill Recommended
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Invoice Amount:{' '}
            <Typography component="span" fontWeight={800} color="text.primary">
              {formatCurrency(invoiceAmount)}
            </Typography>
          </Typography>
          <Typography variant="body2">
            This invoice exceeds {formatCurrency(threshold)}. Would you like to add E-Way Bill details?
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexDirection: 'column', alignItems: 'stretch', gap: 1 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={onAddEway}
          disabled={busy}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Add E-Way Bill
        </Button>
        <Button
          variant="outlined"
          onClick={onSkipSave}
          disabled={busy}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Skip &amp; Save
        </Button>
        <Button onClick={onCancel} disabled={busy} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
