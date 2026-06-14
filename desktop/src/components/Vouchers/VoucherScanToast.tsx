import { Alert, Box, Fade } from '@mui/material';
import type { ScanToastState } from '../../hooks/useVoucherBarcodeScan';

type Props = {
  toast: ScanToastState | null;
};

export function VoucherScanToast({ toast }: Props) {
  if (!toast) return null;
  const { item, quantity, rate, mode } = toast;
  return (
    <Fade in>
      <Box sx={{ position: 'fixed', top: 72, right: 16, zIndex: 1400, maxWidth: 320 }}>
        <Alert severity="success" sx={{ boxShadow: 3 }}>
          <strong>{item.name}</strong>
          <br />
          {mode === 'sale' ? 'Sale' : 'Purchase'} rate: ₹{rate.toFixed(2)} · Stock: {item.currentStock}
          <br />
          GST: {item.gstRate}% · Qty: {quantity}
        </Alert>
      </Box>
    </Fade>
  );
}
