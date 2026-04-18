import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Tabs,
  Tab,
  Stack,
  IconButton,
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
  People as PeopleIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  ArrowForward as ArrowForwardIcon,
  Inventory2 as Inventory2Icon,
  ShoppingCart as ShoppingCartIcon,
  BarChart as BarChartIcon,
  Storefront as StorefrontIcon,
  SwapHoriz as SwapHorizIcon,
  WarningAmber as WarningAmberIcon,
  DarkModeRounded as DarkModeRoundedIcon,
  LightModeRounded as LightModeRoundedIcon,
  NotificationsNoneRounded as NotificationsNoneRoundedIcon,
} from '@mui/icons-material';

import { AppDispatch, RootState } from '../store';
import {
  clearError,
  fetchTodayOverview,
  fetchGstSnapshot,
  fetchLowStock,
  fetchOutstandingSummary,
  fetchPayableSummary,
  fetchRecentTransactions,
  fetchSalesAnalytics,
  setGstPeriod,
} from '../store/slices/dashboardSlice';
import { formatCurrency, formatDate } from '../utils/formatters';
import { usePermissions } from '../hooks/usePermissions';
import {
  APPEARANCE_CHANGED_EVENT,
  applyAppearanceAndNotify,
  readAccentColor,
  readUiMode,
  type UiMode,
} from '../theme/appearanceSettings';
import { indianFYStartYearForDate, labelIndianFY, formatIndianFYRangeShort, indianFYStartYearsWithVoucherDates } from '../utils/indianFY';
import { voucherService } from '../services/vouchers/voucherService';

const TAB_QUERY = 'dashboardTab';
const FY_STORAGE_KEY = 'dashboard_selected_fy_start_year';
const TAB_KEYS = ['gst', 'trend', 'customers', 'suppliers', 'transactions'] as const;

function tabIndexFromSearch(value: string | null): number {
  const k = (value || 'gst').toLowerCase();
  const i = TAB_KEYS.indexOf(k as (typeof TAB_KEYS)[number]);
  return i >= 0 ? i : 0;
}

function TabPanel({ children, value, id }: { children: React.ReactNode; value: number; id: number }) {
  if (value !== id) return null;
  return (
    <Box
      role="tabpanel"
      sx={{
        pt: 2,
        minHeight: 320,
        maxHeight: 'calc(100vh - 280px)',
        overflow: 'auto',
      }}
    >
      {children}
    </Box>
  );
}

