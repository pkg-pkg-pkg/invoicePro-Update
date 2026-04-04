import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Card, CardActionArea, CardContent, Button } from '@mui/material';
import { ShoppingCart as ShoppingCartIcon, ReceiptLong as ReceiptLongIcon, Business as BusinessIcon, FileDownload as FileDownloadIcon } from '@mui/icons-material';

interface PurchaseReportsProps {
  canExport: boolean;
}

export default function PurchaseReports({ canExport }: PurchaseReportsProps) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!canExport) {
      alert('You do not have permission to export reports');
      return;
    }
    setExporting(true);
    // ... export logic
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Purchase Reports</Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/purchase-invoices')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <ShoppingCartIcon color="primary" />
                  <Typography variant="subtitle1">Purchase Bills</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  View purchase register (bills) and totals
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/debit-notes')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <ReceiptLongIcon color="primary" />
                  <Typography variant="subtitle1">Purchase Return (Debit Notes)</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Track purchase returns linked to purchase bills
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/suppliers')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <BusinessIcon color="primary" />
                  <Typography variant="subtitle1">Supplier Analysis</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  View suppliers and open supplier ledger/payable
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>

      <Button
        variant="outlined"
        startIcon={<FileDownloadIcon />}
        disabled={!canExport || exporting}
        onClick={handleExport}
      >
        {exporting ? 'Exporting...' : 'Export to Excel'}
      </Button>
    </Box>
  );
}
