import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useSearchParams } from 'react-router-dom';
import { customersApi, type PartyFilterOption } from '../services/customers/customersApi';
import { ledgerReportService, type LedgerStatement } from '../services/reports/ledgerReportService';
import { formatCurrency } from '../utils/formatters';
import { PARTIES_CHANGED_EVENT } from '../services/masters/partyService';

type PartyType = 'customer' | 'supplier';

type PartyOption = PartyFilterOption;

const formatBalance = (value: number) => {
  const abs = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value >= 0 ? `${abs} Dr` : `${abs} Cr`;
};

function exportLedgerCsv(statement: LedgerStatement, filename: string) {
  const rows = [
    ['Date', 'Voucher No.', 'Particulars', 'Debit (Dr)', 'Credit (Cr)', 'Balance'],
    ['', '', 'Opening Balance', '', '', formatBalance(statement.openingBalance)],
    ...statement.transactions.map((t) => [
      new Date(t.date).toISOString().slice(0, 10),
      t.voucherId,
      t.voucherType,
      t.debit ? String(t.debit) : '',
      t.credit ? String(t.credit) : '',
      formatBalance(t.runningBalance),
    ]),
    ['', '', 'Closing Balance', '', '', formatBalance(statement.closingBalance)],
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportLedgerPdf(statement: LedgerStatement, title: string) {
  const lines = statement.transactions
    .map(
      (t) =>
        `<tr><td>${new Date(t.date).toISOString().slice(0, 10)}</td><td>${t.voucherId}</td><td>${t.voucherType}</td><td align="right">${t.debit || ''}</td><td align="right">${t.credit || ''}</td><td align="right">${formatBalance(t.runningBalance)}</td></tr>`
    )
    .join('');
  const html = `<!DOCTYPE html><html><head><title>${title}</title><style>table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;font-size:12px}th{background:#f5f5f5}</style></head><body><h2>${title}</h2><table><thead><tr><th>Date</th><th>Voucher No.</th><th>Particulars</th><th>Debit (Dr)</th><th>Credit (Cr)</th><th>Balance</th></tr></thead><tbody><tr><td colspan="3"><strong>Opening Balance</strong></td><td></td><td></td><td align="right">${formatBalance(statement.openingBalance)}</td></tr>${lines}<tr><td colspan="3"><strong>Closing Balance</strong></td><td></td><td></td><td align="right">${formatBalance(statement.closingBalance)}</td></tr></tbody></table></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.print();
}

export default function PartyLedgerReport() {
  const [searchParams] = useSearchParams();
  const [partyType, setPartyType] = useState<PartyType>('customer');
  const [customerOptions, setCustomerOptions] = useState<PartyFilterOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<PartyFilterOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingLists, setLoadingLists] = useState(true);

  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [statement, setStatement] = useState<LedgerStatement | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  const refreshLists = useCallback(async () => {
    setLoadingLists(true);
    setLoadError(null);
    try {
      const [buyers, sellers] = await Promise.all([
        customersApi.listLedgerCustomerOptions(),
        customersApi.listLedgerSupplierOptions(),
      ]);
      setCustomerOptions(buyers);
      setSupplierOptions(sellers);
    } catch (e) {
      setLoadError((e as Error).message ?? 'Failed to load parties');
      setCustomerOptions([]);
      setSupplierOptions([]);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    void refreshLists();
  }, [refreshLists]);

  useEffect(() => {
    const onPartiesChanged = () => void refreshLists();
    window.addEventListener(PARTIES_CHANGED_EVENT, onPartiesChanged);
    return () => window.removeEventListener(PARTIES_CHANGED_EVENT, onPartiesChanged);
  }, [refreshLists]);

  useEffect(() => {
    const customerId = searchParams.get('customerId');
    if (!customerId) return;
    setPartyType('customer');
    const match =
      customerOptions.find((o) => o.partyId === customerId) ??
      customerOptions.find((o) => o.ledgerId === customerId);
    if (match) setSelectedPartyId(match.partyId);
  }, [searchParams, customerOptions]);

  const options: PartyOption[] = useMemo(
    () => (partyType === 'customer' ? customerOptions : supplierOptions),
    [partyType, customerOptions, supplierOptions]
  );

  const selected = options.find((o) => o.partyId === selectedPartyId) ?? null;

  const viewLedger = async () => {
    if (!selected?.ledgerId) return;
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      const res = await ledgerReportService.getStatement(selected.ledgerId, {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setStatement(res);
    } catch (e) {
      setStatement(null);
      setLedgerError((e as Error).message ?? 'Failed to load ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const emptyMessage =
    !loadingLists && options.length === 0
      ? partyType === 'customer'
        ? 'No customers found. Add customers under Customers module.'
        : 'No suppliers found. Add suppliers under Party Master.'
      : undefined;
  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Ledger Report
      </Typography>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
          {loadError}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Party Type</InputLabel>
              <Select
                label="Party Type"
                value={partyType}
                onChange={(e) => {
                  setPartyType(e.target.value as PartyType);
                  setSelectedPartyId('');
                  setStatement(null);
                }}
              >
                <MenuItem value="customer">Customer</MenuItem>
                <MenuItem value="supplier">Supplier</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={5}>
            <Autocomplete
              options={options}
              value={selected}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.partyId === b.partyId}
              onChange={(_e, v) => {
                setSelectedPartyId(v?.partyId ?? '');
                setStatement(null);
              }}
              loading={loadingLists}
              noOptionsText={loadingLists ? 'Loading…' : emptyMessage || 'No parties found'}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label={partyType === 'customer' ? 'Customer' : 'Supplier'}
                  placeholder="Search by name…"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField label="From Date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} fullWidth size="small" InputLabelProps={{ shrink: true }} />
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} fullWidth size="small" InputLabelProps={{ shrink: true }} />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => { setSelectedPartyId(''); setFromDate(''); setToDate(''); setStatement(null); }}>
                Clear
              </Button>
              <Button variant="contained" disabled={!selectedPartyId || !selected?.ledgerId} onClick={() => void viewLedger()}>
                View Ledger
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {ledgerError ? <Alert severity="error" sx={{ mb: 2 }}>{ledgerError}</Alert> : null}

      {ledgerLoading ? (
        <Stack alignItems="center" py={4}><CircularProgress size={28} /></Stack>
      ) : statement ? (
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              {statement.ledger.name} — Ledger
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" startIcon={<FileDownloadIcon />} onClick={() => exportLedgerCsv(statement, `ledger-${selected?.name ?? 'party'}.csv`)}>
                Export Excel
              </Button>
              <Button size="small" startIcon={<PictureAsPdfIcon />} onClick={() => exportLedgerPdf(statement, `${selected?.name ?? 'Party'} Ledger`)}>
                Export PDF
              </Button>
            </Stack>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Voucher No.</TableCell>
                <TableCell>Particulars</TableCell>
                <TableCell align="right">Debit (Dr)</TableCell>
                <TableCell align="right">Credit (Cr)</TableCell>
                <TableCell align="right">Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell colSpan={3}><strong>Opening Balance</strong></TableCell>
                  <TableCell align="right" />
                  <TableCell align="right" />
                  <TableCell align="right"><strong>{formatBalance(statement.openingBalance)}</strong></TableCell>
                </TableRow>
              {statement.transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.date).toLocaleDateString()}</TableCell>
                  <TableCell>{t.voucherId}</TableCell>
                  <TableCell>{t.voucherType}</TableCell>
                  <TableCell align="right">{t.debit ? formatCurrency(t.debit) : '—'}</TableCell>
                  <TableCell align="right">{t.credit ? formatCurrency(t.credit) : '—'}</TableCell>
                  <TableCell align="right">{formatBalance(t.runningBalance)}</TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell colSpan={3}><strong>Closing Balance</strong></TableCell>
                  <TableCell align="right" />
                  <TableCell align="right" />
                  <TableCell align="right"><strong>{formatBalance(statement.closingBalance)}</strong></TableCell>
                </TableRow>
            </TableBody>
          </Table>
        </Paper>
      ) : null}
    </Box>
  );
}
