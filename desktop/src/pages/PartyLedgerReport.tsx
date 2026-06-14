import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
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
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useSearchParams } from 'react-router-dom';
import { customersApi, type PartyFilterOption } from '../services/customers/customersApi';
import { ledgerAccountService } from '../services/masters/ledgerAccountService';
import { ledgerGroupService } from '../services/masters/ledgerGroupService';
import { ledgerReportService, type LedgerStatement } from '../services/reports/ledgerReportService';
import { formatCurrency } from '../utils/formatters';
import { PARTIES_CHANGED_EVENT } from '../services/masters/partyService';
import { PartyPickerModal } from '../components/parties/PartyPickerModal';
import { PartyPickerField } from '../components/parties/PartyPickerField';
import type { LedgerAccount } from '../types/masters';
import { VoucherNumberLink } from '../components/Vouchers/VoucherNumberLink';
import { buildGroupPath } from '../utils/ledgerGroupPath';
import { resolveVoucherNumberLabel } from '../utils/voucherNavigation';

type PartyType = 'customer' | 'supplier';
type SourceMode = 'any' | 'debtor' | 'creditor';

const formatBalance = (value: number) => {
  const abs = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value >= 0 ? `${abs} Dr` : `${abs} Cr`;
};

function ledgerTxnVoucherNumber(t: LedgerStatement['transactions'][number]): string {
  const meta = t.meta as { voucherNumber?: string } | null | undefined;
  return resolveVoucherNumberLabel(meta?.voucherNumber ?? null, t.voucherId);
}

