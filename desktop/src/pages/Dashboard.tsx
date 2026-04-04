// FILE: src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from 'react';
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
import { alpha, useTheme } from '@mui/material/styles';

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
} from 'recharts';

import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  People as PeopleIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  ArrowForward as ArrowForwardIcon,
  Inventory2 as Inventory2Icon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';

import { AppDispatch, RootState } from '../store';
import {
  clearError,
  fetchDashboardSummary,
  fetchGstSnapshot,
  fetchLowStock,
  fetchOutstandingSummary,
  fetchPayableSummary,
  fetchRecentTransactions,
  fetchSalesAnalytics,
  setPeriod,
} from '../store/slices/dashboardSlice';
import { formatCurrency, formatDate } from '../utils/formatters';
import { usePermissions } from '../hooks/usePermissions';


/** Premium dashboard mock: muted icon wells (pastel on dark). */
const QUICK_ACTION_STYLES: { label: string; icon: typeof ReceiptIcon; color: string; to: string }[] = [
  { label: 'Sales Voucher', icon: ReceiptIcon, color: '#a78bfa', to: '/vouchers/sales/new' },
  { label: 'Purchase Voucher', icon: ShoppingCartIcon, color: '#2dd4bf', to: '/vouchers/purchase/new' },
  { label: 'Record Expense', icon: PaymentIcon, color: '#fdba74', to: '/vouchers/payment-vouchers/new' },
  { label: 'Add Customer', icon: PeopleIcon, color: '#7dd3fc', to: '/parties/new' },
  { label: 'Add Inventory', icon: Inventory2Icon, color: '#fda4af', to: '/masters/inventory-items/new' },
];

