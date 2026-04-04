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
} from '@mui/material';
import { FileDownload as FileDownloadIcon } from '@mui/icons-material';
import { gstService, GSTR1Response } from '../../services/gstService';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function GSTR1Report() {
  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GSTR1Response | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await gstService.getGSTR1(month, year);
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate GSTR-1');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await gstService.exportGSTR1(month, year);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSTR1_${year}_${month}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to export GSTR-1');
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        GSTR-1 Report (Outward Supplies)
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Month</InputLabel>
              <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} label="Month">
                {MONTHS.map((m) => (
                  <MenuItem key={m.value} value={m.value}>
                    {m.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Year</InputLabel>
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))} label="Year">
                {years.map((y) => (
                  <MenuItem key={y} value={y}>
                    {y}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={loading}
              sx={{ mr: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Generate Report'}
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
          {/* Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    B2B Invoices
                  </Typography>
                  <Typography variant="h5">{data.summary.totalB2BInvoices}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    B2C Invoices
                  </Typography>
                  <Typography variant="h5">{data.summary.totalB2CInvoices}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Taxable Value
                  </Typography>
                  <Typography variant="h5">₹{data.summary.totalTaxableValue.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Tax
                  </Typography>
                  <Typography variant="h5">
                    ₹{(data.summary.totalIGST + data.summary.totalCGST + data.summary.totalSGST).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* B2B Table */}
          {data.b2b.length > 0 && (
            <Paper sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ p: 2 }}>
                B2B Invoices (Business to Business)
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice No.</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Customer GSTIN</TableCell>
                      <TableCell>Customer Name</TableCell>
                      <TableCell align="right">Taxable Value</TableCell>
                      <TableCell align="right">IGST</TableCell>
                      <TableCell align="right">CGST</TableCell>
                      <TableCell align="right">SGST</TableCell>
                      <TableCell align="right">Total Tax</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.b2b.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.invoiceNumber}</TableCell>
                        <TableCell>{new Date(item.invoiceDate).toLocaleDateString()}</TableCell>
                        <TableCell>{item.customerGSTIN}</TableCell>
                        <TableCell>{item.customerName}</TableCell>
                        <TableCell align="right">₹{Number(item.taxableValue).toFixed(2)}</TableCell>
                        <TableCell align="right">₹{Number(item.igst).toFixed(2)}</TableCell>
                        <TableCell align="right">₹{Number(item.cgst).toFixed(2)}</TableCell>
                        <TableCell align="right">₹{Number(item.sgst).toFixed(2)}</TableCell>
                        <TableCell align="right">₹{Number(item.totalTax).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* HSN Summary */}
          {data.hsnSummary.length > 0 && (
            <Paper>
              <Typography variant="h6" sx={{ p: 2 }}>
                HSN Summary
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>HSN Code</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">UQC</TableCell>
                      <TableCell align="right">Taxable Value</TableCell>
                      <TableCell align="right">IGST</TableCell>
                      <TableCell align="right">CGST</TableCell>
                      <TableCell align="right">SGST</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.hsnSummary.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.hsnCode}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell align="right">{Number(item.quantity).toFixed(2)}</TableCell>
                        <TableCell align="right">{item.uqc}</TableCell>
                        <TableCell align="right">₹{Number(item.taxableValue).toFixed(2)}</TableCell>
                        <TableCell align="right">₹{Number(item.igst).toFixed(2)}</TableCell>
                        <TableCell align="right">₹{Number(item.cgst).toFixed(2)}</TableCell>
                        <TableCell align="right">₹{Number(item.sgst).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}

