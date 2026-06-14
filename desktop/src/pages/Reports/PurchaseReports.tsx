import { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Button,
  Paper,
  TextField,
  CircularProgress,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { ShoppingCart as ShoppingCartIcon, Business as BusinessIcon } from '@mui/icons-material';
import { reportService } from '../../services/reportService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { VoucherNumberLink } from '../../components/Vouchers/VoucherNumberLink';

interface PurchaseReportsProps {
  canExport: boolean;
}

export default function PurchaseReports({ canExport: _canExport }: PurchaseReportsProps) {
  const [selectedReport, setSelectedReport] = useState<'register' | 'by-supplier' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '' });

  const generate = async () => {
    if (!selectedReport) return;
    setLoading(true);
    setError(null);
    try {
      const data =
        selectedReport === 'register'
          ? await reportService.getPurchaseRegister(filters)
          : await reportService.getPurchaseBySupplier(filters);
      setReportData(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedReport) {
    return (
      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>Select a Purchase Report</Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardActionArea onClick={() => { setSelectedReport('register'); setReportData(null); }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <ShoppingCartIcon color="primary" />
                    <Typography variant="subtitle1">Purchase Register</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Date-wise purchase vouchers with totals
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardActionArea onClick={() => { setSelectedReport('by-supplier'); setReportData(null); }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <BusinessIcon color="primary" />
                    <Typography variant="subtitle1">Supplier Analysis</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Supplier-wise purchase analysis with date filters
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Button onClick={() => { setSelectedReport(null); setError(null); }}>Back to Reports</Button>
          <Typography variant="h6" sx={{ mt: 1 }}>
            {selectedReport === 'register' ? 'Purchase Register' : 'Supplier Analysis'}
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="From Date"
              type="date"
              value={filters.fromDate}
              onChange={(e) => {
                setFilters((p) => ({ ...p, fromDate: e.target.value }));
                setReportData(null);
                setError(null);
              }}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="To Date"
              type="date"
              value={filters.toDate}
              onChange={(e) => {
                setFilters((p) => ({ ...p, toDate: e.target.value }));
                setReportData(null);
                setError(null);
              }}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Button variant="contained" fullWidth sx={{ height: 56 }} onClick={generate} disabled={loading}>
              {loading ? <CircularProgress size={22} /> : 'Generate Report'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {reportData ? (
        <Paper sx={{ p: 0, overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {selectedReport === 'register' ? (
                  <>
                    <TableCell>Date</TableCell>
                    <TableCell>Voucher#</TableCell>
                    <TableCell>Supplier</TableCell>
                    <TableCell>Products</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">CGST</TableCell>
                    <TableCell align="right">SGST</TableCell>
                    <TableCell align="right">IGST</TableCell>
                    <TableCell align="right">Tax</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>Supplier</TableCell>
                    <TableCell align="right">Vouchers</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell align="right">Total Amount</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell>Last Purchase</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {(reportData.data || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={selectedReport === 'register' ? 10 : 6} align="center">
                    No data found
                  </TableCell>
                </TableRow>
              ) : (
                (reportData.data || []).map((row: any, i: number) => (
                  <TableRow key={i}>
                    {selectedReport === 'register' ? (
                      <>
                        <TableCell>{formatDate(row.date)}</TableCell>
                        <TableCell>
                          <VoucherNumberLink
                            voucherId={row.id}
                            voucherType="PURCHASE"
                            voucherNumber={row.voucherNumber}
                          />
                        </TableCell>
                        <TableCell>{row.supplierName}</TableCell>
                        <TableCell>{row.products}</TableCell>
                        <TableCell align="right">{formatCurrency(row.subtotal || 0)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.cgst || 0)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.sgst || 0)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.igst || 0)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.totalTax || 0)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.grandTotal || 0)}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>{row.supplierName}</TableCell>
                        <TableCell align="right">{row.vouchers}</TableCell>
                        <TableCell align="right">{row.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(row.totalAmount || 0)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.balance || 0)}</TableCell>
                        <TableCell>{formatDate(row.lastPurchaseDate)}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      ) : null}
    </Box>
  );
}
