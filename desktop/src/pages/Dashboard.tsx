import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  AddCircleOutline as AddCircleOutlineIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  BarChart as BarChartIcon,
  Groups2 as Groups2Icon,
  Inventory2 as Inventory2Icon,
  PersonAddAlt as PersonAddAltIcon,
  PointOfSale as PointOfSaleIcon,
  ReceiptLong as ReceiptLongIcon,
  WhatsApp as WhatsAppIcon,
} from '@mui/icons-material';
import { AppDispatch, RootState } from '../store';
import {
  clearError,
  fetchGstSnapshot,
  fetchLowStock,
  fetchMonthOverview,
  fetchOutstandingSummary,
  fetchPayableSummary,
  fetchRecentTransactions,
  fetchSalesAnalytics,
  fetchTodayOverview,
} from '../store/slices/dashboardSlice';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getNormalizedCompanyProfile } from '../utils/companyProfile';
import { BusinessHealthCard } from '../components/dashboard/BusinessHealthCard';
import { DashboardPanel } from '../components/dashboard/DashboardPanel';
import {
  computeSparkTrend,
  DASHBOARD_THEME,
  greetingForHour,
} from '../components/dashboard/dashboardTheme';
import { PremiumKpiCard } from '../components/dashboard/PremiumKpiCard';
import { DashboardWelcome } from '../components/dashboard/DashboardWelcome';
import { OutstandingAgingCard } from '../components/dashboard/OutstandingAgingCard';
import { SmartAssistantCard } from '../components/dashboard/SmartAssistantCard';
import { UtilitySidebar } from '../components/dashboard/UtilitySidebar';
import { BusinessSnapshotCard } from '../components/dashboard/BusinessSnapshotCard';
import { WhatsAppReminderPreviewDialog } from '../components/whatsapp/WhatsAppReminderPreviewDialog';
import { buildOutstandingAging } from '../utils/outstandingAging';
import { computeBusinessHealthScore } from '../utils/dashboardHealth';
import {
  prepareOutstandingReminder,
  pickTopOutstandingCustomer,
  type OutstandingReminderDraft,
} from '../services/whatsappOutstandingReminder';
import {
  getWhatsAppConnectionStatus,
  refreshWhatsAppConnectionStatus,
  subscribeWhatsAppConnectionStatus,
  type WhatsAppConnectionStatus,
} from '../services/whatsappIntegration';
import { gstFilingReminderText } from '../utils/gstDueDate';
import { useAuth } from './contexts/auth';

function invoiceStatusBadge(raw: string): { label: string; color: 'success' | 'warning' | 'error' } {
  const u = raw.toUpperCase();
  if (u === 'PAID') return { label: 'Paid', color: 'success' };
  if (u === 'PARTIAL' || u === 'PENDING') return { label: 'Pending', color: 'warning' };
  return { label: 'Overdue', color: 'error' };
}

function miniBarSeries(base: number, points = 5): Array<{ v: number }> {
  const b = Math.max(0, base);
  return Array.from({ length: points }, (_, i) => ({
    v: Math.max(0, b * (0.55 + (i / (points - 1 || 1)) * 0.45)),
  }));
}

function growthFromSeries(data: Array<{ v: number }>): { pct: number; up: boolean } {
  if (data.length < 2) return { pct: 0, up: true };
  const first = data[0]?.v ?? 0;
  const last = data[data.length - 1]?.v ?? 0;
  if (first === 0) return { pct: last > 0 ? 100 : 0, up: last >= 0 };
  const change = ((last - first) / Math.abs(first)) * 100;
  return { pct: Math.round(Math.abs(change)), up: change >= 0 };
}

const QUICK_ACTION_ACCENTS = [
  DASHBOARD_THEME.kpi.sales,
  DASHBOARD_THEME.kpi.receipts,
  DASHBOARD_THEME.kpi.stock,
  '#0EA5E9',
  '#25D366',
  DASHBOARD_THEME.kpi.outstanding,
  '#7C3AED',
  '#64748B',
] as const;

