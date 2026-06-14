import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Card, CardActionArea, CardContent } from '@mui/material';
import { Payment as PaymentIcon, AccountBalance as AccountBalanceIcon, ReceiptLong as ReceiptLongIcon } from '@mui/icons-material';

interface PaymentReportsProps {
  canExport: boolean;
}

export default function PaymentReports({ canExport: _canExport }: PaymentReportsProps) {
  const navigate = useNavigate();

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Payment Reports</Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/payments')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PaymentIcon color="primary" />
                  <Typography variant="subtitle1">Payments</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  View payments received/made and filter list
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/payments/reports')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <ReceiptLongIcon color="primary" />
                  <Typography variant="subtitle1">Payment Summary</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Payment reports (received/made) and summaries
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/accounts')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AccountBalanceIcon color="primary" />
                  <Typography variant="subtitle1">Bank/Cash Accounts</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Account-wise transaction view
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
