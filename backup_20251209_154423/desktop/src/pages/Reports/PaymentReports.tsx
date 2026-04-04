import React from 'react';
import { Box, Typography } from '@mui/material';

export default function PaymentReports() {
  return (
    <Box>
      <Typography variant="h6">Payment Reports</Typography>
      <Typography variant="body2" color="text.secondary">
        Payment Received Report, Payment Made Report, Pending Cheques Report, Overdue Receivables, Overdue Payables
      </Typography>
    </Box>
  );
}

