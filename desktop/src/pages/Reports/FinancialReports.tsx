import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Card, CardActionArea, CardContent, Alert } from '@mui/material';
import { AccountBalance as AccountBalanceIcon, ReceiptLong as ReceiptLongIcon, LocalAtm as LocalAtmIcon, Assessment as AssessmentIcon, TrendingUp as TrendingUpIcon } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import BalanceSheetReport from './BalanceSheetReport';
import TrialBalanceReport from './TrialBalanceReport';
import LedgerProfitAndLossReport from './LedgerProfitAndLossReport';

interface FinancialReportsProps {
  canExport: boolean;
}

export default function FinancialReports({ canExport: _canExport }: FinancialReportsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedReport = useMemo(
    () => (new URLSearchParams(location.search).get('report') || '').toLowerCase(),
    [location.search]
  );

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Financial Reports</Typography>
      {selectedReport === 'balancesheet' ? (
        <BalanceSheetReport />
      ) : selectedReport === 'trialbalance' ? (
        <TrialBalanceReport />
      ) : selectedReport === 'ledger-pnl' ? (
        <LedgerProfitAndLossReport />
      ) : (
        <>
      {selectedReport === 'pnl' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          P&L section selected. Opening Profit (pre-GST) report.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/reports?view=financial&report=balancesheet')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AccountBalanceIcon color="primary" />
                  <Typography variant="subtitle1">Balance Sheet</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Assets vs liabilities snapshot for financial position
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/reports?view=pre-gst-profit&report=pnl')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TrendingUpIcon color="primary" />
                  <Typography variant="subtitle1">Profit & Loss</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Revenue vs expense analysis (pre-GST profitability)
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
            <CardActionArea onClick={() => navigate('/reports?view=financial&report=trialbalance')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AssessmentIcon color="primary" />
                  <Typography variant="subtitle1">Trial Balance</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Debit/credit totals by ledger (group-validated)
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/reports?view=financial&report=ledger-pnl')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TrendingUpIcon color="primary" />
                  <Typography variant="subtitle1">P&L (Ledger Groups)</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Income and expense rolled up by chart group
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/reports/party-outstanding')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AssessmentIcon color="primary" />
                  <Typography variant="subtitle1">Debtors & Creditors Outstanding</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Bill-wise outstanding, open references, and ageing by party
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/masters/financial-readiness')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AssessmentIcon color="primary" />
                  <Typography variant="subtitle1">Financial Statement Readiness</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Audit TB, P&amp;L, Balance Sheet, Cash/Bank Book readiness before release
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/masters/accounting-integrity')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AssessmentIcon color="primary" />
                  <Typography variant="subtitle1">Accounting Integrity Audit</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Verify voucher posting logic, Dr/Cr balance, and TB/P&L/BS derivation
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/ledgers/report')}>
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
        </>
      )}
    </Box>
  );
}
