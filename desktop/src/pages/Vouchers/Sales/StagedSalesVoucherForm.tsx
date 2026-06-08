import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

import PartySelectionPopup from '../../../components/Vouchers/PartySelectionPopup';
import StockItemSelectionPopup from '../../../components/Vouchers/StockItemSelectionPopup';
import ItemAllocationPopup from '../../../components/Vouchers/ItemAllocationPopup';
import QuickCreateLedgerDialog from '../../../components/QuickCreateLedgerDialog';
import {
  Ledger,
  SalesVoucher,
  StockItem,
  VoucherItem,
  calculateGST,
} from '../../../services/vouchers/enhancedVoucherService';
import { enhancedVoucherService } from '../../../services/vouchers/enhancedVoucherService';
import { usePermission } from '../../../hooks/usePermission';
import { normalizeStateToCode } from '../../../utils/stateMapping';
import { getNormalizedCompanyProfile } from '../../../utils/companyProfile';
import { usePincodeAutofill } from '../../../hooks/usePincodeAutofill';
import PincodeTextField from '../../../components/PincodeTextField';

/** Matches the legacy guided sales voucher palette (no third‑party branding). */
const VOUCHER_COLORS = {
  headerBg: '#1F3864',
  headerText: '#FFFFFF',
  tableHeaderBg: '#E8E8E8',
  tableRowEven: '#FFFFFF',
  tableRowOdd: '#F8F8F8',
};

type VoucherStage = 'header' | 'party-selection' | 'party-details' | 'item-entry' | 'review';

type AllocationRow = {
  quantity: number;
  rateExclTax: number;
  rateInclTax: number;
  discPercent: number;
  godownId?: number;
  orderItemId?: number;
};

const steps: { key: VoucherStage; label: string }[] = [
  { key: 'header', label: 'Voucher header' },
  { key: 'party-selection', label: 'Customer' },
  { key: 'party-details', label: 'Bill to' },
  { key: 'item-entry', label: 'Items' },
  { key: 'review', label: 'Review' },
];

function stageIndex(s: VoucherStage): number {
  return steps.findIndex((x) => x.key === s);
}

function allocationRowsToVoucherItems(
  stock: StockItem,
  rows: AllocationRow[],
  startSr: number,
  isInterstate: boolean
): VoucherItem[] {
  const out: VoucherItem[] = [];
  let sr = startSr;
  for (const alloc of rows) {
    const gstRate = stock.gst_rate || 0;
    const taxable = alloc.quantity * alloc.rateExclTax * (1 - alloc.discPercent / 100);
    const gst = calculateGST(taxable, gstRate, isInterstate);
    out.push({
      sr_no: sr,
      item_name: stock.item_name,
      item_code: stock.item_code,
      hsn_code: stock.hsn_code,
      item_id: stock.id,
      godown_id: alloc.godownId,
      order_item_id: alloc.orderItemId,
      quantity: alloc.quantity,
      unit: stock.unit,
      rate_excl_tax: alloc.rateExclTax,
      rate_incl_tax: alloc.rateInclTax,
      disc_percent: alloc.discPercent,
      taxable_amount: taxable,
      gst_rate: gstRate,
      cgst_amount: gst.cgstAmount,
      sgst_amount: gst.sgstAmount,
      igst_amount: gst.igstAmount,
      total_amount: taxable + gst.totalGST,
    });
    sr += 1;
  }
  return out;
}

