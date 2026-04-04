import { Card, CardContent, Stack, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const ExpenseDeprecatedNotice = () => {
  const navigate = useNavigate();

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={600}>
        Expense screen deprecated
      </Typography>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="body1">
              The standalone Expense module has been retired. Please record expenses through vouchers for accurate ledger-driven accounting:
            </Typography>
            <Stack component="ul" spacing={1} sx={{ pl: 3 }}>
              <Typography component="li" variant="body2">
                Use <strong>Payment Voucher</strong> for direct expense bookings (Dr Expense ledger / Cr Cash-Bank-Party).
              </Typography>
              <Typography component="li" variant="body2">
                Use <strong>Purchase Voucher (Accounting mode)</strong> when you need supplier-linked expense entries with GST.
              </Typography>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="contained" onClick={() => navigate('/vouchers/payment')}>
                Go to Payment Vouchers
              </Button>
              <Button variant="outlined" onClick={() => navigate('/vouchers/purchase')}>
                Go to Purchase Vouchers
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default ExpenseDeprecatedNotice;
