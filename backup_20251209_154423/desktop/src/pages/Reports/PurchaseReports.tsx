import React from 'react';
import { Box, Typography } from '@mui/material';

export default function PurchaseReports() {
  return (
    <Box>
      <Typography variant="h6">Purchase Reports</Typography>
      <Typography variant="body2" color="text.secondary">
        Purchase Register, Purchase Summary, Purchase by Supplier, Purchase by Product, Purchase Return, Purchase Tax Report
      </Typography>
    </Box>
  );
}