export default function Dashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { isAdmin } = usePermissions();

  const {
    summary,
    salesAnalytics,
    outstandingSummary,
    payableSummary,
    recentTransactions,
    gstSnapshot,
    lowStock,
    loading,
    error,
    period,
  } = useSelector((state: RootState) => state.dashboard);

  const [analyticsPeriod, setAnalyticsPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [analyticsGroupBy, setAnalyticsGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const lowStockRows = useMemo(() => lowStock.slice(0, 8), [lowStock]);
  const gstData = useMemo(
    () => gstSnapshot ?? { outputGst: 0, inputItc: 0, receivable: 0, payable: 0 },
    [gstSnapshot]
  );

  const goToReportsTab = (tab: string) => {
    const params = new URLSearchParams();
    params.set('tab', tab);
    navigate(`/reports?${params.toString()}`);
  };

  // Load all dashboard data from backend
  useEffect(() => {
    dispatch(fetchDashboardSummary(period));
    dispatch(fetchSalesAnalytics({ period: analyticsPeriod, groupBy: analyticsGroupBy }));
    dispatch(fetchOutstandingSummary());
    dispatch(fetchPayableSummary());
    dispatch(fetchRecentTransactions(5));
    dispatch(fetchGstSnapshot(period));
    dispatch(fetchLowStock());
  }, [dispatch, period, analyticsPeriod, analyticsGroupBy]);

  const handlePeriodChange = (newPeriod: 'today' | 'week' | 'month' | 'year') => {
    dispatch(setPeriod(newPeriod));
    dispatch(fetchDashboardSummary(newPeriod));
    dispatch(fetchGstSnapshot(newPeriod));
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
      {/* Period + refresh (page title is in the app header) */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
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
              dispatch(fetchGstSnapshot(period));
              dispatch(fetchLowStock());
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Quick Actions */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography
          variant="overline"
          sx={{ display: 'block', mb: 2, letterSpacing: '0.08em', fontWeight: 700, color: 'text.secondary' }}
        >
          Quick actions
        </Typography>
        <Grid container spacing={2}>
          {QUICK_ACTION_STYLES.map((a) => {
            const Icon = a.icon;
            return (
            <Grid item xs={6} sm={4} md={2.4} key={a.to}>
              <Paper
                elevation={0}
                onClick={() => navigate(a.to)}
                sx={(theme) => ({
                  p: 2,
                  minHeight: 118,
                  cursor: 'pointer',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  transition: 'border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease',
                  '&:hover': {
                    borderColor: alpha(a.color, 0.55),
                    bgcolor: alpha(a.color, theme.palette.mode === 'dark' ? 0.12 : 0.08),
                    transform: 'translateY(-2px)',
                  },
                })}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: alpha(a.color, theme.palette.mode === 'dark' ? 0.2 : 0.12),
                    color: a.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon sx={{ fontSize: 28 }} />
                </Box>
                <Typography variant="caption" fontWeight={700} textAlign="center" color="text.primary">
                  {a.label}
                </Typography>
              </Paper>
            </Grid>
            );
          })}
        </Grid>
      </Paper>

      <Typography
        variant="overline"
        sx={{ display: 'block', mb: 2, letterSpacing: '0.08em', fontWeight: 700, color: 'text.secondary' }}
      >
        Today&apos;s overview
      </Typography>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              cursor: 'pointer',
              overflow: 'hidden',
              borderTop: '3px solid',
              borderTopColor: 'primary.main',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': { transform: 'translateY(-3px)', boxShadow: 8 },
            }}
            onClick={() => navigate('/vouchers/sales')}
          >
            <CardContent sx={{ pt: 2.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ letterSpacing: '0.04em' }}>
                Total Sales
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, my: 0.5, color: 'text.primary' }}>
                {loading ? <CircularProgress size={24} /> : formatCurrency(summary?.totalSales || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                {summary?.salesCount || 0} invoices
              </Typography>
              <Chip
                size="small"
                label={
                  !loading && (summary?.totalSales || 0) === 0 && (summary?.salesCount || 0) === 0
                    ? 'No activity'
                    : 'Live'
                }
                sx={{
                  height: 22,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === 'dark' ? 0.06 : 0.08),
                  color: 'text.secondary',
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              cursor: 'pointer',
              overflow: 'hidden',
              borderTop: '3px solid',
              borderTopColor: '#2dd4bf',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': { transform: 'translateY(-3px)', boxShadow: 8 },
            }}
            onClick={() => navigate('/purchase-invoices')}
          >
            <CardContent sx={{ pt: 2.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ letterSpacing: '0.04em' }}>
                Total Purchase
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, my: 0.5, color: '#2dd4bf' }}>
                {loading ? <CircularProgress size={24} /> : formatCurrency(summary?.totalPurchase || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                {summary?.purchaseCount || 0} invoices
              </Typography>
              <Chip
                size="small"
                label={
                  !loading && (summary?.totalPurchase || 0) === 0 && (summary?.purchaseCount || 0) === 0
                    ? 'No activity'
                    : 'Live'
                }
                sx={{
                  height: 22,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === 'dark' ? 0.06 : 0.08),
                  color: 'text.secondary',
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              cursor: 'pointer',
              overflow: 'hidden',
              borderTop: '3px solid',
              borderTopColor: '#fbbf24',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': { transform: 'translateY(-3px)', boxShadow: 8 },
            }}
            onClick={() => goToReportsTab('party')}
          >
            <CardContent sx={{ pt: 2.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ letterSpacing: '0.04em' }}>
                Outstanding
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, my: 0.5, color: '#fbbf24' }}>
                {loading ? <CircularProgress size={24} /> : formatCurrency(summary?.totalOutstanding || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                {summary?.outstandingCount || 0} customers
              </Typography>
              <Chip
                size="small"
                label={!loading && (summary?.totalOutstanding || 0) === 0 ? 'All clear' : 'Open'}
                sx={{
                  height: 22,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === 'dark' ? 0.06 : 0.08),
                  color: 'text.secondary',
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              cursor: 'pointer',
              overflow: 'hidden',
              borderTop: '3px solid',
              borderTopColor: '#fb7185',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': { transform: 'translateY(-3px)', boxShadow: 8 },
            }}
            onClick={() => goToReportsTab('party')}
          >
            <CardContent sx={{ pt: 2.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ letterSpacing: '0.04em' }}>
                Payable
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, my: 0.5, color: '#fb7185' }}>
                {loading ? <CircularProgress size={24} /> : formatCurrency(summary?.totalPayable || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                {summary?.payableCount || 0} suppliers
              </Typography>
              <Chip
                size="small"
                label={!loading && (summary?.totalPayable || 0) === 0 ? 'All clear' : 'Open'}
                sx={{
                  height: 22,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === 'dark' ? 0.06 : 0.08),
                  color: 'text.secondary',
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Financial Cards - Only visible to Admin/Owner */}
        {isAdmin && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 3,
                    '& .card-icon': {
                      opacity: 0.6,
                    },
                  },
                }}
                onClick={() => navigate('/accounts?tab=bank')}
              >
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
                    <AccountBalanceIcon className="card-icon" sx={{ fontSize: 40, color: 'success.main', opacity: 0.3, transition: 'opacity 0.2s' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 3,
                    '& .card-icon': {
                      opacity: 0.6,
                    },
                  },
                }}
                onClick={() => navigate('/accounts')}
              >
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
                    <AccountBalanceIcon className="card-icon" sx={{ fontSize: 40, color: 'primary.main', opacity: 0.3, transition: 'opacity 0.2s' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 3,
                    '& .card-icon': {
                      opacity: 0.6,
                    },
                  },
                }}
                onClick={() => navigate('/reports')}
              >
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
                    <Box sx={{ opacity: 0.3, transition: 'opacity 0.2s' }} className="card-icon">
                      {summary && summary.profitLoss >= 0 ? (
                        <TrendingUpIcon sx={{ fontSize: 40, color: 'success.main' }} />
                      ) : (
                        <TrendingDownIcon sx={{ fontSize: 40, color: 'error.main' }} />
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 3,
                '& .card-icon': {
                  opacity: 0.6,
                },
              },
            }}
            onClick={() => navigate('/reports')}
          >
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
                <Box className="card-icon" sx={{ fontSize: 40, opacity: 0.3, transition: 'opacity 0.2s' }}>
                  ⚠️
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              GST Snapshot
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Paper
                  sx={(t) => ({
                    p: 2,
                    bgcolor:
                      t.palette.mode === 'dark'
                        ? alpha(t.palette.common.white, 0.08)
                        : t.palette.grey[50],
                    border: `1px solid ${alpha(t.palette.divider, t.palette.mode === 'dark' ? 1 : 0.8)}`,
                  })}
                >
                  <Typography variant="body2" color="text.secondary">
                    Output GST (Sales)
                  </Typography>
                  <Typography variant="h6" color="text.primary">
                    {formatCurrency(gstData.outputGst)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper
                  sx={(t) => ({
                    p: 2,
                    bgcolor:
                      t.palette.mode === 'dark'
                        ? alpha(t.palette.common.white, 0.08)
                        : t.palette.grey[50],
                    border: `1px solid ${alpha(t.palette.divider, t.palette.mode === 'dark' ? 1 : 0.8)}`,
                  })}
                >
                  <Typography variant="body2" color="text.secondary">
                    Input ITC (Purchase)
                  </Typography>
                  <Typography variant="h6" color="text.primary">
                    {formatCurrency(gstData.inputItc)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper
                  sx={(t) => ({
                    p: 2,
                    bgcolor:
                      t.palette.mode === 'dark'
                        ? alpha(t.palette.success.main, 0.18)
                        : t.palette.success.light,
                    border: `1px solid ${alpha(t.palette.success.main, t.palette.mode === 'dark' ? 0.35 : 0.25)}`,
                  })}
                >
                  <Typography variant="body2" color="text.secondary">
                    GST Receivable
                  </Typography>
                  <Typography variant="h6" color="text.primary">
                    {formatCurrency(gstData.receivable)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper
                  sx={(t) => ({
                    p: 2,
                    bgcolor:
                      t.palette.mode === 'dark'
                        ? alpha(t.palette.warning.main, 0.2)
                        : t.palette.warning.light,
                    border: `1px solid ${alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.4 : 0.3)}`,
                  })}
                >
                  <Typography variant="body2" color="text.secondary">
                    GST Payable
                  </Typography>
                  <Typography variant="h6" color="text.primary">
                    {formatCurrency(gstData.payable)}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Low Stock Alerts</Typography>
              <Button size="small" onClick={() => navigate('/products')}>
                View All
                <ArrowForwardIcon sx={{ ml: 0.5, fontSize: 16 }} />
              </Button>
            </Box>

            {lowStockRows.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell align="right">Stock</TableCell>
                      <TableCell align="right">Reorder</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lowStockRows.map((item) => (
                      <TableRow
                        key={item.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate('/products')}
                      >
                        <TableCell>{item.name}</TableCell>
                        <TableCell align="right">{item.currentStock}</TableCell>
                        <TableCell align="right">{item.reorderLevel}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 4 }}>
                No low stock items
              </Typography>
            )}
          </Paper>
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
                      <TableRow
                        key={customer.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate('/customers')}
                      >
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
                      <TableRow
                        key={supplier.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate('/suppliers')}
                      >
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
              <Button size="small" onClick={() => navigate('/vouchers/sales')}>
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
                      <TableRow
                        key={invoice.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate('/vouchers/sales')}
                      >
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
                      <TableRow
                        key={payment.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate('/payments')}
                      >
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

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Recent Credit Notes</Typography>
              <Button size="small" onClick={() => navigate('/credit-notes')}>
                View All
                <ArrowForwardIcon sx={{ ml: 0.5, fontSize: 16 }} />
              </Button>
            </Box>

            {recentTransactions?.creditNotes?.length ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Credit Note</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentTransactions.creditNotes.map((cn) => (
                      <TableRow
                        key={cn.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate('/credit-notes')}
                      >
                        <TableCell>
                          <Tooltip title="Credit Note (Sales Return)">
                            <Chip label={cn.number} size="small" />
                          </Tooltip>
                        </TableCell>
                        <TableCell>{formatDate(cn.date)}</TableCell>
                        <TableCell>{cn.party}</TableCell>
                        <TableCell align="right">{formatCurrency(cn.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 4 }}>
                No recent credit notes
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Recent Debit Notes</Typography>
              <Button size="small" onClick={() => navigate('/debit-notes')}>
                View All
                <ArrowForwardIcon sx={{ ml: 0.5, fontSize: 16 }} />
              </Button>
            </Box>

            {recentTransactions?.debitNotes?.length ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Debit Note</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentTransactions.debitNotes.map((dn) => (
                      <TableRow
                        key={dn.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate('/debit-notes')}
                      >
                        <TableCell>
                          <Tooltip title="Debit Note (Purchase Return)">
                            <Chip label={dn.number} size="small" />
                          </Tooltip>
                        </TableCell>
                        <TableCell>{formatDate(dn.date)}</TableCell>
                        <TableCell>{dn.party}</TableCell>
                        <TableCell align="right">{formatCurrency(dn.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 4 }}>
                No recent debit notes
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
