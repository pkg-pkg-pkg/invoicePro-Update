import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Card, CardActionArea, CardContent, Button } from '@mui/material';
import { ReceiptLong as ReceiptLongIcon, People as PeopleIcon, Business as BusinessIcon, FileDownload as FileDownloadIcon } from '@mui/icons-material';

interface PartyReportsProps {
  canExport: boolean;
}

export default function PartyReports({ canExport }: PartyReportsProps) {
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
      <Typography variant="h6" sx={{ mb: 2 }}>Party Reports</Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/parties/ledger-report')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <ReceiptLongIcon color="primary" />
                  <Typography variant="subtitle1">Ledger Report</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Party-wise ledger with date range filter and print/PDF
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/customers')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PeopleIcon color="primary" />
                  <Typography variant="subtitle1">Customer Outstanding</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  View customers list and open ledger/outstanding
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
                  <Typography variant="subtitle1">Supplier Payable</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  View suppliers list and open ledger/payable
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