const StagedSalesVoucherForm: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canCreate = can('create-vouchers');

  const [stage, setStage] = useState<VoucherStage>('header');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [voucherNumber, setVoucherNumber] = useState('');
  const [narration, setNarration] = useState('');

  const [party, setParty] = useState<Ledger | null>(null);
  const [partyDraft, setPartyDraft] = useState({
    gstin: '',
    address: '',
    pin: '',
    city: '',
    district: '',
    state: '',
    phone: '',
    email: '',
  });

  const partyPinAutofill = usePincodeAutofill({
    onFilled: useCallback((addr) => {
      setPartyDraft((prev) => ({
        ...prev,
        city: addr.city,
        district: addr.district,
        state: addr.state,
      }));
    }, []),
  });

  const [lines, setLines] = useState<VoucherItem[]>([]);
  const [showPartyPopup, setShowPartyPopup] = useState(false);
  const [showQuickPartyCreate, setShowQuickPartyCreate] = useState(false);
  const [showStockPopup, setShowStockPopup] = useState(false);
  const [allocStock, setAllocStock] = useState<StockItem | null>(null);
  const [allocTotalQty, setAllocTotalQty] = useState(1);
  const [showAllocPopup, setShowAllocPopup] = useState(false);

  const companyState = getNormalizedCompanyProfile().state || '';
  const isInterstate = useMemo(() => {
    const c = normalizeStateToCode(companyState);
    const p = normalizeStateToCode(partyDraft.state || party?.state);
    if (!c || !p) return false;
    return c !== p;
  }, [companyState, party?.state, partyDraft.state]);

  const applyParty = useCallback((p: Ledger) => {
    setParty(p);
    setPartyDraft({
      gstin: p.gstin || '',
      address: p.address || '',
      pin: '',
      city: p.city || '',
      district: '',
      state: p.state || '',
      phone: p.phone || '',
      email: p.email || '',
    });
  }, []);

  const goNext = () => {
    setError(null);
    const idx = stageIndex(stage);
    if (idx < 0 || idx >= steps.length - 1) return;
    if (stage === 'header' && !date) {
      setError('Date is required.');
      return;
    }
    if (stage === 'party-selection' && !party) {
      setError('Select a customer to continue.');
      return;
    }
    if (stage === 'item-entry' && lines.length === 0) {
      setError('Add at least one line item.');
      return;
    }
    setStage(steps[idx + 1].key);
  };

  const goBack = () => {
    setError(null);
    const idx = stageIndex(stage);
    if (idx <= 0) return;
    setStage(steps[idx - 1].key);
  };

  const openAllocationForStock = (stock: StockItem) => {
    setAllocStock(stock);
    setShowStockPopup(false);
    setShowAllocPopup(true);
  };

  const onAllocationSave = (allocations: AllocationRow[]) => {
    if (!allocStock) return;
    const mapped = allocationRowsToVoucherItems(allocStock, allocations, lines.length + 1, isInterstate);
    setLines((prev) => [...prev, ...mapped]);
    setShowAllocPopup(false);
    setAllocStock(null);
  };

  const removeLineAt = (index: number) => {
    setLines((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((line, i) => ({ ...line, sr_no: i + 1 }));
    });
  };

  const saveVoucher = async () => {
    if (!canCreate || !party?.id) {
      setError('Customer is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const voucher: Omit<SalesVoucher, 'id' | 'created_at' | 'updated_at'> = {
        voucher_type: 'SALES',
        voucher_number: voucherNumber.trim(),
        voucher_date: new Date(date).toISOString(),
        party_id: party.id,
        party_name: party.name,
        party_gstin: partyDraft.gstin || party.gstin,
        party_address: partyDraft.address || party.address,
        party_city: partyDraft.city || party.city,
        party_state: partyDraft.state || party.state,
        party_country: 'India',
        gst_registration_type: party.gst_registration_type,
        place_of_supply: partyDraft.state || party.state,
        exchange_rate: 1,
        sub_total: 0,
        total_cgst: 0,
        total_sgst: 0,
        total_igst: 0,
        total_discount: 0,
        freight_amount: 0,
        freight_taxable: false,
        freight_gst_percent: 0,
        round_off: 0,
        grand_total: 0,
        narration: narration.trim() || undefined,
        status: 'ACTIVE',
      };

      const itemsPayload = lines.map((line) => {
        const { id: _id, voucher_id: _vid, created_at: _c, ...rest } = line;
        return rest;
      });

      await enhancedVoucherService.createVoucher({
        voucher,
        items: itemsPayload,
      });
      navigate('/vouchers/sales');
    } catch (e) {
      setError((e as Error).message ?? 'Failed to save voucher');
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(() => {
    const sub = lines.reduce((s, l) => s + l.taxable_amount, 0);
    const cgst = lines.reduce((s, l) => s + l.cgst_amount, 0);
    const sgst = lines.reduce((s, l) => s + l.sgst_amount, 0);
    const igst = lines.reduce((s, l) => s + l.igst_amount, 0);
    const g = sub + cgst + sgst + igst;
    return { sub, cgst, sgst, igst, grand: g };
  }, [lines]);

  const activeStep = stageIndex(stage);

  if (!canCreate) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">You do not have permission to create vouchers.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 1100, mx: 'auto' }}>
      <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: VOUCHER_COLORS.headerBg, color: VOUCHER_COLORS.headerText }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Sales invoice (guided)
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          Step‑by‑step entry with stock allocation — uses the same local ledger data as the selection dialogs.
        </Typography>
      </Paper>

      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {steps.map((s) => (
          <Step key={s.key}>
            <StepLabel>{s.label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {stage === 'header' && (
        <Stack spacing={2} component={Paper} sx={{ p: 2 }}>
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Voucher number (optional)"
            value={voucherNumber}
            onChange={(e) => setVoucherNumber(e.target.value)}
            placeholder="Leave blank to auto‑generate"
            fullWidth
          />
          <TextField label="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} multiline minRows={2} fullWidth />
        </Stack>
      )}

      {stage === 'party-selection' && (
        <Stack spacing={2} component={Paper} sx={{ p: 2 }}>
          <Typography variant="subtitle1">Customer</Typography>
          {party ? (
            <Typography>
              <strong>{party.name}</strong>
              {party.alias ? ` (${party.alias})` : ''}
            </Typography>
          ) : (
            <Typography color="text.secondary">No customer selected yet.</Typography>
          )}
          <Button variant="contained" onClick={() => setShowPartyPopup(true)}>
            {party ? 'Change customer' : 'Select customer'}
          </Button>
        </Stack>
      )}

      {stage === 'party-details' && (
        <Stack spacing={2} component={Paper} sx={{ p: 2 }}>
          <Typography variant="subtitle1">Bill to details</Typography>
          <TextField label="GSTIN" value={partyDraft.gstin} onChange={(e) => setPartyDraft((p) => ({ ...p, gstin: e.target.value }))} fullWidth />
          <TextField label="Address" value={partyDraft.address} onChange={(e) => setPartyDraft((p) => ({ ...p, address: e.target.value }))} multiline minRows={2} fullWidth />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <PincodeTextField
              label="PIN"
              value={partyDraft.pin}
              onPinChange={(pin) => setPartyDraft((p) => ({ ...p, pin }))}
              autofill={partyPinAutofill}
              fullWidth
            />
            <TextField
              label="City"
              value={partyDraft.city}
              onChange={(e) => {
                partyPinAutofill.clearHighlight('city');
                setPartyDraft((p) => ({ ...p, city: e.target.value }));
              }}
              sx={partyPinAutofill.fieldSx('city')}
              fullWidth
            />
            <TextField
              label="District"
              value={partyDraft.district}
              onChange={(e) => {
                partyPinAutofill.clearHighlight('district');
                setPartyDraft((p) => ({ ...p, district: e.target.value }));
              }}
              sx={partyPinAutofill.fieldSx('district')}
              fullWidth
            />
            <TextField
              label="State"
              value={partyDraft.state}
              onChange={(e) => {
                partyPinAutofill.clearHighlight('state');
                setPartyDraft((p) => ({ ...p, state: e.target.value }));
              }}
              sx={partyPinAutofill.fieldSx('state')}
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Phone" value={partyDraft.phone} onChange={(e) => setPartyDraft((p) => ({ ...p, phone: e.target.value }))} fullWidth />
            <TextField label="Email" value={partyDraft.email} onChange={(e) => setPartyDraft((p) => ({ ...p, email: e.target.value }))} fullWidth />
          </Stack>
        </Stack>
      )}

      {stage === 'item-entry' && (
        <Stack spacing={2} component={Paper} sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1">Line items</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                type="number"
                label="Qty for next item"
                value={allocTotalQty}
                onChange={(e) => setAllocTotalQty(Math.max(0.0001, Number(e.target.value) || 1))}
                sx={{ width: 160 }}
              />
              <Button variant="contained" onClick={() => setShowStockPopup(true)}>
                Add stock item
              </Button>
            </Stack>
          </Stack>

          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: VOUCHER_COLORS.tableHeaderBg }}>
                <TableCell>#</TableCell>
                <TableCell>Item</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Taxable</TableCell>
                <TableCell align="right">GST</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line, idx) => (
                <TableRow key={`${line.sr_no}-${idx}`} sx={{ bgcolor: idx % 2 === 0 ? VOUCHER_COLORS.tableRowEven : VOUCHER_COLORS.tableRowOdd }}>
                  <TableCell>{line.sr_no}</TableCell>
                  <TableCell>{line.item_name}</TableCell>
                  <TableCell align="right">{line.quantity}</TableCell>
                  <TableCell align="right">{line.taxable_amount.toFixed(2)}</TableCell>
                  <TableCell align="right">{(line.cgst_amount + line.sgst_amount + line.igst_amount).toFixed(2)}</TableCell>
                  <TableCell align="right">{line.total_amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Button size="small" color="error" onClick={() => removeLineAt(idx)}>
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {lines.length === 0 && <Typography color="text.secondary">No lines yet. Add a stock item to open allocation.</Typography>}
        </Stack>
      )}

      {stage === 'review' && (
        <Stack spacing={2} component={Paper} sx={{ p: 2 }}>
          <Typography variant="h6">Summary</Typography>
          <Typography>
            Customer: <strong>{party?.name}</strong>
          </Typography>
          <Typography>
            Date: {date} · Lines: {lines.length}
          </Typography>
          <Stack spacing={0.5}>
            <Typography>Taxable: ₹{totals.sub.toFixed(2)}</Typography>
            <Typography>CGST: ₹{totals.cgst.toFixed(2)} · SGST: ₹{totals.sgst.toFixed(2)} · IGST: ₹{totals.igst.toFixed(2)}</Typography>
            <Typography fontWeight={700}>Grand total: ₹{totals.grand.toFixed(2)}</Typography>
          </Stack>
          <Button variant="contained" color="success" disabled={saving || lines.length === 0} onClick={saveVoucher}>
            {saving ? 'Saving…' : 'Save voucher'}
          </Button>
        </Stack>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
        <Button onClick={() => navigate('/vouchers/sales')}>Cancel</Button>
        {activeStep > 0 && (
          <Button variant="outlined" onClick={goBack}>
            Back
          </Button>
        )}
        {activeStep < steps.length - 1 && (
          <Button variant="contained" onClick={goNext}>
            Next
          </Button>
        )}
      </Stack>

      <PartySelectionPopup
        open={showPartyPopup}
        onClose={() => setShowPartyPopup(false)}
        onSelect={(p) => {
          applyParty(p);
          setShowPartyPopup(false);
        }}
        onCreateNew={() => {
          setShowPartyPopup(false);
          setShowQuickPartyCreate(true);
        }}
      />

      <QuickCreateLedgerDialog
        open={showQuickPartyCreate}
        onClose={() => setShowQuickPartyCreate(false)}
        ledgerType="CUSTOMER"
        title="Create New Party"
        onSave={(ledgerId, ledgerName, details) => {
          applyParty({
            id: Number.isFinite(Number(ledgerId)) ? Number(ledgerId) : (ledgerId as any),
            name: ledgerName,
            opening_balance: 0,
            balance_type: 'Dr',
            gstin: details?.gstin ?? '',
            address: details?.address ?? '',
            city: details?.city ?? '',
            state: details?.state ?? '',
            phone: details?.phone ?? '',
            email: details?.email ?? '',
            is_active: true,
          });
          setShowQuickPartyCreate(false);
          setStage('party-details');
        }}
      />

      <StockItemSelectionPopup
        open={showStockPopup}
        onClose={() => setShowStockPopup(false)}
        onSelect={(item) => openAllocationForStock(item)}
        onCreateNew={() => setShowStockPopup(false)}
      />

      <ItemAllocationPopup
        open={showAllocPopup}
        onClose={() => {
          setShowAllocPopup(false);
          setAllocStock(null);
        }}
        onSave={(raw) => onAllocationSave(raw as AllocationRow[])}
        item={allocStock}
        totalQuantity={allocTotalQty}
        partyId={party?.id}
      />
    </Box>
  );
};

export default memo(StagedSalesVoucherForm);
