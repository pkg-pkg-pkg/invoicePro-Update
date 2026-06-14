import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  loadPartyOutstandingReport,
  type PartyOutstandingReport,
  type PartyOutstandingRow,
} from '../../services/reports/partyOutstandingReportService';
import { formatCurrency } from '../../utils/formatters';

const refTypeLabel = (t: string) =>
  t === 'NEW_REF' ? 'Invoice/Bill' : t === 'ADVANCE' ? 'Advance' : 'On Account';

function PartyTable({ rows, kind }: { rows: PartyOutstandingRow[]; kind: 'DEBTOR' | 'CREDITOR' }) {
  const navigate = useNavigate();

  if (rows.length === 0) {
    return (
      <Alert severity="info">
        No outstanding {kind === 'DEBTOR' ? 'debtors' : 'creditors'} with open references.
      </Alert>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{kind === 'DEBTOR' ? 'Customer' : 'Supplier'}</TableCell>
          <TableCell align="right">Outstanding</TableCell>
          <TableCell align="right">Open Refs</TableCell>
          <TableCell>Ageing (pending refs)</TableCell>
          <TableCell>Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <Fragment key={row.ledgerId}>
            <TableRow>
              <TableCell>
                <Typography fontWeight={600}>{row.partyName}</Typography>
                {row.billOutstanding !== row.ledgerBalance && row.ledgerBalance > 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    Ledger: {formatCurrency(row.ledgerBalance)}
                  </Typography>
                ) : null}
              </TableCell>
              <TableCell align="right">
                <Typography fontWeight={700}>{formatCurrency(row.billOutstanding)}</Typography>
              </TableCell>
              <TableCell align="right">{row.openReferenceCount}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {row.ageingBuckets
                    .filter((b) => b.value > 0)
                    .map((b) => (
                      <Chip key={b.label} size="small" variant="outlined" label={`${b.label}: ${formatCurrency(b.value)}`} />
                    ))}
                </Stack>
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5}>
                  {kind === 'DEBTOR' ? (
                    <Button
                      size="small"
                      onClick={() =>
                        navigate(row.partyId ? `/customers/${row.partyId}/statement` : `/ledgers/report?ledgerId=${row.ledgerId}`)
                      }
                    >
                      Ledger
                    </Button>
                  ) : (
                    <Button size="small" onClick={() => navigate(`/ledgers/report?ledgerId=${row.ledgerId}`)}>
                      Ledger
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      navigate(
                        kind === 'DEBTOR'
                          ? `/vouchers/receipt-vouchers/new?type=RECEIPT`
                          : `/vouchers/payment-vouchers/new?type=PAYMENT`
                      )
                    }
                  >
                    Settle
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
            {row.references.filter((r) => r.pendingAmount > 0.01).length > 0 ? (
              <TableRow key={`${row.ledgerId}-refs`}>
                <TableCell colSpan={5} sx={{ bgcolor: 'action.hover', py: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Reference</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Original</TableCell>
                        <TableCell align="right">Adjusted</TableCell>
                        <TableCell align="right">Pending</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {row.references
                        .filter((r) => r.pendingAmount > 0.01)
                        .map((ref) => (
                          <TableRow key={ref.id}>
                            <TableCell>{ref.referenceNo}</TableCell>
                            <TableCell>{refTypeLabel(ref.referenceType)}</TableCell>
                            <TableCell>{ref.voucherDate}</TableCell>
                            <TableCell align="right">{formatCurrency(ref.originalAmount)}</TableCell>
                            <TableCell align="right">{formatCurrency(ref.adjustedAmount)}</TableCell>
                            <TableCell align="right">{formatCurrency(ref.pendingAmount)}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={ref.status.replace('_', ' ')}
                                color={ref.status === 'SETTLED' ? 'success' : ref.status === 'PARTIALLY_SETTLED' ? 'warning' : 'default'}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableCell>
              </TableRow>
            ) : null}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

export default function PartyOutstandingReportPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [report, setReport] = useState<PartyOutstandingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await loadPartyOutstandingReport());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={800}>
          Debtors & Creditors Outstanding
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/reports?view=financial')}>
            Financial Reports
          </Button>
          <Button startIcon={<RefreshIcon />} onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Outstanding and ageing are computed from open bill references (NEW_REF, ADVANCE, ON_ACCOUNT) — Tally-style bill-wise settlement.
      </Alert>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {loading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
        </Stack>
      ) : report ? (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    Total Debtor Outstanding
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="error.main">
                    {formatCurrency(report.totalDebtorOutstanding)}
                  </Typography>
                  <Typography variant="body2">{report.debtors.length} debtor(s)</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    Total Creditor Outstanding
                  </Typography>
                  <Typography variant="h5" fontWeight={800}>
                    {formatCurrency(report.totalCreditorOutstanding)}
                  </Typography>
                  <Typography variant="body2">{report.creditors.length} creditor(s)</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label={`Debtors (${report.debtors.length})`} />
            <Tab label={`Creditors (${report.creditors.length})`} />
          </Tabs>

          {tab === 0 ? <PartyTable rows={report.debtors} kind="DEBTOR" /> : <PartyTable rows={report.creditors} kind="CREDITOR" />}
        </>
      ) : null}
    </Box>
  );
}
