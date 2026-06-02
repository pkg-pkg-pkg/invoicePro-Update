import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  Chip,
  Paper,
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { AppDispatch, RootState } from '../../store';
import { OutstandingAgingCard } from '../../components/dashboard/OutstandingAgingCard';
import { WhatsAppReminderPreviewDialog } from '../../components/whatsapp/WhatsAppReminderPreviewDialog';
import {
  fetchOutstandingSummary,
  fetchRecentTransactions,
  fetchTodayOverview,
} from '../../store/slices/dashboardSlice';
import { DASHBOARD_THEME, dashboardCardSx } from '../../components/dashboard/dashboardTheme';
import { buildOutstandingAging, type AgingLineItem } from '../../utils/outstandingAging';
import { formatCurrency } from '../../utils/formatters';
import { getNormalizedCompanyProfile } from '../../utils/companyProfile';
import {
  buildOutstandingReminderMessage,
  resolvePartyPhone,
} from '../../services/whatsappOutstandingReminder';

export default function OutstandingAgingReport() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [searchParams] = useSearchParams();
  const highlightBucket = searchParams.get('bucket') || '';

  const { outstandingSummary, recentTransactions, todaySummary, summary } = useSelector(
    (s: RootState) => s.dashboard
  );

  const isDark = theme.palette.mode === 'dark';
  const [waOpen, setWaOpen] = useState(false);
  const [waBusyId, setWaBusyId] = useState<string | null>(null);
  const [waDraft, setWaDraft] = useState<{
    customerName: string;
    mobile: string;
    amount: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    dispatch(fetchTodayOverview());
    dispatch(fetchOutstandingSummary());
    dispatch(fetchRecentTransactions(30));
  }, [dispatch]);

  const { buckets, total } = useMemo(
    () =>
      buildOutstandingAging({
        customers: outstandingSummary?.customers ?? [],
        salesVouchers: outstandingSummary?.salesVouchers ?? [],
        invoices: recentTransactions?.invoices ?? [],
        fallbackTotal: Number((todaySummary ?? summary)?.totalOutstanding || 0),
      }),
    [
      outstandingSummary?.customers,
      outstandingSummary?.salesVouchers,
      recentTransactions?.invoices,
      todaySummary,
      summary,
    ]
  );

  const allLines = useMemo(
    () => buckets.flatMap((b) => b.items.map((item) => ({ ...item, bucket: b.label }))),
    [buckets]
  );

  const filteredLines = useMemo(() => {
    if (!highlightBucket) return allLines;
    return allLines.filter((l) => l.bucket === highlightBucket);
  }, [allLines, highlightBucket]);

  const handleWhatsAppReminder = useCallback(async (row: AgingLineItem & { bucket: string }) => {
    setWaBusyId(row.id);
    try {
      const ledgerId = row.partyLedgerId || row.id.replace(/^ledger-/, '');
      const phone = await resolvePartyPhone(ledgerId, row.title);
      if (!phone?.replace(/\D/g, '')) {
        window.alert(`"${row.title}" has no mobile or WhatsApp number. Add it in Party Master.`);
        return;
      }
      const company = getNormalizedCompanyProfile().name || 'PVE InvoicePro 360';
      setWaDraft({
        customerName: row.title,
        mobile: phone,
        amount: row.amount,
        message: buildOutstandingReminderMessage(row.title, row.amount, company),
      });
      setWaOpen(true);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not prepare WhatsApp reminder.');
    } finally {
      setWaBusyId(null);
    }
  }, []);

  const pageBg = isDark
    ? `linear-gradient(165deg, ${alpha('#0F172A', 0.99)} 0%, ${alpha('#0B1220', 0.99)} 100%)`
    : `linear-gradient(180deg, ${DASHBOARD_THEME.bg} 0%, ${DASHBOARD_THEME.bgSubtle} 100%)`;

  return (
    <Box
      sx={{
        fontFamily: DASHBOARD_THEME.fontFamily,
        minHeight: '100%',
        bgcolor: pageBg,
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/dashboard')}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Dashboard
        </Button>
      </Stack>

      <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em', mb: 0.5 }}>
        Outstanding — Age-wise Report
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Unpaid invoices grouped by how long they are outstanding. Tap a slab on the dashboard or below
        to filter.
      </Typography>

      <Box sx={{ maxWidth: 420, mb: 2.5 }}>
        <OutstandingAgingCard
          buckets={buckets}
          total={total}
          isDark={isDark}
          onViewBucketReport={(b) =>
            navigate(`/reports/outstanding-aging?bucket=${encodeURIComponent(b.label)}`)
          }
        />
      </Box>

      <Paper elevation={0} sx={{ ...dashboardCardSx(isDark), p: 2.25 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography fontWeight={800}>All outstanding lines</Typography>
          {highlightBucket ? (
            <Chip
              size="small"
              label={highlightBucket}
              onDelete={() => navigate('/reports/outstanding-aging')}
              sx={{ fontWeight: 700 }}
            />
          ) : null}
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: isDark ? alpha('#fff', 0.04) : DASHBOARD_THEME.bgSubtle }}>
                <TableCell sx={{ fontWeight: 700 }}>Age slab</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Party / Ledger</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Invoice / detail</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Days
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Amount
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No outstanding lines in this slab. Add sales invoices or check Party Master balances.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLines.map((row) => (
                  <TableRow key={`${row.bucket}-${row.id}`} hover>
                    <TableCell>
                      <Chip size="small" label={row.bucket} sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{row.title}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>{row.subtitle}</TableCell>
                    <TableCell align="right">{row.daysOld}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {formatCurrency(row.amount)}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button
                          size="small"
                          color="success"
                          startIcon={<WhatsAppIcon />}
                          disabled={waBusyId === row.id}
                          onClick={() => void handleWhatsAppReminder(row)}
                          sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                          WhatsApp
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            if (row.id.startsWith('ledger-')) {
                              navigate(
                                `/parties/party-ledger/${encodeURIComponent(row.id.replace(/^ledger-/, ''))}`
                              );
                            } else {
                              navigate(`/vouchers/sales/${encodeURIComponent(row.id)}/edit`);
                            }
                          }}
                          sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
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
      </Paper>

      {waDraft ? (
        <WhatsAppReminderPreviewDialog
          open={waOpen}
          onClose={() => {
            setWaOpen(false);
            setWaDraft(null);
          }}
          title="Send WhatsApp Reminder"
          amountLabel="Outstanding Amount"
          customerName={waDraft.customerName}
          mobile={waDraft.mobile}
          outstandingAmount={waDraft.amount}
          initialMessage={waDraft.message}
        />
      ) : null}
    </Box>
  );
}