export default function Dashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = usePermissions();

  const {
    summary,
    todaySummary,
    todayOverviewLoading,
    salesAnalytics,
    outstandingSummary,
    payableSummary,
    recentTransactions,
    gstSnapshot,
    lowStock,
    loading,
    error,
    gstPeriod,
  } = useSelector((state: RootState) => state.dashboard);

  const overview = todaySummary ?? summary;
  const overviewBusy = todayOverviewLoading;

  const [analyticsPeriod, setAnalyticsPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [analyticsGroupBy, setAnalyticsGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [txnSubTab, setTxnSubTab] = useState(0);
  const [uiMode, setUiMode] = useState<UiMode>(() => readUiMode());

  const [fyStartYear, setFyStartYear] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(FY_STORAGE_KEY);
      const n = raw != null ? Number.parseInt(raw, 10) : NaN;
      if (Number.isFinite(n)) return n;
    } catch {
      /* ignore */
    }
    return indianFYStartYearForDate(new Date());
  });

  /** FY years that have at least one voucher (newest first). */
  const [fyWithData, setFyWithData] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await voucherService.list();
        const years = indianFYStartYearsWithVoucherDates(list.map((v) => v.date));
        if (!cancelled) setFyWithData(years);
      } catch {
        if (!cancelled) setFyWithData([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!fyWithData.length) return;
    if (!fyWithData.includes(fyStartYear)) {
      setFyStartYear(fyWithData[0]);
    }
  }, [fyWithData, fyStartYear]);

  /** No voucher FY list: always use current Indian FY so the range box, cards, and fetched summary stay in sync (avoids stale localStorage year). */
  useEffect(() => {
    if (fyWithData.length > 0) return;
    const cur = indianFYStartYearForDate(new Date());
    setFyStartYear((prev) => (prev === cur ? prev : cur));
  }, [fyWithData]);

  const tabValue = tabIndexFromSearch(searchParams.get(TAB_QUERY));

  const setMainTab = useCallback(
    (index: number) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set(TAB_QUERY, TAB_KEYS[index]);
          return p;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const gstData = useMemo(
    () => gstSnapshot ?? { outputGst: 0, inputItc: 0, receivable: 0, payable: 0 },
    [gstSnapshot]
  );

  const lowStockPreview = useMemo(() => lowStock.slice(0, 3), [lowStock]);
  const salesTrendPoints = salesAnalytics?.analytics ?? [];

  const goToReportsTab = (tab: string) => {
    const params = new URLSearchParams();
    params.set('tab', tab);
    navigate(`/reports?${params.toString()}`);
  };

  const refreshCore = useCallback(() => {
    dispatch(fetchTodayOverview(fyStartYear));
    dispatch(fetchLowStock());
    dispatch(fetchOutstandingSummary());
    dispatch(fetchPayableSummary());
    dispatch(fetchRecentTransactions(8));
    dispatch(fetchGstSnapshot(gstPeriod));
    if (tabValue === 1) {
      dispatch(fetchSalesAnalytics({ period: analyticsPeriod, groupBy: analyticsGroupBy }));
    }
  }, [dispatch, fyStartYear, gstPeriod, tabValue, analyticsPeriod, analyticsGroupBy]);

  useEffect(() => {
    try {
      localStorage.setItem(FY_STORAGE_KEY, String(fyStartYear));
    } catch {
      /* ignore */
    }
    dispatch(fetchTodayOverview(fyStartYear));
  }, [dispatch, fyStartYear]);

  useEffect(() => {
    dispatch(fetchLowStock());
    dispatch(fetchOutstandingSummary());
    dispatch(fetchPayableSummary());
    dispatch(fetchRecentTransactions(8));
    dispatch(fetchGstSnapshot(gstPeriod));
  }, [dispatch, gstPeriod]);

  useEffect(() => {
    if (tabValue === 1) {
      dispatch(fetchSalesAnalytics({ period: analyticsPeriod, groupBy: analyticsGroupBy }));
    }
  }, [dispatch, tabValue, analyticsPeriod, analyticsGroupBy]);

  useEffect(() => {
    const syncAppearance = () => setUiMode(readUiMode());
    window.addEventListener(APPEARANCE_CHANGED_EVENT, syncAppearance);
    return () => window.removeEventListener(APPEARANCE_CHANGED_EVENT, syncAppearance);
  }, []);

  const toggleUiMode = useCallback(() => {
    const nextMode: UiMode = uiMode === 'premium-dark' ? 'light' : 'premium-dark';
    applyAppearanceAndNotify(nextMode, readAccentColor());
    setUiMode(nextMode);
  }, [uiMode]);

  const quickActions = useMemo(
    () => [
      { label: 'Sales Voucher', icon: ReceiptIcon, to: '/vouchers/sales/new' },
      { label: 'Purchase Voucher', icon: ShoppingCartIcon, to: '/vouchers/purchase/new' },
      { label: 'Record Payment', icon: PaymentIcon, to: '/vouchers/payment-vouchers/new' },
      { label: 'Add Customer', icon: PeopleIcon, to: '/parties/new' },
      { label: 'Add Inventory', icon: Inventory2Icon, to: '/masters/inventory-items/new' },
    ],
    []
  );

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
    <Box
      sx={{
        p: { xs: 1.25, sm: 2.5 },
        pb: 4,
        background:
          theme.palette.mode === 'dark'
            ? `linear-gradient(130deg, ${alpha(theme.palette.primary.dark, 0.34)} 0%, ${alpha(theme.palette.background.default, 0.98)} 36%)`
            : `linear-gradient(130deg, ${alpha(theme.palette.primary.light, 0.2)} 0%, var(--bg-main) 38%)`,
        borderRadius: 3,
        transition: 'background-color 0.2s ease',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.25, sm: 2 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: alpha(theme.palette.divider, 0.8),
          bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.92 : 0.96),
          boxShadow: theme.palette.mode === 'dark' ? 'var(--panel-shadow-dark)' : 'var(--panel-shadow)',
          transition: 'background-color 0.2s ease',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" gap={1.25} sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>
            Dashboard · Quick Actions and Live Business Snapshot
          </Typography>
          <Stack direction="row" gap={1} alignItems="center" justifyContent="flex-end">
            <Tooltip title={`Switch to ${uiMode === 'premium-dark' ? 'Light' : 'Dark'} mode`}>
              <IconButton
                size="small"
                onClick={toggleUiMode}
                sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12) }}
              >
                {uiMode === 'premium-dark' ? (
                  <LightModeRoundedIcon fontSize="small" />
                ) : (
                  <DarkModeRoundedIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <Chip
              size="small"
              label={uiMode === 'premium-dark' ? 'Dark' : 'Light'}
              variant="outlined"
              sx={{ height: 28 }}
            />
            <IconButton size="small" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12) }}>
              <NotificationsNoneRoundedIcon fontSize="small" />
            </IconButton>
            <Button size="small" variant="outlined" onClick={refreshCore}>
              Refresh
            </Button>
          </Stack>
        </Stack>

      {/* Quick actions — single compact row */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1, letterSpacing: '0.06em' }}>
          Quick actions
        </Typography>
        <Grid container spacing={1}>
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Grid item xs={6} sm={4} md={2.4} key={a.to}>
                <Button
                  fullWidth
                  onClick={() => navigate(a.to)}
                  sx={{
                    py: 1.25,
                    px: 1,
                    minHeight: 72,
                    flexDirection: 'column',
                    gap: 0.75,
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: 'var(--border)',
                    bgcolor: 'var(--qa-bg)',
                    color: 'var(--text-primary)',
                    textTransform: 'none',
                    '&:hover': {
                      borderColor: 'var(--border)',
                      bgcolor: 'var(--qa-hover-bg)',
                      boxShadow: '0 4px 12px rgba(27,79,138,0.1)',
                      transform: 'scale(1.04)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      bgcolor: 'var(--qa-icon-bg)',
                      color: 'var(--qa-icon)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon sx={{ fontSize: 20 }} />
                  </Box>
                  <Typography variant="caption" fontWeight={700} textAlign="center" lineHeight={1.2}>
                    {a.label}
                  </Typography>
                </Button>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} flexWrap="wrap">
          <Typography variant="subtitle2" fontWeight={700} sx={{ alignSelf: { sm: 'center' }, pt: { sm: 0.5 } }}>
            Financial Year
          </Typography>
          {fyWithData.length > 0 ? (
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 280 }, maxWidth: 420 }}>
              <Select
                aria-label="Financial year with data"
                value={fyStartYear}
                onChange={(e) => setFyStartYear(Number(e.target.value))}
                renderValue={(v) => formatIndianFYRangeShort(Number(v))}
              >
                {fyWithData.map((y) => (
                  <MenuItem key={y} value={y}>
                    {formatIndianFYRangeShort(y)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Paper
              variant="outlined"
              sx={{
                px: 2,
                py: 1,
                borderRadius: 1,
                bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === 'dark' ? 0.06 : 0.04),
              }}
            >
              <Typography variant="body2" fontWeight={600}>
                {formatIndianFYRangeShort(fyStartYear)}
              </Typography>
            </Paper>
          )}
        </Stack>
      </Paper>

      {/* Overview: sales/purchase/P-L for selected FY; outstanding/payable/cash from ledgers */}
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1, letterSpacing: '0.06em' }}>
        Overview
      </Typography>
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {[
          {
            key: 'sales',
            label: `Sales (${labelIndianFY(fyStartYear)})`,
            value: overview?.totalSales || 0,
            sub: `${overview?.salesCount ?? 0} vouchers`,
            icon: ReceiptIcon,
            colors: ['var(--metric-sales-start)', 'var(--metric-sales-end)'],
            to: '/vouchers/sales',
          },
          {
            key: 'purchase',
            label: `Purchase (${labelIndianFY(fyStartYear)})`,
            value: overview?.totalPurchase || 0,
            sub: `${overview?.purchaseCount ?? 0} vouchers`,
            icon: ShoppingCartIcon,
            colors: ['var(--metric-purchase-start)', 'var(--metric-purchase-end)'],
            to: '/purchase-invoices',
          },
          {
            key: 'outstanding',
            label: 'Outstanding (receivable)',
            value: overview?.totalOutstanding || 0,
            sub: `${overview?.outstandingCount ?? 0} parties`,
            icon: WarningAmberIcon,
            colors: ['var(--metric-outstanding-start)', 'var(--metric-outstanding-end)'],
            to: '/reports?tab=party',
          },
          {
            key: 'payable',
            label: 'Payable to suppliers',
            value: overview?.totalPayable || 0,
            sub: `${overview?.payableCount ?? 0} suppliers`,
            icon: PaymentIcon,
            colors: ['var(--metric-payable-start)', 'var(--metric-payable-end)'],
            to: '/reports?tab=party',
          },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <Grid item xs={6} md={3} key={m.key}>
              <Card
                sx={{
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'var(--border)',
                  background: `linear-gradient(145deg, ${m.colors[0]} 0%, ${m.colors[1]} 100%)`,
                  color: 'var(--metric-text)',
                  backdropFilter: 'blur(10px)',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 'var(--stat-shadow-hover)',
                  },
                  transition: 'background-color 0.2s ease',
                  boxShadow: theme.palette.mode === 'light' ? 'var(--metric-card-shadow-light)' : 'var(--stat-shadow-dark)',
                }}
                onClick={() => navigate(m.to)}
              >
                <CardContent sx={{ py: 1.7, '&:last-child': { pb: 1.7 } }}>
                  <Typography variant="caption" sx={{ color: 'var(--metric-text-muted)', fontWeight: 600 }}>
                    {m.label}
                  </Typography>
                  <Typography variant="h6" fontWeight={900} sx={{ color: 'var(--metric-text)' }}>
                    {overviewBusy ? <CircularProgress size={20} sx={{ color: 'var(--metric-text)' }} /> : formatCurrency(m.value)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--metric-text-subtle)' }}>
                    {m.sub}
                  </Typography>
                  <Box
                    sx={{
                      position: 'absolute',
                      right: -14,
                      bottom: -12,
                      width: 78,
                      height: 78,
                      borderRadius: '50%',
                      bgcolor: 'var(--metric-overlay)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon sx={{ fontSize: 34, color: 'var(--metric-overlay-icon)' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {isAdmin && overview && !overviewBusy && (
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
          <Chip
            size="small"
            label={`Cash ${formatCurrency(overview.cashInHand || 0)}`}
            onClick={() => navigate('/accounts?tab=bank')}
            sx={{ bgcolor: 'var(--chip-bg)', color: 'var(--chip-text)' }}
          />
          <Chip
            size="small"
            label={`Bank ${formatCurrency(overview.bankBalance || 0)}`}
            onClick={() => navigate('/accounts')}
            sx={{ bgcolor: 'var(--chip-bg)', color: 'var(--chip-text)' }}
          />
          <Chip
            size="small"
            title={`Pre-GST margin for ${labelIndianFY(fyStartYear)}: item sales (ex-GST lines) minus purchase subtotals (ex-GST).`}
            sx={{
              bgcolor: overview.profitLoss >= 0 ? 'var(--chip-positive-bg)' : 'var(--chip-negative-bg)',
              color: overview.profitLoss >= 0 ? 'var(--chip-positive-text)' : 'var(--chip-negative-text)',
            }}
            label={`P/L (ex-GST) ${formatCurrency(Math.abs(overview.profitLoss || 0))}`}
            onClick={() => navigate('/reports')}
          />
          <Chip
            size="small"
            label={`Overdue ${formatCurrency(overview.overdueAmount || 0)}`}
            onClick={() => navigate('/reports')}
            sx={{ bgcolor: 'var(--chip-bg)', color: 'var(--chip-text)' }}
          />
        </Stack>
      )}

      {/* Low stock — compact */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 2,
          border: '1px solid',
          borderColor: lowStock.length ? 'var(--alert-border)' : 'divider',
          bgcolor: lowStock.length ? 'var(--alert-bg)' : alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.06 : 0.04),
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: lowStockPreview.length ? 1 : 0 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <WarningAmberIcon sx={{ color: 'var(--alert-icon)' }} fontSize="small" />
            <Typography variant="subtitle2" fontWeight={700}>
              Low stock
            </Typography>
            <Chip size="small" label={`${lowStock.length} item(s)`} color={lowStock.length ? 'warning' : 'default'} />
          </Stack>
          <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/masters/inventory-items')}>
            View all
          </Button>
        </Stack>
        {lowStockPreview.length > 0 ? (
          <Stack spacing={0.5}>
            {lowStockPreview.map((item) => (
              <Typography key={item.id} variant="caption" sx={{ color: 'var(--alert-text)' }}>
                <strong>{item.name}</strong> — stock {item.currentStock} / reorder {item.reorderLevel}
              </Typography>
            ))}
          </Stack>
        ) : (
          <Typography variant="caption" sx={{ color: 'var(--alert-text)' }}>
            No items below reorder level.
          </Typography>
        )}
      </Paper>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1, pt: 1 }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setMainTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 40,
            '& .MuiTab-root': { minHeight: 40, py: 0.5, textTransform: 'none', fontWeight: 600 },
          }}
        >
          <Tab icon={<ReceiptIcon fontSize="small" />} iconPosition="start" label="GST" />
          <Tab icon={<BarChartIcon fontSize="small" />} iconPosition="start" label="Sales trend" />
          <Tab icon={<PeopleIcon fontSize="small" />} iconPosition="start" label="Customers" />
          <Tab icon={<StorefrontIcon fontSize="small" />} iconPosition="start" label="Suppliers" />
          <Tab icon={<SwapHorizIcon fontSize="small" />} iconPosition="start" label="Transactions" />
        </Tabs>

        <TabPanel value={tabValue} id={0}>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>GST period</InputLabel>
              <Select
                label="GST period"
                value={gstPeriod}
                onChange={(e) => {
                  const p = e.target.value as typeof gstPeriod;
                  dispatch(setGstPeriod(p));
                  dispatch(fetchGstSnapshot(p));
                }}
              >
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">This week</MenuItem>
                <MenuItem value="month">This month</MenuItem>
                <MenuItem value="year">This year</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Paper sx={(t) => ({ p: 2, bgcolor: alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.12 : 0.06) })}>
                <Typography variant="body2" color="text.secondary">
                  Output GST (sales)
                </Typography>
                <Typography variant="h6">{formatCurrency(gstData.outputGst)}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Paper sx={(t) => ({ p: 2, bgcolor: alpha(t.palette.info.main, t.palette.mode === 'dark' ? 0.12 : 0.06) })}>
                <Typography variant="body2" color="text.secondary">
                  Input ITC (purchase)
                </Typography>
                <Typography variant="h6">{formatCurrency(gstData.inputItc)}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Paper sx={(t) => ({ p: 2, bgcolor: alpha(t.palette.success.main, t.palette.mode === 'dark' ? 0.14 : 0.08) })}>
                <Typography variant="body2" color="text.secondary">
                  GST receivable
                </Typography>
                <Typography variant="h6">{formatCurrency(gstData.receivable)}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Paper sx={(t) => ({ p: 2, bgcolor: alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.14 : 0.08) })}>
                <Typography variant="body2" color="text.secondary">
                  GST payable
                </Typography>
                <Typography variant="h6">{formatCurrency(gstData.payable)}</Typography>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} id={1}>
          <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Period</InputLabel>
              <Select
                value={analyticsPeriod}
                label="Period"
                onChange={(e) => setAnalyticsPeriod(e.target.value as typeof analyticsPeriod)}
              >
                <MenuItem value="week">Week</MenuItem>
                <MenuItem value="month">Month</MenuItem>
                <MenuItem value="year">Year</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Group by</InputLabel>
              <Select
                value={analyticsGroupBy}
                label="Group by"
                onChange={(e) => setAnalyticsGroupBy(e.target.value as typeof analyticsGroupBy)}
              >
                <MenuItem value="day">Day</MenuItem>
                <MenuItem value="week">Week</MenuItem>
                <MenuItem value="month">Month</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Sales &amp; tax
                </Typography>
                {loading && !salesAnalytics ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                  </Box>
                ) : salesTrendPoints.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Sales trend graph dikhane ke liye selected period me sales vouchers chahiye.
                    </Typography>
                    <Button size="small" variant="outlined" onClick={() => navigate('/vouchers/sales/new')}>
                      Create Sales Voucher
                    </Button>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={salesTrendPoints}>
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.6)} />
                      <XAxis dataKey="date" stroke={theme.palette.text.secondary} fontSize={12} />
                      <YAxis stroke={theme.palette.text.secondary} fontSize={12} />
                      <RechartsTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="sales" stroke={theme.palette.primary.main} name="Sales" strokeWidth={2} />
                      <Line type="monotone" dataKey="tax" stroke={theme.palette.success.main} name="Tax" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Top products
                </Typography>
                {salesAnalytics?.topProducts && salesAnalytics.topProducts.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={salesAnalytics.topProducts.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.6)} />
                      <XAxis dataKey="productName" angle={-35} textAnchor="end" height={70} interval={0} fontSize={10} />
                      <YAxis fontSize={11} />
                      <RechartsTooltip />
                      <Bar dataKey="amount" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                    No data
                  </Typography>
                )}
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} id={2}>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Top outstanding customers
              </Typography>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/parties')}>
                Parties
              </Button>
            </Stack>
            {outstandingSummary && outstandingSummary.customers.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer</TableCell>
                      <TableCell align="right">Outstanding</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {outstandingSummary.customers.slice(0, 12).map((customer) => (
                      <TableRow key={customer.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/parties')}>
                        <TableCell>{customer.name}</TableCell>
                        <TableCell align="right">{formatCurrency(customer.currentBalance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                No outstanding amounts
              </Typography>
            )}
          </Paper>
        </TabPanel>

        <TabPanel value={tabValue} id={3}>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Top payable suppliers
              </Typography>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/parties')}>
                Parties
              </Button>
            </Stack>
            {payableSummary && payableSummary.suppliers.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Supplier</TableCell>
                      <TableCell align="right">Payable</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payableSummary.suppliers.slice(0, 12).map((supplier) => (
                      <TableRow key={supplier.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/parties')}>
                        <TableCell>{supplier.name}</TableCell>
                        <TableCell align="right">{formatCurrency(supplier.currentBalance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                No payable amounts
              </Typography>
            )}
          </Paper>
        </TabPanel>

        <TabPanel value={tabValue} id={4}>
          <Tabs value={txnSubTab} onChange={(_, v) => setTxnSubTab(v)} sx={{ mb: 2, minHeight: 36 }}>
            <Tab label="Invoices" sx={{ minHeight: 36, py: 0 }} />
            <Tab label="Payments" sx={{ minHeight: 36, py: 0 }} />
            <Tab label="Credit notes" sx={{ minHeight: 36, py: 0 }} />
            <Tab label="Debit notes" sx={{ minHeight: 36, py: 0 }} />
          </Tabs>

          {txnSubTab === 0 && (
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Recent invoices
                </Typography>
                <Button size="small" onClick={() => navigate('/vouchers/sales')}>
                  View all
                </Button>
              </Stack>
              {recentTransactions && recentTransactions.invoices.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>No.</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentTransactions.invoices.map((invoice) => (
                        <TableRow key={invoice.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/vouchers/sales')}>
                          <TableCell>
                            <Tooltip title={invoice.type}>
                              <Chip label={invoice.invoiceNumber} size="small" />
                            </Tooltip>
                          </TableCell>
                          <TableCell>{formatDate(invoice.date)}</TableCell>
                          <TableCell align="right">{formatCurrency(invoice.grandTotal)}</TableCell>
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
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                  No recent invoices
                </Typography>
              )}
            </Paper>
          )}

          {txnSubTab === 1 && (
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Recent payments
                </Typography>
                <Button size="small" onClick={() => navigate('/payments')}>
                  View all
                </Button>
              </Stack>
              {recentTransactions && recentTransactions.payments.length > 0 ? (
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
                        <TableRow key={payment.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/payments')}>
                          <TableCell>
                            <Chip label={payment.type} size="small" color={payment.type === 'RECEIPT' ? 'success' : 'error'} />
                          </TableCell>
                          <TableCell>{formatDate(payment.date)}</TableCell>
                          <TableCell>{payment.paymentMode}</TableCell>
                          <TableCell align="right">{formatCurrency(payment.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                  No recent payments
                </Typography>
              )}
            </Paper>
          )}

          {txnSubTab === 2 && (
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Recent credit notes
                </Typography>
                <Button size="small" onClick={() => navigate('/credit-notes')}>
                  View all
                </Button>
              </Stack>
              {recentTransactions?.creditNotes?.length ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>No.</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Customer</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentTransactions.creditNotes.map((cn) => (
                        <TableRow key={cn.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/credit-notes')}>
                          <TableCell>
                            <Chip label={cn.number} size="small" />
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
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                  No recent credit notes
                </Typography>
              )}
            </Paper>
          )}

          {txnSubTab === 3 && (
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Recent debit notes
                </Typography>
                <Button size="small" onClick={() => navigate('/debit-notes')}>
                  View all
                </Button>
              </Stack>
              {recentTransactions?.debitNotes?.length ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>No.</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Supplier</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentTransactions.debitNotes.map((dn) => (
                        <TableRow key={dn.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/debit-notes')}>
                          <TableCell>
                            <Chip label={dn.number} size="small" />
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
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                  No recent debit notes
                </Typography>
              )}
            </Paper>
          )}
        </TabPanel>
      </Paper>
      </Paper>
    </Box>
  );
}
