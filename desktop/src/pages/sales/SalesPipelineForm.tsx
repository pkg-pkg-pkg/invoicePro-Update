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
import { salesKindFromParam, salesNavForKind } from '../../config/salesModuleNav';
import { SalesPipelineLineItemsTable } from '../../components/sales/SalesPipelineLineItemsTable';
import { salesPipelineService } from '../../services/sales/salesDocumentService';
import { calcSalesDocumentTotals } from '../../services/sales/salesPipelineCalc';
import { partyService } from '../../services/masters/partyService';
import { inventoryItemService } from '../../services/masters/inventoryItemService';
import type { InventoryItem } from '../../types/masters';
import type { Party } from '../../types/party';
import type { SalesDocKind, SalesDocumentStatus, SalesPipelineDocument, SalesPipelineHeader, SalesPipelineLineItem } from '../../types/salesDocuments';
import { formatCurrency } from '../../utils/formatters';
import { INDIAN_STATES } from '../../utils/constants';
import { generateId } from '../../utils/id';

const PIPELINE_KINDS = new Set<SalesDocKind>(['quotations', 'proforma', 'sales-orders', 'dispatch', 'recurring']);

const STATUS_OPTIONS: Record<string, { value: SalesDocumentStatus; label: string }[]> = {
  quotations: [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'SENT', label: 'Sent' },
    { value: 'ACCEPTED', label: 'Accepted' },
    { value: 'DECLINED', label: 'Declined' },
    { value: 'EXPIRED', label: 'Expired' },
  ],
  proforma: [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'SENT', label: 'Sent' },
    { value: 'PAYMENT_RECEIVED', label: 'Payment Received' },
    { value: 'CONVERTED', label: 'Converted' },
  ],
  'sales-orders': [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'PARTIALLY_DISPATCHED', label: 'Partially Dispatched' },
    { value: 'DISPATCHED', label: 'Dispatched' },
    { value: 'CLOSED', label: 'Closed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ],
};

const TITLES: Record<string, string> = {
  quotations: 'New Quotation',
  proforma: 'New Proforma Invoice',
  'sales-orders': 'New Sales Order',
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
    qtyDispatched: 0,
    qtyPending: 1,
  };
}

