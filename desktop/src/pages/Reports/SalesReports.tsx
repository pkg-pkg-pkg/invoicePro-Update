import { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  Inventory as InventoryIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { reportService } from '../../services/reportService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ReportHubShell } from '../../components/reports/ReportHubShell';
import { VoucherNumberLink } from '../../components/Vouchers/VoucherNumberLink';
import { PREMIUM_ERP } from '../../theme/premiumErpTheme';

const salesReports = [
  {
    id: 'register',
    title: 'Sales Register',
    description: 'Complete list of all sales invoices with details',
    icon: <DescriptionIcon />,
    accent: PREMIUM_ERP.categoryColors.sales,
  },
  {
    id: 'summary',
    title: 'Sales Summary',
    description: 'Consolidated sales data by period',
    icon: <AssessmentIcon />,
    accent: '#3B82F6',
  },
  {
    id: 'by-customer',
    title: 'Sales by Customer',
    description: 'Customer-wise sales analysis',
    icon: <PeopleIcon />,
    accent: '#6366F1',
  },
  {
    id: 'by-product',
    title: 'Sales by Product',
    description: 'Product-wise sales performance',
    icon: <InventoryIcon />,
    accent: '#0EA5E9',
  },
];

interface SalesReportsProps {
  canExport: boolean;
}

export default function SalesReports({ canExport: _canExport }: SalesReportsProps) {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    customerId: '',
    productId: '',
    categoryId: '',
    paymentStatus: '',
    page: 1,
    limit: 50,
  });

  const handleReportSelect = (reportId: string) => {
    setSelectedReport(reportId);
    setReportData(null);
    setError(null);
  };

  const handleFilterChange = (field: string, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setReportData(null);
    setError(null);
  };

  const handleGenerateReport = async () => {
    if (!selectedReport) return;

    setLoading(true);
    setError(null);

    try {
      let data;
      switch (selectedReport) {
        case 'register':
          data = await reportService.getSalesRegister(filters);
          break;
        case 'summary':
          data = await reportService.getSalesSummary({
            fromDate: filters.fromDate,
            toDate: filters.toDate,
            groupBy: 'day',
          });
          break;
        case 'by-customer':
          data = await reportService.getSalesByCustomer({
            fromDate: filters.fromDate,
            toDate: filters.toDate,
          });
          break;
        case 'by-product':
          data = await reportService.getSalesByProduct({
            fromDate: filters.fromDate,
            toDate: filters.toDate,
            categoryId: filters.categoryId || undefined,
          });
          break;
        default:
          throw new Error('Invalid report type');
      }
      setReportData(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!selectedReport) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest?.('[role="dialog"]')) return;
      e.preventDefault();
      setSelectedReport(null);
      setError(null);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [selectedReport]);

  if (!selectedReport) {
    return (
      <ReportHubShell
        categoryLabel="Select a Sales Report"
        categoryAccent={PREMIUM_ERP.categoryColors.sales}
        reports={salesReports}
        kpis={[
          { label: 'Sales reports', value: String(salesReports.length), accent: PREMIUM_ERP.blue },
          { label: 'Export', value: 'View & print', accent: '#16A34A' },
        ]}
        canExport={false}
        onSelect={handleReportSelect}
      />
    );
  }

  const selectedReportInfo = salesReports.find(r => r.id === selectedReport);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Button onClick={() => setSelectedReport(null)}>Back to Reports</Button>
          <Typography variant="h6" sx={{ mt: 1 }}>
            {selectedReportInfo?.title}
          </Typography>
        </Box>
        {reportData && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </Box>
        )}
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Filters
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="From Date"
              type="date"
              value={filters.fromDate}
              onChange={(e) => handleFilterChange('fromDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="To Date"
              type="date"
              value={filters.toDate}
              onChange={(e) => handleFilterChange('toDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          {selectedReport === 'register' && (
            <>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Payment Status</InputLabel>
                  <Select
                    value={filters.paymentStatus}
                    label="Payment Status"
                    onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="PENDING">Pending</MenuItem>
                    <MenuItem value="PARTIAL">Partial</MenuItem>
                    <MenuItem value="PAID">Paid</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}
          <Grid item xs={12} md={selectedReport === 'register' ? 2 : 6}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleGenerateReport}
              disabled={loading}
              sx={{ height: '56px' }}
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

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {reportData && !loading && (
        <Box>
          {reportData.summary && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Summary
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(reportData.summary).map(([key, value]) => (
                  <Grid item xs={6} sm={3} key={key}>
                    <Typography variant="body2" color="text.secondary">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Typography>
                    <Typography variant="h6">
                      {typeof value === 'number' && (key.includes('Amount') || key.includes('Total'))
                        ? formatCurrency(value)
                        : String(value)}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  {selectedReport === 'register' && (
                    <>
                      <TableCell>Date</TableCell>
                      <TableCell>Invoice#</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell>Products</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">CGST</TableCell>
                      <TableCell align="right">SGST</TableCell>
                      <TableCell align="right">IGST</TableCell>
                      <TableCell align="right">Tax</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">Paid</TableCell>
                      <TableCell align="right">Balance</TableCell>
                      <TableCell>Status</TableCell>
                    </>
                  )}
                  {selectedReport === 'summary' && (
                    <>
                      <TableCell>Period</TableCell>
                      <TableCell align="right">Invoices</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Taxable Amount</TableCell>
                      <TableCell align="right">Tax</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </>
                  )}
                  {selectedReport === 'by-customer' && (
                    <>
                      <TableCell>Customer</TableCell>
                      <TableCell align="right">Invoices</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Total Amount</TableCell>
                      <TableCell align="right">Paid</TableCell>
                      <TableCell align="right">Balance</TableCell>
                      <TableCell>Last Purchase</TableCell>
                    </>
                  )}
                  {selectedReport === 'by-product' && (
                    <>
                      <TableCell>Product</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Avg Rate</TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {reportData.data && reportData.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No data found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  reportData.data?.map((row: any, index: number) => (
                    <TableRow key={index} hover>
                      {selectedReport === 'register' && (
                        <>
                          <TableCell>{formatDate(row.date)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <VoucherNumberLink
                              voucherId={row.id}
                              voucherType="SALES"
                              voucherNumber={row.invoiceNumber}
                            />
                          </TableCell>
                          <TableCell>{row.customerName}</TableCell>
                          <TableCell>{row.products}</TableCell>
                          <TableCell align="right">{formatCurrency(row.subtotal)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.cgst || 0)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.sgst || 0)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.igst || 0)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.totalTax)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.grandTotal)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.paid)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.balance)}</TableCell>
                          <TableCell>
                            <Chip
                              label={row.paymentStatus}
                              size="small"
                              color={
                                row.paymentStatus === 'PAID'
                                  ? 'success'
                                  : row.paymentStatus === 'PARTIAL'
                                  ? 'warning'
                                  : 'default'
                              }
                            />
                          </TableCell>
                        </>
                      )}
                      {selectedReport === 'summary' && (
                        <>
                          <TableCell>{row.period}</TableCell>
                          <TableCell align="right">{row.invoices}</TableCell>
                          <TableCell align="right">{row.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(row.taxableAmount)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.tax)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.total)}</TableCell>
                        </>
                      )}
                      {selectedReport === 'by-customer' && (
                        <>
                          <TableCell>{row.customerName}</TableCell>
                          <TableCell align="right">{row.invoices}</TableCell>
                          <TableCell align="right">{row.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(row.totalAmount)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.paid)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.balance)}</TableCell>
                          <TableCell>{formatDate(row.lastPurchaseDate)}</TableCell>
                        </>
                      )}
                      {selectedReport === 'by-product' && (
                        <>
                          <TableCell>{row.productName}</TableCell>
                          <TableCell>{row.category}</TableCell>
                          <TableCell align="right">{row.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(row.amount)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.averageRate)}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {reportData.pagination && (
            <TablePagination
              component="div"
              count={reportData.pagination.total}
              page={reportData.pagination.page - 1}
              onPageChange={(_, page) => handleFilterChange('page', page + 1)}
              rowsPerPage={reportData.pagination.limit}
              onRowsPerPageChange={(e) =>
                handleFilterChange('limit', parseInt(e.target.value, 10))
              }
              rowsPerPageOptions={[25, 50, 100]}
            />
          )}
        </Box>
      )}
    </Box>
  );
}
