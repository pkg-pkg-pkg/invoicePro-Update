import React from 'react';
import { Box, Typography } from '@mui/material';

export default function PartyReports() {
  return (
    <Box>
      <Typography variant="h6">Party Reports</Typography>
      <Typography variant="body2" color="text.secondary">
        Customer Outstanding Report, Supplier Payable Report, Customer Ledger, Supplier Ledger, Customer Statement, Aging Report
      </Typography>
    </Box>
  );
}