export default function SalesPipelineForm() {
  const { docKind, id } = useParams<{ docKind: string; id?: string }>();
  const kind = salesKindFromParam(docKind);
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const nav = kind ? salesNavForKind(kind) : null;

  const [customers, setCustomers] = useState<Party[]>([]);
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const docIdRef = useRef<string | null>(id ?? null);

  const [number, setNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<SalesDocumentStatus>('DRAFT');
  const [notes, setNotes] = useState('');
  const [header, setHeader] = useState<SalesPipelineHeader>({});
  const [lines, setLines] = useState<SalesPipelineLineItem[]>([emptyLine()]);
  const [roundOffEnabled, setRoundOffEnabled] = useState(false);

  const patchHeader = (patch: Partial<SalesPipelineHeader>) => setHeader((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    void Promise.all([
      partyService.listForSales(),
      inventoryItemService.list({ includeInactive: false }),
    ]).then(([parties, items]) => {
      setCustomers(parties);
      setCatalog(items);
    });
  }, []);

  useEffect(() => {
    if (!kind || !PIPELINE_KINDS.has(kind)) return;
    const boot = async () => {
      if (isEdit && id) {
        const doc = await salesPipelineService.getById(id);
        if (!doc) {
          setError('Document not found');
          return;
        }
        docIdRef.current = doc.id;
        setNumber(doc.number);
        setCustomerId(doc.customerId ?? '');
        setCustomerName(doc.customerName);
        setDate(doc.date);
        setDueDate(doc.dueDate ?? '');
        setStatus(doc.status);
        setNotes(doc.notes ?? '');
        setHeader(doc.header ?? {});
        setLines(doc.lines?.length ? doc.lines : [emptyLine()]);
      } else {
        setNumber(await salesPipelineService.nextNumber(kind));
      }
    };
    void boot();
  }, [kind, id, isEdit]);

  const totals = useMemo(
    () =>
      calcSalesDocumentTotals(lines, {
        freight: header.freightCharges,
        insurance: header.insurance,
        roundOff: roundOffEnabled ? header.roundOff : 0,
        placeOfSupply: header.placeOfSupply ?? undefined,
      }),
    [lines, header, roundOffEnabled]
  );

  const pickCustomer = (partyId: string) => {
    setCustomerId(partyId);
    const party = customers.find((p) => p.id === partyId);
    if (!party) return;
    setCustomerName(party.name);
    const addr = [party.address, party.city, party.state, party.pincode].filter(Boolean).join(', ');
    patchHeader({
      customerGstin: party.gstin ?? '',
      billingAddress: addr,
      shippingAddress: addr,
      placeOfSupply: party.state ?? header.placeOfSupply,
      paymentTerms: header.paymentTerms ?? 'Due on Receipt',
    });
  };

  const buildPayload = (): Partial<SalesPipelineDocument> => ({
    kind: kind!,
    number: number.trim(),
    customerId: customerId || null,
    customerName: customerName.trim(),
    date,
    dueDate: dueDate || header.validUntil || null,
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
      if (!customerName.trim()) {
        setError('Customer is required');
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const payload = buildPayload();
        if (nextStatus) payload.status = nextStatus;
        let saved: SalesPipelineDocument;
        if (docIdRef.current) {
          saved = await salesPipelineService.update(docIdRef.current, payload);
        } else {
          saved = await salesPipelineService.create(payload);
          docIdRef.current = saved.id;
        }
        setLastSaved(new Date().toLocaleTimeString());
        if (nextStatus && nextStatus !== 'DRAFT') {
          navigate(`/sales/${kind}`);
        }
        return saved;
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [kind, customerName, number, customerId, date, dueDate, status, notes, lines, header, totals.grandTotal, navigate]
  );

  useEffect(() => {
    if (!kind || !customerName.trim()) return;
    const timer = window.setInterval(() => {
      void saveDocument();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [kind, customerName, saveDocument]);

  if (!kind || !PIPELINE_KINDS.has(kind) || !nav) {
    return <Alert severity="warning">This document type uses a dedicated voucher form.</Alert>;
  }

  const title = isEdit ? `Edit ${nav.label}` : TITLES[kind] ?? nav.createLabel;
  const statusOptions = STATUS_OPTIONS[kind] ?? STATUS_OPTIONS.quotations;

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
          <Button onClick={() => navigate(`/sales/${kind}`)}>Cancel</Button>
          <Button variant="outlined" disabled={saving} onClick={() => void saveDocument('DRAFT')}>Save Draft</Button>
          {kind === 'quotations' ? (
            <Button variant="contained" disabled={saving} onClick={() => void saveDocument('SENT')}>Send to Customer</Button>
          ) : null}
          {kind === 'sales-orders' ? (
            <Button variant="contained" disabled={saving} onClick={() => void saveDocument('CONFIRMED')}>Confirm Order</Button>
          ) : null}
          {kind === 'proforma' ? (
            <Button variant="contained" disabled={saving} onClick={() => void saveDocument('SENT')}>Send</Button>
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
              <InputLabel>Customer</InputLabel>
              <Select label="Customer" value={customerId} onChange={(e) => pickCustomer(e.target.value)}>
                {customers.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth size="small" label="Customer GSTIN" value={header.customerGstin ?? ''} onChange={(e) => patchHeader({ customerGstin: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Billing Address" multiline minRows={2} value={header.billingAddress ?? ''} onChange={(e) => patchHeader({ billingAddress: e.target.value })} />
          </Grid>
          {(kind === 'proforma' || kind === 'sales-orders') ? (
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Shipping Address" multiline minRows={2} value={header.shippingAddress ?? ''} onChange={(e) => patchHeader({ shippingAddress: e.target.value })} />
            </Grid>
          ) : null}
          {kind === 'quotations' ? (
            <>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" type="date" label="Valid Until" InputLabelProps={{ shrink: true }} value={header.validUntil ?? dueDate} onChange={(e) => { patchHeader({ validUntil: e.target.value }); setDueDate(e.target.value); }} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" label="Reference No." value={header.referenceNo ?? ''} onChange={(e) => patchHeader({ referenceNo: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" label="Salesperson" value={header.salesperson ?? ''} onChange={(e) => patchHeader({ salesperson: e.target.value })} />
              </Grid>
            </>
          ) : null}
          {kind === 'proforma' ? (
            <>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" type="date" label="Due Date" InputLabelProps={{ shrink: true }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" label="PO Reference No." value={header.poReference ?? ''} onChange={(e) => patchHeader({ poReference: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" label="Delivery Terms" value={header.deliveryTerms ?? ''} onChange={(e) => patchHeader({ deliveryTerms: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" label="Payment Terms" value={header.paymentTerms ?? ''} onChange={(e) => patchHeader({ paymentTerms: e.target.value })} />
              </Grid>
            </>
          ) : null}
          {kind === 'sales-orders' ? (
            <>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" type="date" label="Expected Delivery" InputLabelProps={{ shrink: true }} value={header.expectedDeliveryDate ?? ''} onChange={(e) => patchHeader({ expectedDeliveryDate: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" label="Customer PO No." value={header.customerPoNo ?? ''} onChange={(e) => patchHeader({ customerPoNo: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" type="date" label="Customer PO Date" InputLabelProps={{ shrink: true }} value={header.customerPoDate ?? ''} onChange={(e) => patchHeader({ customerPoDate: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" label="Delivery Method" value={header.deliveryMethod ?? ''} onChange={(e) => patchHeader({ deliveryMethod: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Source</InputLabel>
                  <Select label="Source" value={header.source ?? ''} onChange={(e) => patchHeader({ source: e.target.value })}>
                    {['Quotation', 'Direct', 'Website', 'Phone', 'WhatsApp'].map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" label="Linked Quotation No." value={header.linkedQuotationNo ?? ''} onChange={(e) => patchHeader({ linkedQuotationNo: e.target.value })} />
              </Grid>
            </>
          ) : null}
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
        showHsn={kind === 'proforma' || kind === 'sales-orders'}
        showStock={kind === 'sales-orders'}
        showFulfillment={kind === 'sales-orders'}
        onChange={setLines}
      />

      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <TextField fullWidth size="small" label="Terms & Conditions" multiline minRows={3} value={header.termsAndConditions ?? ''} onChange={(e) => patchHeader({ termsAndConditions: e.target.value })} sx={{ mb: 2 }} />
            <TextField fullWidth size="small" label={kind === 'sales-orders' ? 'Special Instructions' : 'Notes for customer'} multiline minRows={2} value={kind === 'sales-orders' ? header.specialInstructions ?? '' : header.customerNotes ?? notes} onChange={(e) => kind === 'sales-orders' ? patchHeader({ specialInstructions: e.target.value }) : setNotes(e.target.value)} />
            {kind === 'proforma' ? (
              <TextField fullWidth size="small" label="Bank Details" multiline minRows={2} sx={{ mt: 2 }} value={header.bankDetails ?? ''} onChange={(e) => patchHeader({ bankDetails: e.target.value })} />
            ) : null}
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between"><Typography>Subtotal</Typography><Typography>{formatCurrency(totals.subtotal)}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography>Total Discount</Typography><Typography>{formatCurrency(totals.totalDiscount)}</Typography></Stack>
              {(kind === 'proforma' || kind === 'sales-orders') ? (
                <>
                  <TextField size="small" type="number" label="Freight (₹)" value={header.freightCharges ?? 0} onChange={(e) => patchHeader({ freightCharges: Number(e.target.value) })} />
                  {kind === 'proforma' ? (
                    <TextField size="small" type="number" label="Insurance (₹)" value={header.insurance ?? 0} onChange={(e) => patchHeader({ insurance: Number(e.target.value) })} />
                  ) : null}
                </>
              ) : null}
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
