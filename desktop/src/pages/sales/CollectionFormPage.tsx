import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  MenuItem,
} from '@mui/material';
import dayjs from 'dayjs';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { customersApi } from '../../services/customers/customersApi';
import { PARTIES_CHANGED_EVENT, partyService } from '../../services/masters/partyService';
import { ledgerAccountService } from '../../services/masters/ledgerAccountService';
import { voucherService } from '../../services/vouchers/voucherService';
import { billReferenceService } from '../../services/settlement/billReferenceService';
import type { PartySettlementInput } from '../../types/billReference';
import { fetchOutstandingInvoices, type OutstandingInvoice } from '../../services/payments/paymentService';
import type { Party } from '../../types/party';
import type { LedgerAccount } from '../../types/masters';
import { formatCurrency } from '../../utils/formatters';
import { PartyPickerModal } from '../../components/parties/PartyPickerModal';
import { PartyPickerField } from '../../components/parties/PartyPickerField';

const PAYMENT_MODES = ['Cash', 'Bank', 'UPI', 'Cheque', 'NEFT'] as const;

export default function CollectionFormPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(editId);

  const [customers, setCustomers] = useState<Party[]>([]);
  const [bankAccounts, setBankAccounts] = useState<LedgerAccount[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Party | null>(null);
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debtorPickerOpen, setDebtorPickerOpen] = useState(false);

  const [form, setForm] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    number: `REC-${dayjs().format('YYYYMMDD-HHmmss')}`,
    paymentMode: 'Cash' as (typeof PAYMENT_MODES)[number],
    bankAccountId: '',
    referenceNo: '',
    narration: '',
  });

  const loadCustomers = useCallback(async () => {
    try {
      const rows = await customersApi.list('ALL');
      setCustomers(rows);
    } catch {
      setCustomers([]);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    const onPartiesChanged = () => void loadCustomers();
    window.addEventListener(PARTIES_CHANGED_EVENT, onPartiesChanged);
    return () => window.removeEventListener(PARTIES_CHANGED_EVENT, onPartiesChanged);
  }, [loadCustomers]);

  useEffect(() => {
    void ledgerAccountService.list({ includeInactive: false }).then((rows) => {
      setBankAccounts(
        rows.filter(
          (l) =>
            l.isCashBank ||
            l.groupId === 'grp-cash-in-hand' ||
            l.groupId === 'grp-bank-accounts' ||
            l.groupId === 'grp-cash-bank'
        )
      );
    });
  }, []);

  useEffect(() => {
    const customerId = searchParams.get('customerId');
    if (!customerId || !customers.length) return;
    const found = customers.find((c) => c.id === customerId || c.ledgerId === customerId);
    if (found) setSelectedCustomer(found);
  }, [customers, searchParams]);

  const loadInvoices = useCallback(async (party: Party) => {
    let ledgerId = party.ledgerId ?? (await customersApi.getById(party.id))?.ledgerId;
    if (!ledgerId) {
      ledgerId = (await partyService.ensureLedgerForParty(party.id)) ?? undefined;
    }
    if (!ledgerId) {
      setInvoices([]);
      return;
    }
    setLoadingInvoices(true);
    try {
      const rows = await fetchOutstandingInvoices(ledgerId, 'CUSTOMER');
      const preselect = searchParams.get('invoiceId');
      setInvoices(
        rows.map((inv) => ({
          ...inv,
          isSelected: preselect ? inv.id === preselect || inv.number === preselect : false,
          paymentAmount: 0,
        }))
      );
    } catch (e) {
      setError((e as Error).message);
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedCustomer) void loadInvoices(selectedCustomer);
    else setInvoices([]);
  }, [selectedCustomer, loadInvoices]);

  const selectedTotal = useMemo(
    () =>
      invoices
        .filter((inv) => inv.isSelected)
        .reduce((sum, inv) => sum + Number(inv.paymentAmount || inv.balanceAmount || 0), 0),
    [invoices]
  );

  const cashOrBankLedger = useMemo(() => {
    if (form.paymentMode === 'Cash') {
      return bankAccounts.find((l) => String(l.name).toLowerCase() === 'cash') ?? bankAccounts[0] ?? null;
    }
    return bankAccounts.find((l) => l.id === form.bankAccountId) ?? null;
  }, [bankAccounts, form.bankAccountId, form.paymentMode]);

  const partyLedger = useMemo(() => {
    if (!selectedCustomer?.ledgerId) return null;
    return { id: selectedCustomer.ledgerId, name: selectedCustomer.name };
  }, [selectedCustomer]);

  const toggleInvoice = (id: string, checked: boolean) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id
          ? {
              ...inv,
              isSelected: checked,
              paymentAmount: checked ? Number(inv.balanceAmount || 0) : 0,
            }
          : inv
      )
    );
  };

  const handleSave = async () => {
    if (!selectedCustomer || !partyLedger || !cashOrBankLedger) {
      setError('Select customer and ensure cash/bank account is available.');
      return;
    }
    const amount = Number(selectedTotal.toFixed(2));
    if (amount <= 0) {
      setError('Select at least one invoice with amount > 0.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const invoiceAllocTokens = invoices
        .filter((inv) => inv.isSelected && Number(inv.paymentAmount || 0) > 0)
        .map((inv) => `INVALLOC[${inv.number}]=${Number(inv.paymentAmount || 0).toFixed(2)}`);
      const refToken = form.referenceNo.trim() ? `REF[${form.referenceNo.trim()}]` : '';
      const modeToken = `MODE[${form.paymentMode}]`;
      const settleToken = 'SETTLEMODE=AGAINST_REF';
      const narration = [form.narration.trim(), modeToken, settleToken, refToken, ...invoiceAllocTokens].filter(Boolean).join(' ');

      const payload = {
        type: 'RECEIPT' as const,
        number: form.number,
        date: `${form.date}T12:00:00.000Z`,
        narration,
        lines: [
          { ledgerId: cashOrBankLedger.id, debit: amount, credit: 0 },
          { ledgerId: partyLedger.id, debit: 0, credit: amount },
        ],
        status: 'ACTIVE' as const,
      };

      const allocations = invoices
        .filter((inv) => inv.isSelected && Number(inv.paymentAmount || 0) > 0)
        .map((inv) => ({ referenceId: inv.id, amount: Number(inv.paymentAmount || 0) }));

      const settlement: PartySettlementInput = {
        partyId: partyLedger.id,
        partyType: 'CUSTOMER',
        mode: 'AGAINST_REF',
        totalAmount: amount,
        allocations,
      };

      let saved;
      if (isEdit && editId) {
        saved = await voucherService.update(editId, payload, { settlements: [settlement] });
      } else {
        saved = await voucherService.create(payload, { settlements: [settlement] });
      }

      navigate('/sales/collections');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>
        {isEdit ? 'Edit Collection' : 'Record Collection'}
      </Typography>
      {error ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert> : null}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <PartyPickerField
              label="Debtor *"
              size="small"
              displayValue={selectedCustomer?.name ?? ''}
              placeholder="Search debtors…"
              onOpen={() => setDebtorPickerOpen(true)}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField label="Collection Date" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField label="Receipt No." size="small" fullWidth value={form.number} onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))} />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField select label="Payment Mode" size="small" fullWidth value={form.paymentMode} onChange={(e) => setForm((p) => ({ ...p, paymentMode: e.target.value as typeof form.paymentMode }))}>
              {PAYMENT_MODES.map((m) => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </TextField>
          </Grid>
          {form.paymentMode !== 'Cash' ? (
            <Grid item xs={12} md={4}>
              <TextField select label="Bank Account" size="small" fullWidth value={form.bankAccountId} onChange={(e) => setForm((p) => ({ ...p, bankAccountId: e.target.value }))}>
                {bankAccounts.map((b) => (
                  <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
          ) : null}
          <Grid item xs={12} md={4}>
            <TextField label="Reference / UTR No." size="small" fullWidth value={form.referenceNo} onChange={(e) => setForm((p) => ({ ...p, referenceNo: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Narration" size="small" fullWidth multiline minRows={2} value={form.narration} onChange={(e) => setForm((p) => ({ ...p, narration: e.target.value }))} />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Outstanding Invoices
        </Typography>
        {loadingInvoices ? (
          <Typography variant="body2" color="text.secondary">Loading invoices…</Typography>
        ) : !selectedCustomer ? (
          <Typography variant="body2" color="text.secondary">Select a debtor to view unpaid invoices.</Typography>
        ) : invoices.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No outstanding invoices for this debtor.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Invoice No.</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Balance Due</TableCell>
                <TableCell align="right">Collect</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell padding="checkbox">
                    <Checkbox checked={inv.isSelected} onChange={(e) => toggleInvoice(inv.id, e.target.checked)} />
                  </TableCell>
                  <TableCell>{inv.number}</TableCell>
                  <TableCell>{inv.date}</TableCell>
                  <TableCell align="right">{formatCurrency(inv.totalAmount)}</TableCell>
                  <TableCell align="right">{formatCurrency(inv.balanceAmount)}</TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      sx={{ width: 120 }}
                      disabled={!inv.isSelected}
                      value={inv.isSelected ? inv.paymentAmount || inv.balanceAmount : 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setInvoices((prev) => prev.map((row) => (row.id === inv.id ? { ...row, paymentAmount: val, isSelected: val > 0 } : row)));
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Typography variant="body2" fontWeight={700} sx={{ mt: 1 }}>
          Total selected: {formatCurrency(selectedTotal)}
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Transaction Details
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Account (Bank/Cash)</TableCell>
              <TableCell>Particulars (Party)</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Dr</TableCell>
              <TableCell align="right">Cr</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>{cashOrBankLedger?.name ?? '—'}</TableCell>
              <TableCell>{partyLedger?.name ?? '—'}</TableCell>
              <TableCell align="right">{formatCurrency(selectedTotal)}</TableCell>
              <TableCell align="right">{formatCurrency(selectedTotal)}</TableCell>
              <TableCell align="right">—</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>{partyLedger?.name ?? '—'}</TableCell>
              <TableCell>{cashOrBankLedger?.name ?? '—'}</TableCell>
              <TableCell align="right">{formatCurrency(selectedTotal)}</TableCell>
              <TableCell align="right">—</TableCell>
              <TableCell align="right">{formatCurrency(selectedTotal)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button onClick={() => navigate('/sales/collections')}>Cancel</Button>
        <Button variant="contained" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save Collection'}
        </Button>
      </Stack>

      <PartyPickerModal
        open={debtorPickerOpen}
        onClose={() => setDebtorPickerOpen(false)}
        scope="debtor"
        title="Select Debtor"
        onSelect={(ledger) => {
          setDebtorPickerOpen(false);
          const match = customers.find((c) => c.ledgerId === ledger.id);
          if (match) setSelectedCustomer(match);
        }}
      />
    </Box>
  );
}
