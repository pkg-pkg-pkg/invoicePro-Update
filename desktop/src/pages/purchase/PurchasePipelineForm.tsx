import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { purchaseKindFromParam, purchaseNavForKind } from '../../config/purchaseModuleNav';
import { SalesPipelineLineItemsTable } from '../../components/sales/SalesPipelineLineItemsTable';
import { purchasePipelineService } from '../../services/purchase/purchasePipelineService';
import { calcSalesDocumentTotals } from '../../services/sales/salesPipelineCalc';
import { partyService } from '../../services/masters/partyService';
import { inventoryItemService } from '../../services/masters/inventoryItemService';
import type { InventoryItem } from '../../types/masters';
import type { Party } from '../../types/party';
import type { PurchaseDocKind, PurchasePipelineDocument, PurchasePipelineHeader } from '../../types/purchaseDocuments';
import type { SalesDocumentStatus, SalesPipelineLineItem } from '../../types/salesDocuments';
import { formatCurrency } from '../../utils/formatters';
import { INDIAN_STATES } from '../../utils/constants';
import { generateId } from '../../utils/id';

const PIPELINE_KINDS = new Set<PurchaseDocKind>(['purchase-orders', 'recurring-bills']);

const STATUS_OPTIONS: Record<string, { value: SalesDocumentStatus; label: string }[]> = {
  'purchase-orders': [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'SENT', label: 'Sent to Vendor' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'CLOSED', label: 'Closed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ],
  'recurring-bills': [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'APPROVED', label: 'Active' },
    { value: 'CANCELLED', label: 'Paused' },
  ],
};

const TITLES: Record<string, string> = {
  'purchase-orders': 'New Purchase Order',
  'recurring-bills': 'New Recurring Bill',
};

function emptyLine(): SalesPipelineLineItem {
  return {
    id: generateId('line'),
    itemName: '',
    description: '',
    hsnCode: '',
    qty: 1,
    unit: 'pcs',
    rate: 0,
    discountPercent: 0,
    gstPercent: 18,
    amount: 0,
  };
}

