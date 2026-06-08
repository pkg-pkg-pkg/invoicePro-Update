import { publishMobileDataSnapshot } from '../services/mobileSnapshotPublisher';
import { getNormalizedCompanyProfile } from '../utils/companyProfile';
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
import { alpha } from '@mui/material/styles';
import {
  AddCircleOutline as AddCircleOutlineIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  BarChart as BarChartIcon,
  Groups2 as Groups2Icon,
  Inventory2 as Inventory2Icon,
  LocalShipping as LocalShippingIcon,
  PersonAddAlt as PersonAddAltIcon,
  PointOfSale as PointOfSaleIcon,
  ReceiptLong as ReceiptLongIcon,
  ShoppingCart as ShoppingCartIcon,
  Storefront as StorefrontIcon,
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
import { BusinessHealthCard } from '../components/dashboard/BusinessHealthCard';
import { DashboardPanel } from '../components/dashboard/DashboardPanel';
import {
  computeSparkTrend,
  greetingForHour,
  useDashboardTheme,
} from '../components/dashboard/dashboardTheme';
import { PremiumKpiCard } from '../components/dashboard/PremiumKpiCard';
import { DashboardWelcome } from '../components/dashboard/DashboardWelcome';
import { OutstandingAgingCard } from '../components/dashboard/OutstandingAgingCard';
import { BusinessSnapshotCard } from '../components/dashboard/BusinessSnapshotCard';
import { DashboardModuleGrid } from '../components/dashboard/DashboardModuleGrid';
import { WhatsAppReminderPreviewDialog } from '../components/whatsapp/WhatsAppReminderPreviewDialog';
import { WhatsAppOutstandingPickerDialog } from '../components/whatsapp/WhatsAppOutstandingPickerDialog';
import { buildOutstandingAging } from '../utils/outstandingAging';
import {
  getOutstandingCustomers,
  prepareOutstandingRemindersBatch,
  type OutstandingReminderDraft,
} from '../services/whatsappOutstandingReminder';
import {
  refreshWhatsAppConnectionStatus,
} from '../services/whatsappIntegration';
import { useUserDisplayName } from '../hooks/useUserDisplayName';

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

const QUICK_ACTION_ACCENTS_BASE = [
  '#1E40AF',
  '#2563EB',
  '#16A34A',
  '#2563EB',
  '#25D366',
  '#F59E0B',
  '#1E40AF',
  '#64748B',
] as const;

export default function Dashboard() {
  const dt = useDashboardTheme();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const displayName = useUserDisplayName();
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

  const [waBusy, setWaBusy] = useState(false);
  const [waPickerOpen, setWaPickerOpen] = useState(false);
  const [waReminderOpen, setWaReminderOpen] = useState(false);
  const [waReminderQueue, setWaReminderQueue] = useState<OutstandingReminderDraft[]>([]);
  const [waReminderIndex, setWaReminderIndex] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    void refreshWhatsAppConnectionStatus();
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
        id: 'today-sales',
        title: "Today's Sales",
        value: Number(overview?.totalSales || 0),
        color: dt.kpi.sales,
        icon: <ReceiptLongIcon fontSize="small" />,
        drillPath: '/dashboard/drill/today-sales',
        modulePath: '/sales/tax-invoices',
        drillHint: "Click to view today's invoices · Double-click for Sales module",
      },
      {
        id: 'today-receipts',
        title: "Today's Receipts",
        value: todayReceiptsTotal,
        color: dt.kpi.receipts,
        icon: <PointOfSaleIcon fontSize="small" />,
        drillPath: '/dashboard/drill/today-receipts',
        modulePath: '/vouchers/receipt-vouchers',
        drillHint: "Click to view today's receipts · Double-click for Receipt module",
      },
      {
        id: 'outstanding',
        title: 'Outstanding Amount',
        value: Number(overview?.totalOutstanding || 0),
        color: dt.kpi.outstanding,
        icon: <AssignmentTurnedInIcon fontSize="small" />,
        drillPath: '/dashboard/drill/outstanding',
        modulePath: '/reports/outstanding-aging',
        drillHint: 'Click to view pending collections · Double-click for Outstanding report',
      },
      {
        id: 'stock-value',
        title: 'Stock Value',
        value: stockValue,
        color: dt.kpi.stock,
        icon: <Inventory2Icon fontSize="small" />,
        drillPath: '/dashboard/drill/stock-value',
        modulePath: '/items',
        drillHint: 'Click for inventory valuation · Double-click for Items module',
      },
    ],
    [overview, todayReceiptsTotal, stockValue, dt.kpi]
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

  useEffect(() => {
    void publishMobileDataSnapshot({
      todaySales: Number(overview?.totalSales || 0),
      todayReceipts: todayReceiptsTotal,
      outstanding: Number(overview?.totalOutstanding || agingTotal || 0),
      stockValue,
      companyName: getNormalizedCompanyProfile().businessName || undefined,
      recentInvoices: (recentTransactions?.invoices ?? []).slice(0, 8).map((inv: any) => ({
        id: String(inv.id || inv._id || ''),
        number: String(inv.invoiceNumber || inv.number || inv.id || ''),
        customer: String(inv.customerName || inv.partyName || '—'),
        amount: Number(inv.total || inv.grandTotal || 0),
        date: String(inv.date || inv.invoiceDate || ''),
      })),
      topCustomers: (outstandingSummary?.customers ?? []).slice(0, 5).map((c: any) => ({
        name: String(c.name || c.partyName || 'Customer'),
        amount: Number(c.outstanding || c.balance || 0),
      })),
    });
  }, [
    overview?.totalSales,
    overview?.totalOutstanding,
    todayReceiptsTotal,
    stockValue,
    agingTotal,
    recentTransactions?.invoices,
    outstandingSummary?.customers,
  ]);

  const totalSalesM = Number(monthly?.totalSales || 0);
  const totalPurchaseM = Number(monthly?.totalPurchase || 0);
  const grossProfitM = totalSalesM - totalPurchaseM;
  const expensesM = Math.max(0, grossProfitM - Number(monthly?.profitLoss || 0));

  const businessHealthMetrics = useMemo(() => {
    const defs = [
      { label: 'Total Sales', value: totalSalesM, color: dt.kpi.sales },
      { label: 'Total Purchase', value: totalPurchaseM, color: '#64748B' },
      { label: 'Gross Profit', value: grossProfitM, color: dt.kpi.receipts },
      { label: 'Expenses', value: expensesM, color: dt.kpi.outstanding },
    ];
    return defs.map((d) => {
      const chartData = miniBarSeries(d.value);
      const g = growthFromSeries(chartData);
      return { ...d, chartData, growthPct: g.pct, growthUp: g.up };
    });
  }, [totalSalesM, totalPurchaseM, grossProfitM, expensesM]);

  const monthReceiptsTotal = Number(monthly?.todayReceipts ?? 0);

  const snapshotItems = useMemo(
    () => [
      {
        label: "Today's Sales",
        value: formatCurrency(overview?.totalSales || 0),
        accent: dt.kpi.sales,
        onClick: () => navigate('/vouchers/sales'),
      },
      {
        label: "Today's Receipts",
        value: formatCurrency(todayReceiptsTotal),
        accent: dt.kpi.receipts,
        onClick: () => navigate('/vouchers/receipt-vouchers'),
      },
      {
        label: 'Month Sales',
        value: formatCurrency(totalSalesM),
        accent: dt.kpi.sales,
        onClick: () => navigate('/vouchers/sales'),
      },
      {
        label: 'Month Receipts',
        value: formatCurrency(monthReceiptsTotal),
        accent: dt.kpi.receipts,
        onClick: () => navigate('/vouchers/receipt-vouchers'),
      },
      {
        label: 'Pending Collections',
        value: formatCurrency(overview?.totalOutstanding || 0),
        accent: dt.kpi.outstanding,
        onClick: () => navigate('/reports/outstanding-aging'),
      },
      {
        label: 'Pending Invoices',
        value: String(pendingInvoiceCount),
        accent: dt.primary,
        onClick: () => navigate('/vouchers/sales'),
      },
      {
        label: 'Low Stock Items',
        value: String(lowStock.length),
        accent: lowStock.length > 0 ? dt.status.warn : dt.kpi.receipts,
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

  const outstandingCustomers = useMemo(
    () => getOutstandingCustomers(outstandingSummary?.customers),
    [outstandingSummary?.customers]
  );

  const waReminderDraft = waReminderQueue[waReminderIndex] ?? null;

  const handleWhatsAppReminder = useCallback(() => {
    if (!outstandingCustomers.length) {
      window.alert('No outstanding customer balance to remind.');
      return;
    }
    setWaPickerOpen(true);
  }, [outstandingCustomers.length]);

  const handleWhatsAppPickerConfirm = useCallback(
    async (selected: typeof outstandingCustomers) => {
      if (!selected.length) return;
      setWaBusy(true);
      try {
        const { drafts, skipped } = await prepareOutstandingRemindersBatch(selected);
        if (!drafts.length) {
          window.alert(
            skipped.length === 1
              ? `"${skipped[0].customerName}" has no mobile or WhatsApp number. Add contact details in Party Master.`
              : 'Selected customers have no mobile or WhatsApp number. Add contact details in Party Master.'
          );
          return;
        }
        if (skipped.length) {
          window.alert(
            `${skipped.length} customer(s) skipped — no mobile/WhatsApp number:\n${skipped
              .slice(0, 5)
              .map((s) => `• ${s.customerName}`)
              .join('\n')}${skipped.length > 5 ? `\n…and ${skipped.length - 5} more` : ''}`
          );
        }
        setWaPickerOpen(false);
        setWaReminderQueue(drafts);
        setWaReminderIndex(0);
        setWaReminderOpen(true);
      } catch (err) {
        console.error('WhatsApp reminder prepare failed', err);
        window.alert('Could not prepare WhatsApp reminder. Please try again.');
      } finally {
        setWaBusy(false);
      }
    },
    []
  );

  const closeWhatsAppReminderFlow = useCallback(() => {
    setWaReminderOpen(false);
    setWaReminderQueue([]);
    setWaReminderIndex(0);
  }, []);

  const advanceWhatsAppReminderQueue = useCallback(() => {
    setWaReminderIndex((idx) => (idx + 1 < waReminderQueue.length ? idx + 1 : idx));
  }, [waReminderQueue.length]);

  const quickActions = useMemo(
    () => [
      { label: 'Create Invoice', icon: <ReceiptLongIcon fontSize="small" />, to: '/vouchers/sales/new' },
      { label: 'Receipt Entry', icon: <PointOfSaleIcon fontSize="small" />, to: '/vouchers/receipt-vouchers/new' },
      { label: 'Payment Entry', icon: <PointOfSaleIcon fontSize="small" />, to: '/vouchers/payment-vouchers/new' },
      { label: 'Purchase Bill', icon: <ShoppingCartIcon fontSize="small" />, to: '/vouchers/purchase/new' },
      { label: 'New Customer', icon: <PersonAddAltIcon fontSize="small" />, to: '/parties/new' },
      { label: 'New Item', icon: <AddCircleOutlineIcon fontSize="small" />, to: '/items?new=1' },
      { label: 'Outstanding', icon: <AssignmentTurnedInIcon fontSize="small" />, to: '/reports/outstanding-aging' },
      {
        label: 'WhatsApp Reminder',
        icon: <WhatsAppIcon fontSize="small" />,
        onClick: handleWhatsAppReminder,
      },
      { label: 'Stock Summary', icon: <Inventory2Icon fontSize="small" />, to: '/items' },
      { label: 'GST Returns', icon: <BarChartIcon fontSize="small" />, to: '/gst' },
      { label: 'E-Way Bill', icon: <LocalShippingIcon fontSize="small" />, to: '/gst/e-way-bill' },
      { label: 'Reports', icon: <BarChartIcon fontSize="small" />, to: '/reports' },
      { label: 'Customer Ledger', icon: <Groups2Icon fontSize="small" />, to: '/customers/ledger-report' },
      { label: 'PVE Store', icon: <StorefrontIcon fontSize="small" />, to: '/store' },
    ],
    [handleWhatsAppReminder]
  );

  const pageBg = dt.bg;

  const viewAllBtnSx = {
    textTransform: 'none' as const,
    fontWeight: 600,
    fontSize: '0.8125rem',
    borderRadius: dt.innerRadius,
    color: dt.primary,
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
        fontFamily: dt.fontFamily,
        px: { xs: dt.padTablet, md: dt.padDesktop },
        py: { xs: dt.padTablet, md: dt.padDesktop },
        bgcolor: pageBg,
        minHeight: '100%',
        transition: dt.transition,
      }}
    >
      <DashboardWelcome
        greeting={greetingForHour(now.getHours())}
        userName={displayName}
        now={now}
      />

      {/* KPI cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: dt.gridGap,
          mb: dt.gridGap,
        }}
      >
        {kpiCards.map((kpi, idx) => (
          <Box key={kpi.id} sx={{ minWidth: 0, display: 'flex' }}>
            <PremiumKpiCard
              title={kpi.title}
              value={kpi.value}
              trendPct={sparkTrend.pct}
              trendUp={sparkTrend.up}
              color={kpi.color}
              icon={kpi.icon}
              drillHint={kpi.drillHint}
              onDrill={() => navigate(kpi.drillPath)}
              onOpenModule={() => navigate(kpi.modulePath)}
              graphData={sparklineData.map((s, i) => ({
                ...s,
                value: s.value + idx * 3 + i,
              }))}
            />
          </Box>
        ))}
      </Box>

      <DashboardPanel title="Quick Action Center" sx={{ mb: dt.gridGap }}>
        <Grid container spacing={1.25}>
          {quickActions.map((qa, idx) => {
            const accent = QUICK_ACTION_ACCENTS_BASE[idx % QUICK_ACTION_ACCENTS_BASE.length];
            return (
              <Grid item xs={6} sm={4} md={3} lg={2} key={qa.label}>
                <Button
                  fullWidth
                  title={qa.label}
                  onClick={() =>
                    'onClick' in qa && qa.onClick ? qa.onClick() : navigate((qa as { to: string }).to)
                  }
                  sx={{
                    minHeight: 76,
                    py: 1,
                    borderRadius: dt.cardRadius,
                    border: '1px solid',
                    borderColor: alpha(accent, 0.14),
                    flexDirection: 'column',
                    gap: 0.65,
                    bgcolor: alpha(accent, 0.06),
                    textTransform: 'none',
                    fontFamily: dt.fontFamily,
                    transition: dt.transition,
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                    '&:hover': {
                      transform: dt.hoverLift,
                      borderColor: alpha(accent, 0.35),
                      bgcolor: alpha(accent, 0.1),
                      boxShadow: dt.cardShadow,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(145deg, ${alpha(accent, 0.22)} 0%, ${alpha(accent, 0.08)} 100%)`,
                      color: accent,
                      '& .MuiSvgIcon-root': { fontSize: 22 },
                    }}
                  >
                    {qa.icon}
                  </Box>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    sx={{ color: dt.text.primary, lineHeight: 1.2, fontSize: '0.72rem' }}
                  >
                    {qa.label}
                  </Typography>
                </Button>
              </Grid>
            );
          })}
        </Grid>
      </DashboardPanel>

      {/* Outstanding aging — full width */}
      <Box sx={{ mb: dt.gridGap }}>
        <OutstandingAgingCard
          buckets={agingBuckets}
          total={agingTotal}
          onViewReport={() => navigate('/reports/outstanding-aging')}
        />
      </Box>

      {/* Row 3 — business modules */}
      <Box sx={{ mb: dt.gridGap }}>
        <DashboardModuleGrid />
      </Box>

      {/* Row 4 — business snapshot */}
      <Box sx={{ mb: dt.gridGap }}>
        <BusinessSnapshotCard items={snapshotItems} />
      </Box>

      <Grid container spacing={dt.gridGap} sx={{ mb: dt.gridGap }}>
            <Grid item xs={12}>
              <DashboardPanel
                title="Recent Invoices"
                action={
                  <Button size="small" sx={viewAllBtnSx} onClick={() => navigate('/vouchers/sales')}>
                    View All
                  </Button>
                }
              >
                <TableContainer
                  sx={{
                    borderRadius: dt.innerRadius,
                    border: `1px solid ${dt.border}`,
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
                              color: dt.text.muted,
                              borderBottom: `1px solid ${dt.border}`,
                              py: 1.25,
                              bgcolor: dt.bgSubtle,
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
                                  ? alpha(dt.primary, 0.02)
                                  : 'transparent',
                              transition: 'background-color 200ms ease',
                              '&:last-child td': { border: 0 },
                              '&:hover': {
                                bgcolor: alpha(dt.primary, 0.06),
                                '& td': { borderColor: 'transparent' },
                              },
                            }}
                          >
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.8125rem', py: 1.35 }}>
                              {inv.invoiceNumber}
                            </TableCell>
                            <TableCell
                              sx={{ fontSize: '0.8125rem', color: dt.text.secondary, py: 1.35 }}
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

      <Grid container spacing={dt.gridGap}>
            <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
              <DashboardPanel
                fillHeight
                title="Top Customers"
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
                  sx={{ px: 0.5, pb: 1, borderBottom: `1px solid ${dt.border}` }}
                >
                  <Typography variant="caption" fontWeight={700} color={dt.text.muted}>
                    Customer Name
                  </Typography>
                  <Typography variant="caption" fontWeight={700} color={dt.text.muted}>
                    Outstanding Amount
                  </Typography>
                </Stack>
                <Stack spacing={0} divider={<Divider sx={{ borderColor: dt.border }} />}>
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
                          borderRadius: dt.innerRadius,
                          transition: dt.transition,
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: dt.primarySoft,
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
                              background: `linear-gradient(135deg, ${alpha(dt.primary, 0.2)} 0%, ${alpha(dt.primary, 0.08)} 100%)`,
                              color: dt.primary,
                              border: `1px solid ${alpha(dt.primary, 0.18)}`,
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
                            color: dt.kpi.outstanding,
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

      {loading && (
        <Box sx={{ position: 'fixed', right: 24, bottom: 24, zIndex: 10 }}>
          <Chip
            icon={<CircularProgress size={14} color="inherit" />}
            label="Loading dashboard..."
            sx={{
              fontFamily: dt.fontFamily,
              fontWeight: 600,
              boxShadow: dt.cardShadow,
              borderRadius: dt.cardRadius,
            }}
          />
        </Box>
      )}

      <WhatsAppOutstandingPickerDialog
        open={waPickerOpen}
        onClose={() => setWaPickerOpen(false)}
        customers={outstandingCustomers}
        onConfirm={(selected) => void handleWhatsAppPickerConfirm(selected)}
        busy={waBusy}
      />

      {waReminderDraft ? (
        <WhatsAppReminderPreviewDialog
          open={waReminderOpen}
          onClose={closeWhatsAppReminderFlow}
          title={
            waReminderQueue.length > 1
              ? `WhatsApp Reminder (${waReminderIndex + 1} of ${waReminderQueue.length})`
              : 'WhatsApp Reminder Preview'
          }
          customerName={waReminderDraft.customerName}
          mobile={waReminderDraft.mobile}
          outstandingAmount={waReminderDraft.outstandingAmount}
          initialMessage={waReminderDraft.message}
          closeAfterLaunch={waReminderIndex + 1 >= waReminderQueue.length}
          onLaunchSuccess={() => {
            void refreshWhatsAppConnectionStatus();
            advanceWhatsAppReminderQueue();
          }}
        />
      ) : null}
    </Box>
  );
}
