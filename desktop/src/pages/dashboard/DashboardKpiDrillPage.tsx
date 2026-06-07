import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PrintIcon from '@mui/icons-material/Print';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardDrillLayout } from '../../components/dashboard/DashboardDrillLayout';
import { dashboardCardSx, useDashboardTheme } from '../../components/dashboard/dashboardTheme';
import {
  exportStockValuationCsv,
  fetchOutstandingDrill,
  fetchStockValuationDrill,
  fetchTodayReceiptsDrill,
  fetchTodaySalesDrill,
  printStockValuationHtml,
  type OutstandingDrillCategory,
  type OutstandingDrillRow,
} from '../../services/dashboard/dashboardDrillService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { WhatsAppReminderPreviewDialog } from '../../components/whatsapp/WhatsAppReminderPreviewDialog';
import {
  buildOutstandingReminderMessage,
  resolvePartyPhone,
} from '../../services/whatsappOutstandingReminder';
import { getNormalizedCompanyProfile } from '../../utils/companyProfile';

type DrillKind = 'today-sales' | 'today-receipts' | 'outstanding' | 'stock-value';

const META: Record<
  DrillKind,
  { title: string; subtitle: string; modulePath: string }
> = {
  'today-sales': {
    title: "Today's Sales Transactions",
    subtitle: 'Day book — sales invoices for today',
    modulePath: '/sales/tax-invoices',
  },
  'today-receipts': {
    title: "Today's Receipts",
    subtitle: 'Receipt book — collections for today',
    modulePath: '/vouchers/receipt-vouchers',
  },
  outstanding: {
    title: 'Outstanding Collections',
    subtitle: 'Overdue, due today, and upcoming receivables',
    modulePath: '/reports/outstanding-aging',
  },
  'stock-value': {
    title: 'Inventory Valuation',
    subtitle: 'Stock quantity × rate',
    modulePath: '/items',
  },
};

const OUTSTANDING_TABS: { key: OutstandingDrillCategory | 'all'; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'due_today', label: 'Due Today' },
  { key: 'upcoming', label: 'Upcoming' },
];

function paymentStatusChip(status: string) {
  const u = status.toUpperCase();
  const color =
    u === 'PAID' ? 'success' : u === 'OVERDUE' ? 'error' : u === 'PARTIAL' ? 'warning' : 'default';
  return <Chip size="small" label={status} color={color} sx={{ fontWeight: 700 }} />;
}

