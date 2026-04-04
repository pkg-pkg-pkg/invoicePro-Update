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
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
} from '@mui/material';
import { gstService, GSTR3BResponse } from '../../services/gstService';

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

export default function GSTR3BReport() {
  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GSTR3BResponse | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await gstService.getGSTR3B(month, year);
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate GSTR-3B');
    } finally {
      setLoading(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        GSTR-3B Report (Monthly Summary)
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
            >
              {loading ? <CircularProgress size={24} /> : 'Generate Report'}
            </Button>
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
          {/* Outward Supplies */}
          <Paper sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
              Outward Supplies (Sales)
            </Typography>
            <Grid container spacing={2} sx={{ p: 2 }}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Taxable Value
                    </Typography>
                    <Typography variant="h6">₹{data.outwardSupplies.totalTaxableValue.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      IGST
                    </Typography>
                    <Typography variant="h6">₹{data.outwardSupplies.totalIGST.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      CGST
                    </Typography>
                    <Typography variant="h6">₹{data.outwardSupplies.totalCGST.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      SGST
                    </Typography>
                    <Typography variant="h6">₹{data.outwardSupplies.totalSGST.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>

          {/* Inward Supplies */}
          <Paper sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ p: 2, bgcolor: 'secondary.main', color: 'white' }}>
              Inward Supplies (Purchases) - Input Tax Credit (ITC)
            </Typography>
            <Grid container spacing={2} sx={{ p: 2 }}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Taxable Value
                    </Typography>
                    <Typography variant="h6">₹{data.inwardSupplies.totalTaxableValue.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      IGST
                    </Typography>
                    <Typography variant="h6">₹{data.inwardSupplies.totalIGST.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      CGST
                    </Typography>
                    <Typography variant="h6">₹{data.inwardSupplies.totalCGST.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      SGST
                    </Typography>
                    <Typography variant="h6">₹{data.inwardSupplies.totalSGST.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>

          {/* Tax Liability */}
          <Paper sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ p: 2, bgcolor: 'error.main', color: 'white' }}>
              Tax Liability (Payable)
            </Typography>
            <Grid container spacing={2} sx={{ p: 2 }}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      IGST Payable
                    </Typography>
                    <Typography variant="h6" color="error">
                      ₹{data.taxLiability.igst.toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      CGST Payable
                    </Typography>
                    <Typography variant="h6" color="error">
                      ₹{data.taxLiability.cgst.toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      SGST Payable
                    </Typography>
                    <Typography variant="h6" color="error">
                      ₹{data.taxLiability.sgst.toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Total Tax Payable
                    </Typography>
                    <Typography variant="h5" color="error" fontWeight="bold">
                      ₹{data.taxLiability.total.toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>

          {/* Summary */}
          <Paper>
            <Typography variant="h6" sx={{ p: 2 }}>
              Summary
            </Typography>
            <TableContainer>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell><strong>ITC Available</strong></TableCell>
                    <TableCell align="right">₹{data.summary.itcAvailable.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>ITC Utilized</strong></TableCell>
                    <TableCell align="right">₹{data.summary.itcUtilized.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>Net Tax Payable</strong></TableCell>
                    <TableCell align="right">
                      <Typography variant="h6" color="error">
                        ₹{data.summary.netTaxPayable.toFixed(2)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
}