function exportLedgerCsv(statement: LedgerStatement, filename: string) {
  const rows = [
    ['Date', 'Voucher No.', 'Particulars', 'Debit (Dr)', 'Credit (Cr)', 'Balance'],
    ['', '', 'Opening Balance', '', '', formatBalance(statement.openingBalance)],
    ...statement.transactions.map((t) => [
      new Date(t.date).toISOString().slice(0, 10),
      ledgerTxnVoucherNumber(t),
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
        `<tr><td>${new Date(t.date).toISOString().slice(0, 10)}</td><td>${ledgerTxnVoucherNumber(t)}</td><td>${t.voucherType}</td><td align="right">${t.debit || ''}</td><td align="right">${t.credit || ''}</td><td align="right">${formatBalance(t.runningBalance)}</td></tr>`
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [sourceMode, setSourceMode] = useState<SourceMode>('any');
  const [customerOptions, setCustomerOptions] = useState<PartyFilterOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<PartyFilterOption[]>([]);
  const [allLedgers, setAllLedgers] = useState<LedgerAccount[]>([]);
  const [groups, setGroups] = useState<Awaited<ReturnType<typeof ledgerGroupService.list>>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingLists, setLoadingLists] = useState(true);

  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [statement, setStatement] = useState<LedgerStatement | null>(null);
  const [viewedLedgerId, setViewedLedgerId] = useState<string | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const loadRequestRef = useRef(0);
  const loadedUrlLedgerRef = useRef<string | null>(null);

  const clearStatementView = useCallback(() => {
    setStatement(null);
    setViewedLedgerId(null);
    setLedgerError(null);
    loadedUrlLedgerRef.current = null;
  }, []);

  const refreshLists = useCallback(async () => {
    setLoadingLists(true);
    setLoadError(null);
    try {
      const [buyers, sellers, ledgers, groupRows] = await Promise.all([
        customersApi.listLedgerCustomerOptions(),
        customersApi.listLedgerSupplierOptions(),
        ledgerAccountService.list({ includeInactive: true }),
        ledgerGroupService.list({ includeInactive: true }),
      ]);
      setCustomerOptions(buyers);
      setSupplierOptions(sellers);
      setAllLedgers(ledgers.sort((a, b) => a.name.localeCompare(b.name)));
      setGroups(groupRows);
    } catch (e) {
      setLoadError((e as Error).message ?? 'Failed to load ledgers');
      setCustomerOptions([]);
      setSupplierOptions([]);
      setAllLedgers([]);
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

  const activeLedgerId = useMemo(() => {
    if (sourceMode === 'any') return selectedLedgerId;
    const selected = (sourceMode === 'debtor' ? customerOptions : supplierOptions).find((o) => o.partyId === selectedPartyId);
    return selected?.ledgerId ?? '';
  }, [sourceMode, selectedLedgerId, selectedPartyId, customerOptions, supplierOptions]);

  const selectedLedger = allLedgers.find((l) => l.id === activeLedgerId) ?? null;
  const selectedParty = (sourceMode === 'debtor' ? customerOptions : supplierOptions).find((o) => o.partyId === selectedPartyId) ?? null;
  const displayName = selectedLedger?.name ?? selectedParty?.name ?? 'Ledger';

  const loadStatement = useCallback(async (ledgerId: string) => {
    if (!ledgerId) return;
    const requestId = ++loadRequestRef.current;
    setLedgerLoading(true);
    setLedgerError(null);
    setStatement(null);
    setViewedLedgerId(null);
    try {
      const res = await ledgerReportService.getStatement(ledgerId, {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      if (requestId !== loadRequestRef.current) return;
      setStatement(res);
      setViewedLedgerId(ledgerId);
    } catch (e) {
      if (requestId !== loadRequestRef.current) return;
      setStatement(null);
      setViewedLedgerId(null);
      setLedgerError((e as Error).message ?? 'Failed to load ledger');
    } finally {
      if (requestId === loadRequestRef.current) {
        setLedgerLoading(false);
      }
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    const ledgerId = searchParams.get('ledgerId');
    const customerId = searchParams.get('customerId');
    if (ledgerId) {
      setSourceMode('any');
      setSelectedLedgerId(ledgerId);
      return;
    }
    if (customerId) {
      setSourceMode('debtor');
      const match =
        customerOptions.find((o) => o.partyId === customerId) ??
        customerOptions.find((o) => o.ledgerId === customerId);
      if (match) setSelectedPartyId(match.partyId);
    }
  }, [searchParams, customerOptions]);

  useEffect(() => {
    const ledgerId = searchParams.get('ledgerId');
    if (!ledgerId) {
      loadedUrlLedgerRef.current = null;
      return;
    }
    if (allLedgers.length === 0) return;
    if (loadedUrlLedgerRef.current === ledgerId) return;
    loadedUrlLedgerRef.current = ledgerId;
    void loadStatement(ledgerId);
  }, [searchParams, allLedgers.length, loadStatement]);

  const partyOptions = sourceMode === 'debtor' ? customerOptions : supplierOptions;

  const handleSelectionChange = () => {
    clearStatementView();
    if (searchParams.has('ledgerId') || searchParams.has('customerId')) {
      setSearchParams({}, { replace: true });
    }
  };

  const handleViewLedger = () => {
    if (!activeLedgerId) return;
    loadedUrlLedgerRef.current = activeLedgerId;
    setSearchParams({ ledgerId: activeLedgerId }, { replace: true });
    void loadStatement(activeLedgerId);
  };

  const statementMatchesSelection =
    Boolean(statement && viewedLedgerId && activeLedgerId && viewedLedgerId === activeLedgerId);
  const statementTitle = statementMatchesSelection ? statement!.ledger.name : displayName;

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>
        Ledger Report
      </Typography>

      {loadError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
          {loadError}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Ledger Source</InputLabel>
              <Select
                label="Ledger Source"
                value={sourceMode}
                onChange={(e) => {
                  setSourceMode(e.target.value as SourceMode);
                  setSelectedPartyId('');
                  setSelectedLedgerId('');
                  clearStatementView();
                  setSearchParams({}, { replace: true });
                }}
              >
                <MenuItem value="any">Any Ledger</MenuItem>
                <MenuItem value="debtor">Debtor</MenuItem>
                <MenuItem value="creditor">Creditor</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={5}>
            {sourceMode === 'any' ? (
              <Autocomplete
                size="small"
                options={allLedgers}
                loading={loadingLists}
                value={selectedLedger}
                onChange={(_, ledger) => {
                  setSelectedLedgerId(ledger?.id ?? '');
                  handleSelectionChange();
                }}
                getOptionLabel={(l) => l.name}
                renderOption={(props, l) => (
                  <li {...props} key={l.id}>
                    <Stack>
                      <Typography variant="body2">{l.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {buildGroupPath(l.groupId, groups)}
                      </Typography>
                    </Stack>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField {...params} label="Select Ledger" placeholder="Search any ledger account…" />
                )}
              />
            ) : (
              <PartyPickerField
                size="small"
                label={sourceMode === 'debtor' ? 'Debtor' : 'Creditor'}
                displayValue={selectedParty?.name ?? ''}
                placeholder={loadingLists ? 'Loading…' : 'Search by name…'}
                disabled={loadingLists}
                onOpen={() => setPartyPickerOpen(true)}
                helperText={!loadingLists && partyOptions.length === 0 ? 'No parties found.' : undefined}
              />
            )}
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField label="From Date" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); clearStatementView(); }} fullWidth size="small" InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField label="To Date" type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); clearStatementView(); }} fullWidth size="small" InputLabelProps={{ shrink: true }} />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => { setSelectedPartyId(''); setSelectedLedgerId(''); setFromDate(''); setToDate(''); clearStatementView(); setSearchParams({}, { replace: true }); }}>
                Clear
              </Button>
              <Button variant="contained" disabled={!activeLedgerId || ledgerLoading} onClick={handleViewLedger}>
                {ledgerLoading ? 'Loading…' : 'View Statement'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {ledgerError ? <Alert severity="error" sx={{ mb: 2 }}>{ledgerError}</Alert> : null}

      {ledgerLoading ? (
        <Stack alignItems="center" py={4}><CircularProgress size={28} /></Stack>
      ) : statementMatchesSelection && statement ? (
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              {statement.ledger.name} — Ledger Statement
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" startIcon={<FileDownloadIcon />} onClick={() => exportLedgerCsv(statement, `ledger-${statement.ledger.name.replace(/\W+/g, '_')}.csv`)}>
                Export CSV
              </Button>
              <Button size="small" startIcon={<PictureAsPdfIcon />} onClick={() => exportLedgerPdf(statement, `${statement.ledger.name} Ledger`)}>
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
                  <TableCell>
                    <VoucherNumberLink
                      voucherId={t.voucherId}
                      voucherType={t.voucherType}
                      voucherNumber={(t.meta as { voucherNumber?: string } | undefined)?.voucherNumber}
                    />
                  </TableCell>
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
      ) : (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {!activeLedgerId
              ? 'Select a ledger and click View Statement to load the statement.'
              : `Click View Statement to load the ledger statement for ${statementTitle}.`}
          </Typography>
        </Paper>
      )}

      <PartyPickerModal
        open={partyPickerOpen}
        onClose={() => setPartyPickerOpen(false)}
        scope={sourceMode === 'debtor' ? 'debtor' : 'creditor'}
        title={sourceMode === 'debtor' ? 'Select Debtor' : 'Select Creditor'}
        onSelect={(ledger) => {
          setPartyPickerOpen(false);
          const match = partyOptions.find((o) => o.ledgerId === ledger.id);
          setSelectedPartyId(match?.partyId ?? '');
          handleSelectionChange();
        }}
      />
    </Box>
  );
}
