import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Card, CardActionArea, CardContent, Button } from '@mui/material';
import { AccountBalance as AccountBalanceIcon, ReceiptLong as ReceiptLongIcon, LocalAtm as LocalAtmIcon, Assessment as AssessmentIcon, FileDownload as FileDownloadIcon } from '@mui/icons-material';

interface FinancialReportsProps {
  canExport: boolean;
}

export default function FinancialReports({ canExport }: FinancialReportsProps) {
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
      <Typography variant="h6" sx={{ mb: 2 }}>Financial Reports</Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/accounts')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AccountBalanceIcon color="primary" />
                  <Typography variant="subtitle1">Accounts</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Cash/Bank accounts and accounting overview
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/expenses')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <ReceiptLongIcon color="primary" />
                  <Typography variant="subtitle1">Expense Report</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Track expenses and heads
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/gst')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <LocalAtmIcon color="primary" />
                  <Typography variant="subtitle1">GST Returns</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  GSTR reports and summaries
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/parties/ledger-report')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AssessmentIcon color="primary" />
                  <Typography variant="subtitle1">Ledger Report</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Party-wise ledger with print/PDF
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