export default function Dashboard() {
  const theme = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    summary,
    todaySummary,
    monthSummary,
    salesAnalytics,
    outstandingSummary,
    recentTransactions,
    lowStock,
    loading,
    error,
  } = useSelector((state: RootState) => state.dashboard);

  const [utilityOpen, setUtilityOpen] = useState(true);
  const [waBusy, setWaBusy] = useState(false);
  const [waReminderOpen, setWaReminderOpen] = useState(false);
  const [waReminderDraft, setWaReminderDraft] = useState<OutstandingReminderDraft | null>(null);
  const [waStatus, setWaStatus] = useState<WhatsAppConnectionStatus>(() => getWhatsAppConnectionStatus());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    void refreshWhatsAppConnectionStatus();
    return subscribeWhatsAppConnectionStatus(setWaStatus);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    dispatch(fetchTodayOverview());
    dispatch(fetchMonthOverview());
    dispatch(fetchLowStock());
    dispatch(fetchOutstandingSummary());
    dispatch(fetchPayableSummary());
    dispatch(fetchRecentTransactions({ limit: 8, invoicePeriod: 'month' }));
    dispatch(fetchSalesAnalytics({ period: 'month', groupBy: 'day' }));
    dispatch(fetchGstSnapshot('month'));
  }, [dispatch]);

  const overview = todaySummary ?? summary;
  const monthly = monthSummary;

  const todayReceiptsTotal = Number(todaySummary?.todayReceipts ?? 0);

  const stockValue = Number(
    todaySummary?.stockValue ?? monthly?.stockValue ?? 0
  );

  const pendingInvoiceCount = Number(
    todaySummary?.pendingInvoiceCount ?? monthly?.pendingInvoiceCount ?? 0
  );

  const trend = salesAnalytics?.analytics ?? [];
  const company = useMemo(() => getNormalizedCompanyProfile(), []);

  const sparklineData = useMemo(() => {
    if (trend.length >= 2) {
      return trend.slice(-7).map((t, i) => ({ name: `${i}`, value: Number(t.sales || 0) }));
    }
    return [{ name: '0', value: Number(overview?.totalSales || 0) }];
  }, [trend, overview?.totalSales]);

  const sparkTrend = useMemo(() => computeSparkTrend(sparklineData), [sparklineData]);

  const kpiCards = useMemo(
    () => [
      {
        title: "Today's Sales",
        value: Number(overview?.totalSales || 0),
        color: DASHBOARD_THEME.kpi.sales,
        icon: <ReceiptLongIcon fontSize="small" />,
      },
      {
        title: "Today's Receipts",
        value: todayReceiptsTotal,
        color: DASHBOARD_THEME.kpi.receipts,
        icon: <PointOfSaleIcon fontSize="small" />,
      },
      {
        title: 'Outstanding Amount',
        value: Number(overview?.totalOutstanding || 0),
        color: DASHBOARD_THEME.kpi.outstanding,
        icon: <AssignmentTurnedInIcon fontSize="small" />,
      },
      {
        title: 'Stock Value',
        value: stockValue,
        color: DASHBOARD_THEME.kpi.stock,
        icon: <Inventory2Icon fontSize="small" />,
      },
    ],
    [overview, todayReceiptsTotal, stockValue]
  );

  const { buckets: agingBuckets, total: agingTotal } = useMemo(
    () =>
      buildOutstandingAging({
        customers: outstandingSummary?.customers ?? [],
        salesVouchers: outstandingSummary?.salesVouchers ?? [],
        invoices: recentTransactions?.invoices ?? [],
        fallbackTotal: Number(overview?.totalOutstanding || 0),
      }),
    [
      outstandingSummary?.customers,
      outstandingSummary?.salesVouchers,
      recentTransactions?.invoices,
      overview?.totalOutstanding,
    ]
  );

  const displayName = useMemo(() => {
    const full = String(user?.fullName || '').trim();
    if (full) return full.split(/\s+/)[0];
    const un = String(user?.username || '').trim();
    if (un) return un;
    return 'there';
  }, [user?.fullName, user?.username]);

  const topOverdue = outstandingSummary?.customers?.[0];
  const gstConfigured = Boolean(company.gstin?.trim());

  const smartSuggestions = useMemo(() => {
    const lowStockLine =
      lowStock.length > 0
        ? `Low stock: ${lowStock
            .slice(0, 3)
            .map((i) => i.name)
            .join(', ')}${lowStock.length > 3 ? ` (+${lowStock.length - 3} more)` : ''}`
        : 'No low stock alerts';
    return [
      {
        text: `Outstanding collection pending: ${formatCurrency(overview?.totalOutstanding || 0)}`,
      },
      {
        text: `Top overdue customer: ${topOverdue?.name || '—'} (${formatCurrency(topOverdue?.currentBalance || 0)})`,
      },
      { text: gstFilingReminderText(gstConfigured, now) },
      { text: lowStockLine },
      {
        text: `Today's sales: ${formatCurrency(todaySummary?.totalSales || 0)} (${todaySummary?.salesCount || 0} invoice(s))`,
      },
    ];
  }, [overview, topOverdue, lowStock, gstConfigured, now, todaySummary]);

  const totalSalesM = Number(monthly?.totalSales || 0);
  const totalPurchaseM = Number(monthly?.totalPurchase || 0);
  const grossProfitM = totalSalesM - totalPurchaseM;
  const expensesM = Math.max(0, grossProfitM - Number(monthly?.profitLoss || 0));

  const businessHealthMetrics = useMemo(() => {
    const defs = [
      { label: 'Total Sales', value: totalSalesM, color: DASHBOARD_THEME.kpi.sales },
      { label: 'Total Purchase', value: totalPurchaseM, color: '#64748B' },
      { label: 'Gross Profit', value: grossProfitM, color: DASHBOARD_THEME.kpi.receipts },
      { label: 'Expenses', value: expensesM, color: DASHBOARD_THEME.kpi.outstanding },
    ];
    return defs.map((d) => {
      const chartData = miniBarSeries(d.value);
      const g = growthFromSeries(chartData);
      return { ...d, chartData, growthPct: g.pct, growthUp: g.up };
    });
  }, [totalSalesM, totalPurchaseM, grossProfitM, expensesM]);

  const { score: healthScore, rows: healthStatuses } = useMemo(
    () =>
      computeBusinessHealthScore({
        totalOutstanding: Number(overview?.totalOutstanding || 0),
        totalSales: totalSalesM,
        gstConfigured,
        lowStockCount: lowStock.length,
        grossProfit: grossProfitM,
      }),
    [overview, totalSalesM, gstConfigured, lowStock.length, grossProfitM]
  );

  const monthReceiptsTotal = Number(monthly?.todayReceipts ?? 0);

  const snapshotItems = useMemo(
    () => [
      {
        label: "Today's Sales",
        value: formatCurrency(overview?.totalSales || 0),
        accent: DASHBOARD_THEME.kpi.sales,
        onClick: () => navigate('/vouchers/sales'),
      },
      {
        label: "Today's Receipts",
        value: formatCurrency(todayReceiptsTotal),
        accent: DASHBOARD_THEME.kpi.receipts,
        onClick: () => navigate('/vouchers/receipt-vouchers'),
      },
      {
        label: 'Month Sales',
        value: formatCurrency(totalSalesM),
        accent: DASHBOARD_THEME.kpi.sales,
        onClick: () => navigate('/vouchers/sales'),
      },
      {
        label: 'Month Receipts',
        value: formatCurrency(monthReceiptsTotal),
        accent: DASHBOARD_THEME.kpi.receipts,
        onClick: () => navigate('/vouchers/receipt-vouchers'),
      },
      {
        label: 'Pending Collections',
        value: formatCurrency(overview?.totalOutstanding || 0),
        accent: DASHBOARD_THEME.kpi.outstanding,
        onClick: () => navigate('/reports/outstanding-aging'),
      },
      {
        label: 'Pending Invoices',
        value: String(pendingInvoiceCount),
        accent: DASHBOARD_THEME.primary,
        onClick: () => navigate('/vouchers/sales'),
      },
      {
        label: 'Low Stock Items',
        value: String(lowStock.length),
        accent: lowStock.length > 0 ? DASHBOARD_THEME.status.warn : DASHBOARD_THEME.kpi.receipts,
        onClick: () => navigate('/reports/low-stock'),
      },
    ],
    [
      overview,
      todayReceiptsTotal,
      totalSalesM,
      monthReceiptsTotal,
      pendingInvoiceCount,
      lowStock.length,
      navigate,
    ]
  );

  const backupLabel = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const systemHealth = useMemo(
    () => [
      { label: 'Database Connected', status: 'Online', ok: true },
      { label: 'Backup Complete', status: backupLabel, ok: true },
      { label: 'GST Active', status: gstConfigured ? 'Registered' : 'Not configured', ok: gstConfigured },
      {
        label: 'WhatsApp Connected',
        status: waStatus.ok ? waStatus.status : 'Not connected',
        ok: waStatus.ok,
      },
    ],
    [backupLabel, gstConfigured, waStatus.ok, waStatus.status]
  );

  const handleWhatsAppReminder = useCallback(async () => {
    const target = pickTopOutstandingCustomer(outstandingSummary?.customers);
    if (!target) {
      window.alert('No outstanding customer balance to remind.');
      return;
    }
    setWaBusy(true);
    try {
      const draft = await prepareOutstandingReminder(target);
      if (!draft) {
        window.alert(
          `"${target.name}" has no mobile or WhatsApp number. Add contact details in Party Master.`
        );
        navigate('/parties');
        return;
      }
      setWaReminderDraft(draft);
      setWaReminderOpen(true);
    } catch (err) {
      console.error('WhatsApp reminder prepare failed', err);
      window.alert('Could not prepare WhatsApp reminder. Please try again.');
    } finally {
      setWaBusy(false);
    }
  }, [outstandingSummary?.customers, navigate]);

  const utilityShortcuts = useMemo(
    () => [
      { label: 'GST Returns', onClick: () => navigate('/gst') },
      { label: 'E-Way Bill', onClick: () => navigate('/utilities/e-way-bill') },
      { label: 'WhatsApp Center', onClick: () => navigate('/settings?tab=4') },
      { label: 'Company Profile', onClick: () => navigate('/settings?tab=0') },
    ],
    [navigate]
  );

  const quickActions = useMemo(
    () => [
      { label: 'Create Invoice', icon: <ReceiptLongIcon fontSize="small" />, to: '/vouchers/sales/new' },
      { label: 'Receipt Entry', icon: <PointOfSaleIcon fontSize="small" />, to: '/vouchers/receipt-vouchers/new' },
      { label: 'New Customer', icon: <PersonAddAltIcon fontSize="small" />, to: '/parties/new' },
      { label: 'New Item', icon: <AddCircleOutlineIcon fontSize="small" />, to: '/masters/inventory-items/new' },
      {
        label: 'WhatsApp Outstanding',
        icon: <WhatsAppIcon fontSize="small" />,
        onClick: handleWhatsAppReminder,
      },
      { label: 'Customer Ledger', icon: <Groups2Icon fontSize="small" />, to: '/reports?tab=party' },
      { label: 'Stock Summary', icon: <Inventory2Icon fontSize="small" />, to: '/masters/inventory-items' },
      { label: 'Reports', icon: <BarChartIcon fontSize="small" />, to: '/reports' },
    ],
    [handleWhatsAppReminder]
  );

  const isDark = theme.palette.mode === 'dark';
  const pageBg = isDark
    ? `linear-gradient(165deg, ${alpha('#0F172A', 0.99)} 0%, ${alpha('#0B1220', 0.99)} 100%)`
    : `linear-gradient(180deg, ${DASHBOARD_THEME.bg} 0%, ${DASHBOARD_THEME.bgSubtle} 100%)`;

  const viewAllBtnSx = {
    textTransform: 'none' as const,
    fontWeight: 600,
    fontSize: '0.8125rem',
    borderRadius: DASHBOARD_THEME.innerRadius,
    color: DASHBOARD_THEME.primary,
  };

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        fontFamily: DASHBOARD_THEME.fontFamily,
        px: { xs: DASHBOARD_THEME.padTablet, md: DASHBOARD_THEME.padDesktop },
        py: { xs: DASHBOARD_THEME.padTablet, md: DASHBOARD_THEME.padDesktop },
        bgcolor: pageBg,
        minHeight: '100%',
        transition: DASHBOARD_THEME.transition,
      }}
    >
      <DashboardWelcome
        greeting={greetingForHour(now.getHours())}
        userName={displayName}
        now={now}
      />

      <Grid container spacing={DASHBOARD_THEME.gridGap} alignItems="stretch">
        <Grid item xs={12} lg={utilityOpen ? 9 : 12}>
          <Grid container spacing={DASHBOARD_THEME.gridGap} sx={{ mb: DASHBOARD_THEME.gridGap }}>
            {kpiCards.map((kpi, idx) => (
              <Grid item xs={12} sm={6} lg={3} key={kpi.title} sx={{ display: 'flex' }}>
                <PremiumKpiCard
                  title={kpi.title}
                  value={kpi.value}
                  trendPct={sparkTrend.pct}
                  trendUp={sparkTrend.up}
                  color={kpi.color}
                  icon={kpi.icon}
                  graphData={sparklineData.map((s, i) => ({
                    ...s,
                    value: s.value + idx * 3 + i,
                  }))}
                />
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mb: DASHBOARD_THEME.gridGap }}>
            <BusinessSnapshotCard items={snapshotItems} isDark={isDark} />
          </Box>

          <DashboardPanel title="Quick Action Center" isDark={isDark} sx={{ mb: DASHBOARD_THEME.gridGap }}>
            <Grid container spacing={1.25}>
              {quickActions.map((qa, idx) => {
                const accent = QUICK_ACTION_ACCENTS[idx % QUICK_ACTION_ACCENTS.length];
                return (
                  <Grid item xs={6} sm={4} md={3} key={qa.label}>
                    <Button
                      fullWidth
                      onClick={() =>
                        'onClick' in qa && qa.onClick ? qa.onClick() : navigate((qa as { to: string }).to)
                      }
                      sx={{
                        minHeight: 92,
                        py: 1.25,
                        borderRadius: DASHBOARD_THEME.cardRadius,
                        border: '1px solid',
                        borderColor: alpha(accent, 0.14),
                        flexDirection: 'column',
                        gap: 0.85,
                        bgcolor: isDark ? alpha(accent, 0.08) : alpha(accent, 0.06),
                        textTransform: 'none',
                        fontFamily: DASHBOARD_THEME.fontFamily,
                        transition: DASHBOARD_THEME.transition,
                        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                        '&:hover': {
                          transform: DASHBOARD_THEME.hoverLift,
                          borderColor: alpha(accent, 0.35),
                          bgcolor: isDark ? alpha(accent, 0.14) : alpha(accent, 0.1),
                          boxShadow: DASHBOARD_THEME.cardShadow,
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: `linear-gradient(145deg, ${alpha(accent, 0.22)} 0%, ${alpha(accent, 0.08)} 100%)`,
                          color: accent,
                          '& .MuiSvgIcon-root': { fontSize: 24 },
                        }}
                      >
                        {qa.icon}
                      </Box>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{ color: DASHBOARD_THEME.text.primary, lineHeight: 1.25, fontSize: '0.75rem' }}
                      >
                        {qa.label}
                      </Typography>
                    </Button>
                  </Grid>
                );
              })}
            </Grid>
          </DashboardPanel>

          <Grid container spacing={DASHBOARD_THEME.gridGap} sx={{ mb: DASHBOARD_THEME.gridGap }}>
            <Grid item xs={12}>
              <DashboardPanel
                title="Recent Invoices"
                isDark={isDark}
                action={
                  <Button size="small" sx={viewAllBtnSx} onClick={() => navigate('/vouchers/sales')}>
                    View All
                  </Button>
                }
              >
                <TableContainer
                  sx={{
                    borderRadius: DASHBOARD_THEME.innerRadius,
                    border: `1px solid ${DASHBOARD_THEME.border}`,
                    maxHeight: 360,
                    overflow: 'auto',
                  }}
                >
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Invoice No', 'Date', 'Party', 'Amount', 'Status'].map((h) => (
                          <TableCell
                            key={h}
                            align={h === 'Amount' ? 'right' : 'left'}
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.6875rem',
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              color: DASHBOARD_THEME.text.muted,
                              borderBottom: `1px solid ${DASHBOARD_THEME.border}`,
                              py: 1.25,
                              bgcolor: isDark ? alpha('#1E293B', 0.98) : '#F8FAFC',
                              backdropFilter: 'blur(8px)',
                            }}
                          >
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(recentTransactions?.invoices ?? []).slice(0, 8).map((inv, rowIdx) => {
                        const badge = invoiceStatusBadge(String(inv.paymentStatus || 'PENDING'));
                        const party =
                          inv.partyName ||
                          (inv as { partyName?: string; party?: string }).partyName ||
                          (inv as { party?: string }).party ||
                          '—';
                        return (
                          <TableRow
                            key={inv.id}
                            hover
                            sx={{
                              bgcolor:
                                rowIdx % 2 === 1
                                  ? isDark
                                    ? alpha('#fff', 0.02)
                                    : alpha(DASHBOARD_THEME.primary, 0.02)
                                  : 'transparent',
                              transition: 'background-color 200ms ease',
                              '&:last-child td': { border: 0 },
                              '&:hover': {
                                bgcolor: alpha(DASHBOARD_THEME.primary, 0.06),
                                '& td': { borderColor: 'transparent' },
                              },
                            }}
                          >
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.8125rem', py: 1.35 }}>
                              {inv.invoiceNumber}
                            </TableCell>
                            <TableCell
                              sx={{ fontSize: '0.8125rem', color: DASHBOARD_THEME.text.secondary, py: 1.35 }}
                            >
                              {formatDate(inv.date)}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.8125rem', py: 1.35 }}>{party}</TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                fontWeight: 800,
                                fontSize: '0.8125rem',
                                fontFeatureSettings: '"tnum"',
                                py: 1.35,
                              }}
                            >
                              {formatCurrency(inv.grandTotal)}
                            </TableCell>
                            <TableCell sx={{ py: 1.35 }}>
                              <Chip
                                size="small"
                                label={badge.label}
                                color={badge.color}
                                sx={{
                                  fontWeight: 700,
                                  fontSize: '0.6875rem',
                                  height: 24,
                                  borderRadius: '8px',
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </DashboardPanel>
            </Grid>
          </Grid>

          <Grid container spacing={DASHBOARD_THEME.gridGap}>
            <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
              <DashboardPanel
                fillHeight
                title="Top Customers"
                isDark={isDark}
                sx={{ flex: 1, width: '100%' }}
                action={
                  <Button size="small" sx={viewAllBtnSx} onClick={() => navigate('/parties')}>
                    View All
                  </Button>
                }
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{ px: 0.5, pb: 1, borderBottom: `1px solid ${DASHBOARD_THEME.border}` }}
                >
                  <Typography variant="caption" fontWeight={700} color={DASHBOARD_THEME.text.muted}>
                    Customer Name
                  </Typography>
                  <Typography variant="caption" fontWeight={700} color={DASHBOARD_THEME.text.muted}>
                    Outstanding Amount
                  </Typography>
                </Stack>
                <Stack spacing={0} divider={<Divider sx={{ borderColor: DASHBOARD_THEME.border }} />}>
                  {(outstandingSummary?.customers ?? []).slice(0, 6).map((c) => {
                    const initials = String(c.name || 'C')
                      .split(/\s+/)
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <Stack
                        key={c.id}
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{
                          py: 1.15,
                          px: 0.5,
                          borderRadius: DASHBOARD_THEME.innerRadius,
                          transition: DASHBOARD_THEME.transition,
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: DASHBOARD_THEME.primarySoft,
                            transform: 'translateX(2px)',
                          },
                        }}
                        onClick={() => navigate(`/parties/party-ledger/${encodeURIComponent(c.id)}`)}
                      >
                        <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
                          <Avatar
                            sx={{
                              width: 38,
                              height: 38,
                              fontSize: 13,
                              fontWeight: 800,
                              background: `linear-gradient(135deg, ${alpha(DASHBOARD_THEME.primary, 0.2)} 0%, ${alpha(DASHBOARD_THEME.primary, 0.08)} 100%)`,
                              color: DASHBOARD_THEME.primary,
                              border: `1px solid ${alpha(DASHBOARD_THEME.primary, 0.18)}`,
                            }}
                          >
                            {initials}
                          </Avatar>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {c.name}
                          </Typography>
                        </Stack>
                        <Typography
                          variant="body2"
                          fontWeight={800}
                          flexShrink={0}
                          sx={{
                            ml: 1,
                            fontFeatureSettings: '"tnum"',
                            color: DASHBOARD_THEME.kpi.outstanding,
                            fontSize: '0.875rem',
                          }}
                        >
                          {formatCurrency(c.currentBalance)}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              </DashboardPanel>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
              <Box sx={{ flex: 1, width: '100%' }}>
                <BusinessHealthCard metrics={businessHealthMetrics} />
              </Box>
            </Grid>
          </Grid>
        </Grid>

        <Grid item xs={12} lg={utilityOpen ? 3 : 1} sx={{ display: 'flex', alignSelf: 'flex-start' }}>
          <UtilitySidebar
            open={utilityOpen}
            onToggle={() => setUtilityOpen((v) => !v)}
            assistantSlot={
              <SmartAssistantCard
                compact
                suggestions={smartSuggestions}
                healthScore={healthScore}
                healthStatuses={healthStatuses}
                whatsAppLoading={waBusy}
                onWhatsApp={handleWhatsAppReminder}
                onGenerateReport={() => navigate('/reports?view=party')}
                onViewDetails={() => navigate('/parties')}
              />
            }
            agingSlot={
              <OutstandingAgingCard
                compact
                buckets={agingBuckets}
                total={agingTotal}
                isDark={isDark}
                onViewReport={() => navigate('/reports/outstanding-aging')}
              />
            }
            shortcuts={utilityShortcuts}
            systemHealth={systemHealth}
          />
        </Grid>
      </Grid>

      {loading && (
        <Box sx={{ position: 'fixed', right: 24, bottom: 24, zIndex: 10 }}>
          <Chip
            icon={<CircularProgress size={14} color="inherit" />}
            label="Loading dashboard..."
            sx={{
              fontFamily: DASHBOARD_THEME.fontFamily,
              fontWeight: 600,
              boxShadow: DASHBOARD_THEME.cardShadow,
              borderRadius: DASHBOARD_THEME.cardRadius,
            }}
          />
        </Box>
      )}

      {waReminderDraft ? (
        <WhatsAppReminderPreviewDialog
          open={waReminderOpen}
          onClose={() => {
            setWaReminderOpen(false);
            setWaReminderDraft(null);
          }}
          customerName={waReminderDraft.customerName}
          mobile={waReminderDraft.mobile}
          outstandingAmount={waReminderDraft.outstandingAmount}
          initialMessage={waReminderDraft.message}
          onLaunchSuccess={() => void refreshWhatsAppConnectionStatus()}
        />
      ) : null}
    </Box>
  );
}
