import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PrintIcon from '@mui/icons-material/Print';
import { getNormalizedCompanyProfile } from '../../utils/companyProfile';
import { indianFYBounds, indianFYStartYearForDate } from '../../utils/indianFY';
import {
  exportCustomerStatementCsv,
  exportCustomerStatementExcel,
  exportCustomerStatementPdf,
  loadCustomerLedgerPackage,
  sendOutstandingReminderOnWhatsApp,
  sendStatementOnWhatsApp,
  type CustomerLedgerPackage,
  type CustomerStatementFilters,
} from '../../services/customers/customerLedgerStatementService';
import { logCustomerAudit, currentAuditUserName } from '../../services/customers/customerAuditService';
import { GstReportExportMenu } from '../../components/gst/GstReportExportMenu';
import { VoucherNumberLink } from '../../components/Vouchers/VoucherNumberLink';
import { getVoucherEditPathById } from '../../utils/voucherNavigation';

const formatMoney = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatBalance = (value: number) => {
  const abs = formatMoney(Math.abs(value));
  return value >= 0 ? `${abs} Dr` : `${abs} Cr`;
};

export default function CustomerLedgerStatementPage() {
  const { id: partyId = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const company = getNormalizedCompanyProfile();

  const [filters, setFilters] = useState<CustomerStatementFilters>({});
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const [pkg, setPkg] = useState<CustomerLedgerPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applyPreset = (preset: CustomerStatementFilters['preset']) => {
    const fy = indianFYStartYearForDate();
    if (preset === 'CURRENT_FY') {
      const b = indianFYBounds(fy);
      setFromDate(b.fromISODate);
      setToDate(b.toISODate);
    } else if (preset === 'PREVIOUS_FY') {
      const b = indianFYBounds(fy - 1);
      setFromDate(b.fromISODate);
      setToDate(b.toISODate);
    }
  };

  const load = useCallback(async () => {
    if (!partyId) return;
    setLoading(true);
    setError(null);
    try {
      const nextFilters: CustomerStatementFilters = {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        outstandingOnly,
      };
      const data = await loadCustomerLedgerPackage(partyId, nextFilters);
      setPkg(data);
      setFilters(nextFilters);
      logCustomerAudit({
        customerId: data.party.id,
        customerName: data.party.name,
        action: 'STATEMENT_GENERATED',
        userName: currentAuditUserName(),
      });
    } catch (err) {
      setError((err as Error).message);
      setPkg(null);
    } finally {
      setLoading(false);
    }
  }, [partyId, fromDate, toDate, outstandingOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportSections = useMemo(() => {
    if (!pkg) return [];
    return [
      {
        heading: 'Transactions',
        sheetName: 'Transactions',
        rows: pkg.rows.map((r) => ({
          Date: r.date,
          Type: r.voucherType,
          Number: r.voucherNumber,
          Description: r.description,
          Debit: r.debit,
          Credit: r.credit,
          Balance: r.runningBalance,
        })),
      },
    ];
  }, [pkg]);

  const runWhatsApp = async (kind: 'statement' | 'reminder') => {
    setBusy(true);
    try {
      if (kind === 'statement') await sendStatementOnWhatsApp(partyId, filters);
      else await sendOutstandingReminderOnWhatsApp(partyId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!partyId) {
    return <Alert severity="warning">Missing debtor id.</Alert>;
  }

  return (
    <Stack spacing={2} sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={800}>
          Debtor Ledger Statement
        </Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/ledgers/debtors/${partyId}`)}>
          Back to Debtor
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField label="From Date" type="date" fullWidth value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="To Date" type="date" fullWidth value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button size="small" variant="outlined" onClick={() => applyPreset('CURRENT_FY')}>Current FY</Button>
                <Button size="small" variant="outlined" onClick={() => applyPreset('PREVIOUS_FY')}>Previous FY</Button>
                <Button size="small" variant="contained" onClick={() => void load()}>Apply</Button>
              </Stack>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={outstandingOnly} onChange={(e) => setOutstandingOnly(e.target.checked)} />}
                label="Outstanding only"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
      ) : pkg ? (
        <>
          <Card>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="overline" color="text.secondary">Company</Typography>
                  <Typography fontWeight={700}>{company.businessName || company.name}</Typography>
                  <Typography variant="body2">{company.gstin || '—'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="overline" color="text.secondary">Customer</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography fontWeight={700}>{pkg.party.name}</Typography>
                    <Chip size="small" label={pkg.party.status === 'INACTIVE' ? 'Inactive' : 'Active'} color={pkg.party.status === 'INACTIVE' ? 'default' : 'success'} />
                  </Stack>
                  <Typography variant="body2">Mobile: {pkg.party.mobile || '—'}</Typography>
                  <Typography variant="body2">GSTIN: {pkg.party.gstin || '—'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Opening</Typography>
                  <Typography fontWeight={700}>{formatBalance(pkg.statement.openingBalance)}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Closing</Typography>
                  <Typography fontWeight={700}>{formatBalance(pkg.statement.closingBalance)}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Total Debit / Credit</Typography>
                  <Typography fontWeight={700}>₹{formatMoney(pkg.totalDebit)} / ₹{formatMoney(pkg.totalCredit)}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Outstanding</Typography>
                  <Typography fontWeight={800} color="error.main">₹{formatMoney(pkg.outstandingAmount)}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button startIcon={<PrintIcon />} variant="outlined" disabled={busy} onClick={() => pkg && void exportCustomerStatementPdf(pkg)}>
              Export PDF
            </Button>
            <Button variant="outlined" disabled={busy} onClick={() => pkg && void exportCustomerStatementExcel(pkg)}>Export Excel</Button>
            <Button variant="outlined" disabled={busy} onClick={() => pkg && exportCustomerStatementCsv(pkg)}>Export CSV</Button>
            {exportSections.length > 0 && (
              <GstReportExportMenu
                title={`Statement — ${pkg.party.name}`}
                baseFileName={`Statement_${pkg.party.name.replace(/\W+/g, '_')}`}
                sections={exportSections}
              />
            )}
            <Button startIcon={<WhatsAppIcon />} variant="contained" color="success" disabled={busy} onClick={() => void runWhatsApp('statement')}>
              Send on WhatsApp
            </Button>
            <Button startIcon={<WhatsAppIcon />} variant="outlined" color="success" disabled={busy} onClick={() => void runWhatsApp('reminder')}>
              Send Reminder
            </Button>
          </Stack>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Outstanding References
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(`/vouchers/receipt-vouchers/new?type=RECEIPT`)}
                >
                  Record Receipt
                </Button>
              </Stack>
              {pkg.openReferences.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No open bill references.</Typography>
              ) : (
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
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pkg.openReferences.map((ref) => (
                      <TableRow key={ref.id}>
                        <TableCell>{ref.referenceNo}</TableCell>
                        <TableCell>
                          {ref.referenceType === 'NEW_REF' ? 'Invoice' : ref.referenceType === 'ADVANCE' ? 'Advance' : 'On Account'}
                        </TableCell>
                        <TableCell>{ref.voucherDate}</TableCell>
                        <TableCell align="right">{formatMoney(ref.originalAmount)}</TableCell>
                        <TableCell align="right">{formatMoney(ref.adjustedAmount)}</TableCell>
                        <TableCell align="right">{formatMoney(ref.pendingAmount)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={ref.status.replace('_', ' ')}
                            color={ref.status === 'PARTIALLY_SETTLED' ? 'warning' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            onClick={() => {
                              const path = getVoucherEditPathById(
                                ref.voucherId,
                                ref.referenceType === 'NEW_REF' ? 'SALES' : 'RECEIPT'
                              );
                              if (path) navigate(path);
                            }}
                          >
                            View Source
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Voucher Type</TableCell>
                    <TableCell>Voucher No</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Debit</TableCell>
                    <TableCell align="right">Credit</TableCell>
                    <TableCell align="right">Running Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pkg.rows.length === 0 ? (
                    <TableRow><TableCell colSpan={7} align="center">No transactions</TableCell></TableRow>
                  ) : (
                    pkg.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.date}</TableCell>
                        <TableCell>{r.voucherType}</TableCell>
                        <TableCell>
                          <VoucherNumberLink
                            voucherId={r.voucherId}
                            voucherType={r.voucherType}
                            voucherNumber={r.voucherNumber}
                          />
                        </TableCell>
                        <TableCell>{r.description}</TableCell>
                        <TableCell align="right">{r.debit ? formatMoney(r.debit) : '—'}</TableCell>
                        <TableCell align="right">{r.credit ? formatMoney(r.credit) : '—'}</TableCell>
                        <TableCell align="right">{formatBalance(r.runningBalance)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </Stack>
  );
}