export default function DashboardKpiDrillPage() {
  const { kind } = useParams<{ kind: string }>();
  const drillKind = (kind as DrillKind) || 'today-sales';
  const meta = META[drillKind] ?? META['today-sales'];
  const navigate = useNavigate();
  const dt = useDashboardTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesRows, setSalesRows] = useState<Awaited<ReturnType<typeof fetchTodaySalesDrill>>>([]);
  const [receiptRows, setReceiptRows] = useState<Awaited<ReturnType<typeof fetchTodayReceiptsDrill>>>([]);
  const [outstandingRows, setOutstandingRows] = useState<OutstandingDrillRow[]>([]);
  const [stockRows, setStockRows] = useState<Awaited<ReturnType<typeof fetchStockValuationDrill>>>([]);
  const [outstandingTab, setOutstandingTab] = useState<OutstandingDrillCategory>('overdue');
  const [waOpen, setWaOpen] = useState(false);
  const [waDraft, setWaDraft] = useState<{
    customerName: string;
    mobile: string;
    amount: number;
    message: string;
  } | null>(null);
  const [waBusyId, setWaBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      switch (drillKind) {
        case 'today-sales':
          setSalesRows(await fetchTodaySalesDrill());
          break;
        case 'today-receipts':
          setReceiptRows(await fetchTodayReceiptsDrill());
          break;
        case 'outstanding':
          setOutstandingRows(await fetchOutstandingDrill());
          break;
        case 'stock-value':
          setStockRows(await fetchStockValuationDrill());
          break;
        default:
          setError('Unknown drill report.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [drillKind]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredOutstanding = useMemo(
    () => outstandingRows.filter((r) => r.category === outstandingTab),
    [outstandingRows, outstandingTab]
  );

  const stockTotal = useMemo(() => stockRows.reduce((s, r) => s + r.value, 0), [stockRows]);

  const handleWhatsApp = async (row: OutstandingDrillRow) => {
    setWaBusyId(row.id);
    try {
      const ledgerId = row.partyLedgerId || row.id;
      const phone = await resolvePartyPhone(ledgerId, row.customer);
      if (!phone?.replace(/\D/g, '')) {
        window.alert(`"${row.customer}" has no mobile/WhatsApp number. Add it in Party Master.`);
        return;
      }
      const company = getNormalizedCompanyProfile().name || 'PVE InvoicePro 360';
      setWaDraft({
        customerName: row.customer,
        mobile: phone,
        amount: row.amount,
        message: buildOutstandingReminderMessage(row.customer, row.amount, company),
      });
      setWaOpen(true);
    } finally {
      setWaBusyId(null);
    }
  };

  if (!META[drillKind as DrillKind]) {
    return (
      <DashboardDrillLayout title="Report not found">
        <Alert severity="error">Invalid dashboard drill link.</Alert>
      </DashboardDrillLayout>
    );
  }

  return (
    <DashboardDrillLayout title={meta.title} subtitle={meta.subtitle}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Button variant="text" onClick={() => navigate(meta.modulePath)} sx={{ textTransform: 'none', fontWeight: 600 }}>
          Open full module →
        </Button>
        {drillKind === 'stock-value' ? (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<FileDownloadIcon />}
              onClick={() => exportStockValuationCsv(stockRows)}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Export Excel
            </Button>
            <Button
              size="small"
              startIcon={<PrintIcon />}
              onClick={() => printStockValuationHtml(stockRows, meta.title)}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Print
            </Button>
          </Stack>
        ) : (
          <Button onClick={() => void load()} disabled={loading} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Refresh
          </Button>
        )}
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Paper elevation={0} sx={{ ...dashboardCardSx(dt), p: 2 }}>
        {loading ? (
          <Stack alignItems="center" py={6}>
            <CircularProgress size={28} />
          </Stack>
        ) : drillKind === 'today-sales' ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: dt.bgSubtle }}>
                  <TableCell sx={{ fontWeight: 700 }}>Invoice No</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Payment Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {salesRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No sales invoices for today.
                    </TableCell>
                  </TableRow>
                ) : (
                  salesRows.map((row) => (
                    <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(row.editPath)}>
                      <TableCell sx={{ fontWeight: 700 }}>{row.invoiceNo}</TableCell>
                      <TableCell>{row.customer}</TableCell>
                      <TableCell>{paymentStatusChip(row.paymentStatus)}</TableCell>
                      <TableCell>{row.time}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(row.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        ) : drillKind === 'today-receipts' ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: dt.bgSubtle }}>
                  <TableCell sx={{ fontWeight: 700 }}>Receipt No</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Payment Mode</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {receiptRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No receipts for today.
                    </TableCell>
                  </TableRow>
                ) : (
                  receiptRows.map((row) => (
                    <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(row.editPath)}>
                      <TableCell sx={{ fontWeight: 700 }}>{row.receiptNo}</TableCell>
                      <TableCell>{row.customer}</TableCell>
                      <TableCell>{row.paymentMode}</TableCell>
                      <TableCell>{row.time}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(row.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        ) : drillKind === 'outstanding' ? (
          <Box>
            <Tabs value={outstandingTab} onChange={(_, v) => setOutstandingTab(v)} sx={{ mb: 2 }}>
              {OUTSTANDING_TABS.map((t) => (
                <Tab
                  key={t.key}
                  value={t.key}
                  label={`${t.label} (${outstandingRows.filter((r) => r.category === t.key).length})`}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                />
              ))}
            </Tabs>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: dt.bgSubtle }}>
                    <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Invoice No</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Invoice Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredOutstanding.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No outstanding items in this category.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOutstanding.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell sx={{ fontWeight: 700 }}>{row.customer}</TableCell>
                        <TableCell>{row.invoiceNo}</TableCell>
                        <TableCell>{formatDate(row.invoiceDate)}</TableCell>
                        <TableCell>{formatDate(row.dueDate)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(row.amount)}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Button
                              size="small"
                              color="success"
                              startIcon={<WhatsAppIcon />}
                              disabled={waBusyId === row.id}
                              onClick={() => void handleWhatsApp(row)}
                              sx={{ textTransform: 'none', fontWeight: 600 }}
                            >
                              WhatsApp
                            </Button>
                            <Button size="small" onClick={() => navigate(row.editPath)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                              Open
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Total stock value: <strong>{formatCurrency(stockTotal)}</strong>
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: dt.bgSubtle }}>
                    <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Rate</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stockRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No inventory items found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stockRows.map((row) => (
                      <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/items')}>
                        <TableCell sx={{ fontWeight: 700 }}>{row.item}</TableCell>
                        <TableCell align="right">{row.qty.toLocaleString('en-IN')}</TableCell>
                        <TableCell align="right">{formatCurrency(row.rate)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(row.value)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>

      {waDraft ? (
        <WhatsAppReminderPreviewDialog
          open={waOpen}
          onClose={() => {
            setWaOpen(false);
            setWaDraft(null);
          }}
          customerName={waDraft.customerName}
          mobile={waDraft.mobile}
          outstandingAmount={waDraft.amount}
          initialMessage={waDraft.message}
        />
      ) : null}
    </DashboardDrillLayout>
  );
}
