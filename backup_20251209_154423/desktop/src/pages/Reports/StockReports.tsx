import React from 'react';
import { Box, Typography } from '@mui/material';

export default function StockReports() {
  return (
    <Box>
      <Typography variant="h6">Stock Reports</Typography>
      <Typography variant="body2" color="text.secondary">
        Current Stock Summary, Stock Valuation, Stock Movement, Low Stock, Negative Stock, Batch/Lot Wise, Serial Number, Expiry Report, Reorder Level, Dead Stock, Fast/Slow Moving, Stock Aging
      </Typography>
    </Box>
  );
}