export default function PurchasePipelineForm() {
  const { docKind, id } = useParams<{ docKind: string; id?: string }>();
  const kind = purchaseKindFromParam(docKind);
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const nav = kind ? purchaseNavForKind(kind) : null;

  const [vendors, setVendors] = useState<Party[]>([]);
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const docIdRef = useRef<string | null>(id ?? null);

  const [number, setNumber] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<SalesDocumentStatus>('DRAFT');
  const [notes, setNotes] = useState('');
  const [header, setHeader] = useState<PurchasePipelineHeader>({});
  const [lines, setLines] = useState<SalesPipelineLineItem[]>([emptyLine()]);
  const [roundOffEnabled, setRoundOffEnabled] = useState(false);

  const patchHeader = (patch: Partial<PurchasePipelineHeader>) => setHeader((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    void Promise.all([
      partyService.listForPurchase(),
      inventoryItemService.list({ includeInactive: false }),
    ]).then(([parties, items]) => {
      setVendors(parties);
      setCatalog(items);
    });
  }, []);

  useEffect(() => {
    if (!kind || !PIPELINE_KINDS.has(kind)) return;
    const boot = async () => {
      if (isEdit && id) {
        const doc = await purchasePipelineService.getById(id);
        if (!doc) {
          setError('Document not found');
          return;
        }
        docIdRef.current = doc.id;
        setNumber(doc.number);
        setVendorId(doc.vendorId ?? '');
        setVendorName(doc.vendorName);
        setDate(doc.date);
        setDueDate(doc.dueDate ?? '');
        setStatus(doc.status);
        setNotes(doc.notes ?? '');
        setHeader(doc.header ?? {});
        setLines(doc.lines?.length ? doc.lines : [emptyLine()]);
      } else {
        setNumber(await purchasePipelineService.nextNumber(kind));
      }
    };
    void boot();
  }, [kind, id, isEdit]);

  const totals = useMemo(
    () =>
      calcSalesDocumentTotals(lines, {
        freight: header.freightCharges,
        roundOff: roundOffEnabled ? header.roundOff : 0,
        placeOfSupply: header.placeOfSupply ?? undefined,
      }),
    [lines, header, roundOffEnabled]
  );

  const pickVendor = (partyId: string) => {
    setVendorId(partyId);
    const party = vendors.find((p) => p.id === partyId);
    if (!party) return;
    setVendorName(party.name);
    const addr = [party.address, party.city, party.state, party.pincode].filter(Boolean).join(', ');
    patchHeader({
      vendorGstin: party.gstin ?? '',
      billingAddress: addr,
      placeOfSupply: party.state ?? header.placeOfSupply,
      paymentTerms: header.paymentTerms ?? 'Due on Receipt',
    });
  };

  const buildPayload = (): Partial<PurchasePipelineDocument> => ({
    kind: kind!,
    number: number.trim(),
    vendorId: vendorId || null,
    vendorName: vendorName.trim(),
    date,
    dueDate: dueDate || null,
    status,
    notes,
    lines,
    header: {
      ...header,
      roundOff: roundOffEnabled ? header.roundOff ?? 0 : 0,
    },
    grandTotal: totals.grandTotal,
    amount: totals.grandTotal,
  });

  const saveDocument = useCallback(
    async (nextStatus?: SalesDocumentStatus) => {
      if (!kind) return;
      if (!vendorName.trim()) {
        setError('Vendor is required');
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const payload = buildPayload();
        if (nextStatus) payload.status = nextStatus;
        let saved: PurchasePipelineDocument;
        if (docIdRef.current) {
          saved = await purchasePipelineService.update(docIdRef.current, payload);
        } else {
          saved = await purchasePipelineService.create(payload);
          docIdRef.current = saved.id;
        }
        setLastSaved(new Date().toLocaleTimeString());
        if (nextStatus && nextStatus !== 'DRAFT') {
          navigate(`/purchase/${kind}`);
        }
        return saved;
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [kind, vendorName, number, vendorId, date, dueDate, status, notes, lines, header, totals.grandTotal, navigate]
  );

  useEffect(() => {
    if (!kind || !vendorName.trim()) return;
    const timer = window.setInterval(() => {
      void saveDocument();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [kind, vendorName, saveDocument]);

  if (!kind || !PIPELINE_KINDS.has(kind) || !nav) {
    return <Alert severity="warning">This document type uses a dedicated voucher form.</Alert>;
  }

  const title = isEdit ? `Edit ${nav.label}` : TITLES[kind] ?? nav.createLabel;
  const statusOptions = STATUS_OPTIONS[kind] ?? STATUS_OPTIONS['purchase-orders'];

  return (
    <Box sx={{ pb: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>{title}</Typography>
          {lastSaved ? (
            <Typography variant="caption" color="text.secondary">Draft auto-saved at {lastSaved}</Typography>
          ) : null}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button onClick={() => navigate(`/purchase/${kind}`)}>Cancel</Button>
          <Button variant="outlined" disabled={saving} onClick={() => void saveDocument('DRAFT')}>Save Draft</Button>
          {kind === 'purchase-orders' ? (
            <Button variant="contained" disabled={saving} onClick={() => void saveDocument('CONFIRMED')}>Confirm PO</Button>
          ) : null}
          {kind === 'recurring-bills' ? (
            <Button variant="contained" disabled={saving} onClick={() => void saveDocument('APPROVED')}>Activate</Button>
          ) : null}
        </Stack>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth size="small" label="Document No." value={number} onChange={(e) => setNumber(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Vendor</InputLabel>
              <Select label="Vendor" value={vendorId} onChange={(e) => pickVendor(e.target.value)}>
                {vendors.map((v) => (
                  <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth size="small" label="Vendor GSTIN" value={header.vendorGstin ?? ''} onChange={(e) => patchHeader({ vendorGstin: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Billing Address" multiline minRows={2} value={header.billingAddress ?? ''} onChange={(e) => patchHeader({ billingAddress: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth size="small" type="date" label="Due Date" InputLabelProps={{ shrink: true }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth size="small" label="Payment Terms" value={header.paymentTerms ?? ''} onChange={(e) => patchHeader({ paymentTerms: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Place of Supply</InputLabel>
              <Select label="Place of Supply" value={header.placeOfSupply ?? ''} onChange={(e) => patchHeader({ placeOfSupply: e.target.value })}>
                {INDIAN_STATES.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as SalesDocumentStatus)}>
                {statusOptions.map((s) => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>Items</Typography>
      <SalesPipelineLineItemsTable
        lines={lines}
        catalog={catalog}
        showHsn
        onChange={setLines}
      />

      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <TextField fullWidth size="small" label="Terms & Conditions" multiline minRows={3} value={header.termsAndConditions ?? ''} onChange={(e) => patchHeader({ termsAndConditions: e.target.value })} sx={{ mb: 2 }} />
            <TextField fullWidth size="small" label="Notes for vendor" multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between"><Typography>Subtotal</Typography><Typography>{formatCurrency(totals.subtotal)}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography>Total Discount</Typography><Typography>{formatCurrency(totals.totalDiscount)}</Typography></Stack>
              <TextField size="small" type="number" label="Freight (₹)" value={header.freightCharges ?? 0} onChange={(e) => patchHeader({ freightCharges: Number(e.target.value) })} />
              <Stack direction="row" justifyContent="space-between"><Typography>CGST</Typography><Typography>{formatCurrency(totals.cgst)}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography>SGST</Typography><Typography>{formatCurrency(totals.sgst)}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography>IGST</Typography><Typography>{formatCurrency(totals.igst)}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography>Round Off</Typography>
                <Button size="small" variant={roundOffEnabled ? 'contained' : 'outlined'} onClick={() => setRoundOffEnabled((v) => !v)}>
                  {roundOffEnabled ? 'On' : 'Off'}
                </Button>
              </Stack>
              <Stack direction="row" justifyContent="space-between"><Typography fontWeight={800}>Grand Total</Typography><Typography fontWeight={800}>{formatCurrency(totals.grandTotal)}</Typography></Stack>
              <Typography variant="caption" color="text.secondary">{totals.amountInWords}</Typography>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
