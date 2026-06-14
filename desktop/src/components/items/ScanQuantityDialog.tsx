import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

type Props = {
  open: boolean;
  itemName: string;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
};

export function ScanQuantityDialog({ open, itemName, onConfirm, onCancel }: Props) {
  const [qty, setQty] = useState('1');

  useEffect(() => {
    if (open) setQty('1');
  }, [open]);

  const handleConfirm = () => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return;
    onConfirm(n);
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Enter quantity</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {itemName}
          </Typography>
          <TextField
            autoFocus
            label="Quantity"
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputProps={{ min: 0.0001, step: 'any' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
              }
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm}>
          Add to voucher
        </Button>
      </DialogActions>
    </Dialog>
  );
}
