import { Box, Button, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type MoneyMode = 'payment' | 'receipt';

export default function MoneyVouchersHub() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<MoneyMode>('payment');

  const isPayment = mode === 'payment';

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 0.75 }}>
        Payment & Receipt
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Yahan se money out (Payment) aur money in (Receipt) select karein.
      </Typography>

      <Tabs value={mode} onChange={(_, v: MoneyMode) => setMode(v)} sx={{ mb: 2 }}>
        <Tab value="payment" label="Payment (Money Out)" />
        <Tab value="receipt" label="Receipt (Money In)" />
      </Tabs>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {isPayment ? 'Payment Voucher' : 'Receipt Voucher'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isPayment
            ? 'Supplier/expense payment entry ke liye.'
            : 'Customer se amount receive karne ke liye.'}
        </Typography>
      </Box>

      <Stack direction="row" spacing={1}>
        <Button
          onClick={() => navigate(isPayment ? '/vouchers/payment-vouchers' : '/vouchers/receipt-vouchers')}
        >
          Open List
        </Button>
        <Button
          variant="contained"
          onClick={() => navigate(isPayment ? '/vouchers/payment-vouchers/new' : '/vouchers/receipt-vouchers/new')}
        >
          New Entry
        </Button>
      </Stack>
    </Paper>
  );
}
