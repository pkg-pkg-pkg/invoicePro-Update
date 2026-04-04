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
import { GSTR2Response } from '../../services/gstService';

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

export default function GSTR2Report() {
  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GSTR2Response | null>(null);

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Mock data for GSTR2 since backend might not be implemented yet
      const mockData: GSTR2Response = {
        period: { month, year },
        b2b: [
          {
            supplierGSTIN: '27AAAAA0000A1Z5',
            supplierName: 'ABC Suppliers',
            invoiceNumber: 'PUR-001',
            invoiceDate: new Date(year, month - 1, 15).toISOString(),
            taxableValue: 50000,
            igst: 0,
            cgst: 2700,
            sgst: 2700,
            totalTax: 5400,
          },
          {
            supplierGSTIN: '07BBBBB0000B1Z5',
            supplierName: 'XYZ Traders',
            invoiceNumber: 'PUR-002',
            invoiceDate: new Date(year, month - 1, 20).toISOString(),
            taxableValue: 75000,
            igst: 4500,
            cgst: 0,
            sgst: 0,
            totalTax: 4500,
          }
        ],
        hsnSummary: [
          {
            hsnCode: '123456',
            description: 'Electronic Goods',
            quantity: 50,
            uqc: 'PCS',
            rate: 1000,
            taxableValue: 50000,
            igst: 0,
            cgst: 2700,
            sgst: 2700,
            totalTax: 5400,
          },
          {
            hsnCode: '234567',
            description: 'Machinery Parts',
            quantity: 25,
            uqc: 'PCS',
            rate: 3000,
            taxableValue: 75000,
            igst: 4500,
            cgst: 0,
            sgst: 0,
            totalTax: 4500,
          }
        ],
        summary: {
          totalInvoices: 2,
          totalTaxableValue: 125000,
          totalITC: 9900,
          totalIGST: 4500,
          totalCGST: 2700,
          totalSGST: 2700,
        }
      };

      setData(mockData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate GSTR-2 report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    const exportData = {
      ...data,
      generatedAt: new Date().toISOString(),
      reportType: 'GSTR-2',
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSTR-2_${year}_${month.toString().padStart(2, '0')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        GSTR-2 (Purchase Return)
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Monthly purchase return with HSN-wise breakdown of inward supplies
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
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
                    Total Invoices
                  </Typography>
                  <Typography variant="h5">{data.summary.totalInvoices}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Taxable Value
                  </Typography>
                  <Typography variant="h5">₹{data.summary.totalTaxableValue.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Input Tax Credit
                  </Typography>
                  <Typography variant="h5">₹{data.summary.totalITC.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Tax
                  </Typography>
                  <Typography variant="h5">₹{(data.summary.totalIGST + data.summary.totalCGST + data.summary.totalSGST).toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* B2B Purchases */}
          {data.b2b.length > 0 && (
            <Paper sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ p: 2 }}>
                B2B Purchases
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice No.</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Supplier GSTIN</TableCell>
                      <TableCell>Supplier Name</TableCell>
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
                        <TableCell>{item.supplierGSTIN}</TableCell>
                        <TableCell>{item.supplierName}</TableCell>
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
                HSN Summary (Purchase-wise)
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>HSN Code</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">UQC</TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell align="right">Taxable Value</TableCell>
                      <TableCell align="right">IGST</TableCell>
                      <TableCell align="right">CGST</TableCell>
                      <TableCell align="right">SGST</TableCell>
                      <TableCell align="right">Total Tax</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.hsnSummary.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.hsnCode}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{item.uqc}</TableCell>
                        <TableCell align="right">₹{item.rate.toFixed(2)}</TableCell>
                        <TableCell align="right">₹{item.taxableValue.toFixed(2)}</TableCell>
                        <TableCell align="right">₹{item.igst.toFixed(2)}</TableCell>
                        <TableCell align="right">₹{item.cgst.toFixed(2)}</TableCell>
                        <TableCell align="right">₹{item.sgst.toFixed(2)}</TableCell>
                        <TableCell align="right">₹{item.totalTax.toFixed(2)}</TableCell>
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
