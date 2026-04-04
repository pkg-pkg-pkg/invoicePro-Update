// FILE: src/pages/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  People as PeopleIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Inventory as InventoryIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';

import { AppDispatch, RootState } from '../store';
import {
  fetchDashboardSummary,
  fetchSalesAnalytics,
  fetchOutstandingSummary,
  fetchPayableSummary,
  fetchRecentTransactions,
  setPeriod,
  clearError,
} from '../store/slices/dashboardSlice';
import { formatCurrency, formatDate } from '../utils/formatters';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Dashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const {
    summary,
    salesAnalytics,
    outstandingSummary,
    payableSummary,
    recentTransactions,
    loading,
    error,
    period,
  } = useSelector((state: RootState) => state.dashboard);

  const [analyticsPeriod, setAnalyticsPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [analyticsGroupBy, setAnalyticsGroupBy] = useState<'day' | 'week' | 'month'>('day');

  // Load all dashboard data from backend
  useEffect(() => {
    dispatch(fetchDashboardSummary(period));
    dispatch(fetchSalesAnalytics({ period: analyticsPeriod, groupBy: analyticsGroupBy }));
    dispatch(fetchOutstandingSummary());
    dispatch(fetchPayableSummary());
    dispatch(fetchRecentTransactions(5));
  }, [dispatch, period, analyticsPeriod, analyticsGroupBy]);

  const handlePeriodChange = (newPeriod: 'today' | 'week' | 'month' | 'year') => {
    dispatch(setPeriod(newPeriod));
    dispatch(fetchDashboardSummary(newPeriod));
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Top Bar – Title + Period + Refresh */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Dashboard</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Summary Period</InputLabel>
            <Select
              value={period}
              label="Summary Period"
              onChange={(e) => handlePeriodChange(e.target.value as any)}
            >
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="week">This Week</MenuItem>
              <MenuItem value="month">This Month</MenuItem>
              <MenuItem value="year">This Year</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            onClick={() => {
              dispatch(fetchDashboardSummary(period));
              dispatch(fetchSalesAnalytics({ period: analyticsPeriod, groupBy: analyticsGroupBy }));
              dispatch(fetchOutstandingSummary());
              dispatch(fetchPayableSummary());
              dispatch(fetchRecentTransactions(5));
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Sales
                  </Typography>
                  <Typography variant="h4">
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      formatCurrency(summary?.totalSales || 0)
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summary?.salesCount || 0} invoices
                  </Typography>
                </Box>
                <ReceiptIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Purchase
                  </Typography>
                  <Typography variant="h4">
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      formatCurrency(summary?.totalPurchase || 0)
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summary?.purchaseCount || 0} invoices
                  </Typography>
                </Box>
                <PaymentIcon sx={{ fontSize: 40, color: 'error.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Outstanding
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      formatCurrency(summary?.totalOutstanding || 0)
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summary?.outstandingCount || 0} customers
                  </Typography>
                </Box>
                <PeopleIcon sx={{ fontSize: 40, color: 'warning.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Payable
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      formatCurrency(summary?.totalPayable || 0)
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summary?.payableCount || 0} suppliers
                  </Typography>
                </Box>
                <PeopleIcon sx={{ fontSize: 40, color: 'error.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Cash in Hand
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      formatCurrency(summary?.cashInHand || 0)
                    )}
                  </Typography>
                </Box>
                <AccountBalanceIcon sx={{ fontSize: 40, color: 'success.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Bank Balance
                  </Typography>
                  <Typography variant="h4" color="primary.main">
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      formatCurrency(summary?.bankBalance || 0)
                    )}
                  </Typography>
                </Box>
                <AccountBalanceIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Profit/Loss
                  </Typography>
                  <Typography
                    variant="h4"
                    color={summary && summary.profitLoss >= 0 ? 'success.main' : 'error.main'}
                  >
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      <>
                        {summary && summary.profitLoss >= 0 ? (
                          <TrendingUpIcon sx={{ fontSize: 20, verticalAlign: 'middle', mr: 0.5 }} />
                        ) : (
                          <TrendingDownIcon sx={{ fontSize: 20, verticalAlign: 'middle', mr: 0.5 }} />
                        )}
                        {formatCurrency(Math.abs(summary?.profitLoss || 0))}
                      </>
                    )}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Overdue
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      formatCurrency(summary?.overdueAmount || 0)
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summary?.overdueCount || 0} invoices
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Sales Trend + Top Products */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Sales Trend</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <InputLabel>Period</InputLabel>
                  <Select
                    value={analyticsPeriod}
                    label="Period"
                    onChange={(e) => setAnalyticsPeriod(e.target.value as any)}
                  >
                    <MenuItem value="week">Week</MenuItem>
                    <MenuItem value="month">Month</MenuItem>
                    <MenuItem value="year">Year</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <InputLabel>Group By</InputLabel>
                  <Select
                    value={analyticsGroupBy}
                    label="Group By"
                    onChange={(e) => setAnalyticsGroupBy(e.target.value as any)}
                  >
                    <MenuItem value="day">Day</MenuItem>
                    <MenuItem value="week">Week</MenuItem>
                    <MenuItem value="month">Month</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesAnalytics?.analytics || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sales" stroke="#8884d8" name="Sales" />
                  <Line type="monotone" dataKey="tax" stroke="#82ca9d" name="Tax" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top Products
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : salesAnalytics?.topProducts && salesAnalytics.topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesAnalytics.topProducts.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="productName" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="amount" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 4 }}>
                No data available
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Outstanding & Payable */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Top Outstanding Customers</Typography>
              <Button size="small" onClick={() => navigate('/customers')}>
                View All
                <ArrowForwardIcon sx={{ ml: 0.5, fontSize: 16 }} />
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : outstandingSummary && outstandingSummary.customers.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer</TableCell>
                      <TableCell align="right">Outstanding</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {outstandingSummary.customers.slice(0, 5).map((customer) => (
                      <TableRow key={customer.id} hover>
                        <TableCell>{customer.name}</TableCell>
                        <TableCell align="right">
                          {formatCurrency(customer.currentBalance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 4 }}>
                No outstanding amounts
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Top Payable Suppliers</Typography>
              <Button size="small" onClick={() => navigate('/suppliers')}>
                View All
                <ArrowForwardIcon sx={{ ml: 0.5, fontSize: 16 }} />
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : payableSummary && payableSummary.suppliers.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Supplier</TableCell>
                      <TableCell align="right">Payable</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payableSummary.suppliers.slice(0, 5).map((supplier) => (
                      <TableRow key={supplier.id} hover>
                        <TableCell>{supplier.name}</TableCell>
                        <TableCell align="right">
                          {formatCurrency(supplier.currentBalance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 4 }}>
                No payable amounts
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Transactions */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Recent Invoices</Typography>
              <Button size="small" onClick={() => navigate('/invoices')}>
                View All
                <ArrowForwardIcon sx={{ ml: 0.5, fontSize: 16 }} />
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : recentTransactions && recentTransactions.invoices.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentTransactions.invoices.map((invoice) => (
                      <TableRow key={invoice.id} hover>
                        <TableCell>
                          <Tooltip title={invoice.type}>
                            <Chip label={invoice.invoiceNumber} size="small" />
                          </Tooltip>
                        </TableCell>
                        <TableCell>{formatDate(invoice.date)}</TableCell>
                        <TableCell align="right">
                          {formatCurrency(invoice.grandTotal)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={invoice.paymentStatus}
                            size="small"
                            color={
                              invoice.paymentStatus === 'PAID'
                                ? 'success'
                                : invoice.paymentStatus === 'PARTIAL'
                                ? 'warning'
                                : 'default'
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 4 }}>
                No recent invoices
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Recent Payments</Typography>
              <Button size="small" onClick={() => navigate('/payments')}>
                View All
                <ArrowForwardIcon sx={{ ml: 0.5, fontSize: 16 }} />
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : recentTransactions && recentTransactions.payments.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Mode</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentTransactions.payments.map((payment) => (
                      <TableRow key={payment.id} hover>
                        <TableCell>
                          <Chip
                            label={payment.type}
                            size="small"
                            color={payment.type === 'RECEIPT' ? 'success' : 'error'}
                          />
                        </TableCell>
                        <TableCell>{formatDate(payment.date)}</TableCell>
                        <TableCell>{payment.paymentMode}</TableCell>
                        <TableCell align="right">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 4 }}>
                No recent payments
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
