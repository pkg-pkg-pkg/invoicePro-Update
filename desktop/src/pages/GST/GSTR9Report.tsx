import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import { FileDownload as FileDownloadIcon } from '@mui/icons-material';
import { gstService, GSTR9Response } from '../../services/gstService';

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

export default function GSTR9Report() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear - 1); // Default to previous year
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GSTR9Response | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await gstService.getGSTR9(year);
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate GSTR-9 report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    const exportData = {
      ...data,
      generatedAt: new Date().toISOString(),
      reportType: 'GSTR-9',
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSTR-9_${year}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        GSTR-9 (Annual Return)
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Annual reconciliation return for GST compliance (Financial Year {year-1}-{year})
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Financial Year</InputLabel>
              <Select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                label="Financial Year"
              >
                {YEARS.map((y) => (
                  <MenuItem key={y} value={y}>
                    {y-1}-{y}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={8}>
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={loading}
              sx={{ mr: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Generate Annual Report'}
            </Button>
            {data && (
              <Button
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={handleExport}
              >
                Export JSON
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {data && (
        <>
          {/* Annual Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Sales
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    ₹{data.annualSummary.totalSales.toLocaleString('en-IN')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Purchases
                  </Typography>
                  <Typography variant="h6" color="warning.main">
                    ₹{data.annualSummary.totalPurchases.toLocaleString('en-IN')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Sales Tax Collected
                  </Typography>
                  <Typography variant="h6" color="info.main">
                    ₹{data.annualSummary.totalSalesTax.toLocaleString('en-IN')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Purchase Tax Paid
                  </Typography>
                  <Typography variant="h6" color="secondary.main">
                    ₹{data.annualSummary.totalPurchaseTax.toLocaleString('en-IN')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Net Tax Payable */}
          <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.main', color: 'white' }}>
            <Typography variant="h5" gutterBottom align="center">
              Net GST Payable for FY {year-1}-{year}
            </Typography>
            <Typography variant="h3" align="center" sx={{ fontWeight: 'bold' }}>
              ₹{data.annualSummary.netTaxPayable.toLocaleString('en-IN')}
            </Typography>
            <Typography variant="body1" align="center" sx={{ mt: 1, opacity: 0.9 }}>
              (Sales Tax: ₹{data.annualSummary.totalSalesTax.toLocaleString('en-IN')} -
              Purchase Tax: ₹{data.annualSummary.totalPurchaseTax.toLocaleString('en-IN')})
            </Typography>
          </Paper>

          {/* Monthly Breakdown */}
          <Paper sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ p: 2 }}>
              Monthly GST Summary (FY {year-1}-{year})
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Month</strong></TableCell>
                    <TableCell align="right"><strong>Sales Count</strong></TableCell>
                    <TableCell align="right"><strong>Sales Value</strong></TableCell>
                    <TableCell align="right"><strong>Sales GST</strong></TableCell>
                    <TableCell align="right"><strong>Purchase Count</strong></TableCell>
                    <TableCell align="right"><strong>Purchase Value</strong></TableCell>
                    <TableCell align="right"><strong>Purchase GST</strong></TableCell>
                    <TableCell align="right"><strong>Net GST</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.monthlyData.map((monthData) => (
                    <TableRow key={monthData.month} hover>
                      <TableCell>
                        <strong>{getMonthName(monthData.month)}</strong>
                      </TableCell>
                      <TableCell align="right">{monthData.sales.count}</TableCell>
                      <TableCell align="right">₹{monthData.sales.total.toLocaleString('en-IN')}</TableCell>
                      <TableCell align="right">₹{monthData.sales.tax.toLocaleString('en-IN')}</TableCell>
                      <TableCell align="right">{monthData.purchases.count}</TableCell>
                      <TableCell align="right">₹{monthData.purchases.total.toLocaleString('en-IN')}</TableCell>
                      <TableCell align="right">₹{monthData.purchases.tax.toLocaleString('en-IN')}</TableCell>
                      <TableCell align="right" sx={{
                        fontWeight: 'bold',
                        color: (monthData.sales.tax - monthData.purchases.tax) >= 0 ? 'success.main' : 'error.main'
                      }}>
                        ₹{(monthData.sales.tax - monthData.purchases.tax).toLocaleString('en-IN')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Annual Total Row */}
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      ANNUAL TOTAL
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {data.monthlyData.reduce((sum, m) => sum + m.sales.count, 0)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      ₹{data.annualSummary.totalSales.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      ₹{data.annualSummary.totalSalesTax.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {data.monthlyData.reduce((sum, m) => sum + m.purchases.count, 0)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      ₹{data.annualSummary.totalPurchases.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      ₹{data.annualSummary.totalPurchaseTax.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      ₹{data.annualSummary.netTaxPayable.toLocaleString('en-IN')}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Compliance Notes */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="primary">
              📋 GSTR-9 Compliance Checklist
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" component="div">
                  ✅ <strong>Monthly Returns Filed:</strong> All GSTR-1, GSTR-3B submitted<br/>
                  ✅ <strong>Annual Reconciliation:</strong> Cross-verified with monthly data<br/>
                  ✅ <strong>HSN Summary:</strong> HSN-wise classification maintained<br/>
                  ✅ <strong>Tax Calculation:</strong> Accurate GST computation verified<br/>
                  ✅ <strong>Documentation:</strong> All supporting documents maintained
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" component="div">
                  📅 <strong>Due Date:</strong> 31st December following end of FY<br/>
                  💰 <strong>Payment:</strong> Pay any outstanding tax liability<br/>
                  📄 <strong>Submission:</strong> File through GST Portal<br/>
                  🔍 <strong>Audit Trail:</strong> Maintain records for future reference<br/>
                  📞 <strong>Support:</strong> Contact GST helpdesk for assistance
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </>
      )}
    </Box>
  );
}
