import { useEffect, useState, FormEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Search as SearchIcon } from '@mui/icons-material';
import Autocomplete from '@mui/material/Autocomplete';

import type { RootState, AppDispatch } from '../store';
import { fetchSuppliers } from '../store/slices/partySlice';

import { docApi, getHostBaseUrl } from '../services/docApi';
import { getAppSettings, getDefaultTodayForEntry, validateTransactionDate } from '../services/appSettingsService';
import { usePermissions } from '../hooks/usePermissions';

type PartyDetails = {
  name: string;
  address: string;
  gstin: string;
  mobile: string;
};

type PurchaseBillItem = {
  id?: any;
  description: string;
  hsn: string;
  qty: number;
  rate: number;
  gstRate: number;
  taxableAmount?: number;
  gstAmount?: number;
  totalAmount?: number;
};

type ReturnItem = {
  id: number;
  description: string;
  hsn: string;
  qty: string;
  rate: string;
  discountPercent: string;
  gstRate: string;
};

type DebitNote = {
  id: number;
  debitNoteNumber: string;
  date: string;
  supplierId?: string;
  createdAt?: string;
  createdById?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedById?: string;
  updatedByName?: string;
  originalBillNumber: string;
  originalBillId?: any;
  originalBillDate?: string;
  originalBillItems: PurchaseBillItem[];
  items: Array<ReturnItem & { taxableAmount: number; gstAmount: number; totalAmount: number; maxQty?: number }>;
  taxableAmountTotal: number;
  gstAmountTotal: number;
  grandTotal: number;
  supplier: PartyDetails;
  amount: number;
  notes?: string;
};

const STORAGE_KEY = 'pve_invoicepro_debit_notes';
const PURCHASE_BILL_STORAGE_KEY = 'pve_invoicepro_purchase_invoices';
const SUPPLIER_STORAGE_KEY = 'pve_suppliers';

const isLanDocsEnabled = () => {
  try {
    return !!getHostBaseUrl();
  } catch {
    return false;
  }
};

const today = () => getDefaultTodayForEntry();

const loadStoredDebitNotes = (): DebitNote[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DebitNote[]) : [];
  } catch {
    return [];
  }
};

const saveStoredDebitNotes = (items: DebitNote[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};

const loadStoredPurchaseBills = (): any[] => {
  try {
    const raw = localStorage.getItem(PURCHASE_BILL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const loadStoredSuppliers = (): any[] => {
  try {
    const raw = localStorage.getItem(SUPPLIER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredSuppliers = (items: any[]) => {
  try {
    localStorage.setItem(SUPPLIER_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};

const syncSupplierDocIfPossible = async (supplierId: string | undefined, supplierName: string, updatedAt?: string) => {
  if (!isLanDocsEnabled()) return;
  const idKey = String(supplierId ?? '').trim();
  if (!idKey) return;
  const suppliers = loadStoredSuppliers();
  const found =
    suppliers.find((s: any) => String(s?.id ?? '') === idKey) ||
    suppliers.find((s: any) => String(s?.name ?? '').trim().toLowerCase() === String(supplierName ?? '').trim().toLowerCase());
  if (!found) return;
  await docApi.upsertDoc('supplier', String(found.id), {
    partyName: String(found?.name ?? ''),
    amount: Number(found?.currentBalance ?? 0) || 0,
    payload: found,
    updatedAt: updatedAt ?? new Date().toISOString(),
  });
};

const toNumber = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const computeReturnItem = (it: ReturnItem, gstEnabled: boolean) => {
  const qty = toNumber(it.qty, 0);
  const rate = toNumber(it.rate, 0);
  const discountPercent = toNumber(it.discountPercent, 0);
  const gstRate = gstEnabled ? toNumber(it.gstRate, 0) : 0;

  const base = qty * rate;
  const discountAmount = base * (discountPercent / 100);
  const taxableAmount = Math.max(0, base - discountAmount);
  const gstAmount = gstEnabled ? taxableAmount * (gstRate / 100) : 0;
  const totalAmount = taxableAmount + gstAmount;
  return { taxableAmount, gstAmount, totalAmount };
};

const updateSupplierBalance = (supplierId: string | undefined, supplierName: string, deltaReducePayable: number) => {
  const suppliers = loadStoredSuppliers();
  const idKey = String(supplierId ?? '').trim();
  const nameKey = String(supplierName ?? '').trim().toLowerCase();
  const idx = suppliers.findIndex((s: any) => (idKey ? String(s?.id ?? '') === idKey : String(s?.name ?? '').trim().toLowerCase() === nameKey));
  if (idx < 0) return;
  const prev = suppliers[idx];
  const prevBal = Number(prev?.currentBalance ?? 0) || 0;
  // Debit Note reduces payable => if your payable is stored as negative, this moves towards 0 (increase balance)
  suppliers[idx] = { ...prev, currentBalance: prevBal + (Number(deltaReducePayable) || 0) };
  saveStoredSuppliers(suppliers);
};

export default function DebitNotes() {
  const dispatch = useDispatch<AppDispatch>();
  const suppliersFromStore = useSelector((state: RootState) => (state as any).parties?.suppliers ?? []);

  const { canAccessFeature } = usePermissions();
  const [appSettings, setAppSettings] = useState(() => getAppSettings());
  const gstEnabled = Boolean(appSettings?.features?.gstEnabled);

  const canCreate = canAccessFeature('create-invoice');
  const canEdit = canAccessFeature('edit-invoice');
  const canDelete = canAccessFeature('delete-invoice');

  useEffect(() => {
    const onSettings = () => setAppSettings(getAppSettings());
    window.addEventListener('appSettingsUpdated', onSettings as any);
    return () => window.removeEventListener('appSettingsUpdated', onSettings as any);
  }, []);

  const [items, setItems] = useState<DebitNote[]>(() => loadStoredDebitNotes());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DebitNote | null>(null);
  const [search, setSearch] = useState('');

  const [currentNumber, setCurrentNumber] = useState(() => {
    const stored = loadStoredDebitNotes();
    const maxId = stored.reduce((m, it) => (Number(it.id) > m ? Number(it.id) : m), 0);
    return maxId + 1;
  });

  const [form, setForm] = useState({
    date: today(),
    originalBillNumber: '',
    supplierId: '',
    supplierName: '',
    supplierAddress: '',
    supplierGstin: '',
    supplierMobile: '',
    notes: '',
  });

  const [loadedBill, setLoadedBill] = useState<any | null>(null);
  const [originalItems, setOriginalItems] = useState<PurchaseBillItem[]>([]);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

  const getAuditActor = () => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return { id: '', name: '' };
      const u = JSON.parse(raw);
      const id = String(u?.id ?? '').trim();
      const name = String(u?.fullName ?? u?.username ?? '').trim();
      return { id, name };
    } catch {
      return { id: '', name: '' };
    }
  };

  useEffect(() => {
    dispatch(fetchSuppliers({ page: 1, limit: 1000 } as any));
  }, [dispatch]);

  useEffect(() => {
    const loadSmart = async () => {
      if (!isLanDocsEnabled()) return;
      try {
        const rows = await docApi.listPayloads<DebitNote>('debit_note');
        if (Array.isArray(rows)) {
          setItems(rows);
          saveStoredDebitNotes(rows);
          const maxId = rows.reduce((m, it) => (Number(it.id) > m ? Number(it.id) : m), 0);
          setCurrentNumber(maxId + 1);
        }
      } catch {
        // ignore
      }

      try {
        const bills = await docApi.listPayloads<any>('purchase_invoice');
        if (Array.isArray(bills)) {
          localStorage.setItem(PURCHASE_BILL_STORAGE_KEY, JSON.stringify(bills));
        }
      } catch {
        // ignore
      }
    };
    loadSmart();
  }, []);

  useEffect(() => {
    if (editing) return;
    const v = String(form.originalBillNumber ?? '').trim();
    if (!v) return;
    const currentLoaded = String((loadedBill as any)?.invoiceNumber ?? '').trim().toLowerCase();
    if (currentLoaded && currentLoaded === v.toLowerCase()) return;
    const t = setTimeout(() => {
      // load when user types
      loadBillByNumber(v);
    }, 350);
    return () => clearTimeout(t);
  }, [form.originalBillNumber, editing, loadedBill]);

  useEffect(() => {
    saveStoredDebitNotes(items);
  }, [items]);

  const openNew = () => {
    if (!canCreate) {
      alert('You do not have permission to create debit notes');
      return;
    }
    setEditing(null);
    setForm({
      date: today(),
      originalBillNumber: '',
      supplierId: '',
      supplierName: '',
      supplierAddress: '',
      supplierGstin: '',
      supplierMobile: '',
      notes: '',
    });
    setLoadedBill(null);
    setOriginalItems([]);
    setReturnItems([]);
    setOpen(true);
  };

  const openEdit = (dn: DebitNote) => {
    if (!canEdit) {
      alert('You do not have permission to edit debit notes');
      return;
    }
    setEditing(dn);
    setForm({
      date: dn.date,
      originalBillNumber: String((dn as any).originalBillNumber ?? ''),
      supplierId: String((dn as any).supplierId ?? ''),
      supplierName: dn.supplier?.name ?? '',
      supplierAddress: dn.supplier?.address ?? '',
      supplierGstin: dn.supplier?.gstin ?? '',
      supplierMobile: dn.supplier?.mobile ?? '',
      notes: dn.notes ?? '',
    });
    setLoadedBill({
      id: (dn as any).originalBillId,
      invoiceNumber: (dn as any).originalBillNumber,
      date: (dn as any).originalBillDate,
    });
    setOriginalItems(Array.isArray((dn as any).originalBillItems) ? ((dn as any).originalBillItems as any[]) : []);
    setReturnItems(
      Array.isArray((dn as any).items)
        ? ((dn as any).items as any[]).map((it: any, idx: number) => ({
            id: Number(it.id) || idx + 1,
            description: String(it.description ?? ''),
            hsn: String(it.hsn ?? ''),
            qty: String(it.qty ?? ''),
            rate: String(it.rate ?? ''),
            discountPercent: String(it.discountPercent ?? ''),
            gstRate: gstEnabled ? String(it.gstRate ?? '') : '0',
          }))
        : []
    );
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  const addReturnItem = () => {
    setReturnItems((prev) => [
      ...prev,
      {
        id: Date.now() + prev.length,
        description: '',
        hsn: '',
        qty: '1',
        rate: '0',
        discountPercent: '0',
        gstRate: gstEnabled ? '0' : '0',
      },
    ]);
  };

  const removeReturnItem = (id: number) => {
    setReturnItems((prev) => prev.filter((it) => it.id !== id));
  };

  const loadBillByNumber = (billNumberRaw: string) => {
    const billNumber = String(billNumberRaw ?? '').trim();
    if (!billNumber) {
      setLoadedBill(null);
      setOriginalItems([]);
      setReturnItems([]);
      setForm((p) => ({
        ...p,
        originalBillNumber: '',
        supplierId: '',
        supplierName: '',
        supplierAddress: '',
        supplierGstin: '',
        supplierMobile: '',
      }));
      return;
    }

    const all = loadStoredPurchaseBills();
    const found = all.find((inv: any) => {
      const invNo = String(inv?.invoiceNumber ?? '').trim().toLowerCase();
      const suppInvNo = String(inv?.supplierInvoiceNumber ?? '').trim().toLowerCase();
      const q = billNumber.toLowerCase();
      return invNo === q || (suppInvNo && suppInvNo === q);
    });

    if (!found) {
      setLoadedBill(null);
      setOriginalItems([]);
      setReturnItems([]);
      setForm((p) => ({ ...p, originalBillNumber: billNumber }));
      return;
    }

    const party = found?.party ?? {};
    const inferredSupplierId =
      String(found?.supplierId ?? '').trim() ||
      String(
        (Array.isArray(suppliersFromStore)
          ? (suppliersFromStore as any[]).find(
              (s: any) => String(s?.name ?? '').trim().toLowerCase() === String(party?.name ?? '').trim().toLowerCase()
            )?.id
          : '')
      ).trim();

    const items: PurchaseBillItem[] = Array.isArray(found?.items)
      ? (found.items as any[]).map((it: any) => ({
          id: it?.id,
          description: String(it?.description ?? ''),
          hsn: String(it?.hsn ?? ''),
          qty: toNumber(it?.qty, 0),
          rate: toNumber(it?.rate ?? it?.purchasePrice ?? 0, 0),
          gstRate: toNumber(it?.gstRate ?? 0, 0),
          taxableAmount: toNumber(it?.taxableAmount ?? 0, 0),
          gstAmount: toNumber(it?.gstAmount ?? 0, 0),
          totalAmount: toNumber(it?.totalAmount ?? 0, 0),
        }))
      : [];

    setLoadedBill(found);
    setOriginalItems(items);
    setReturnItems([]);
    setForm((p) => ({
      ...p,
      originalBillNumber: String(found?.invoiceNumber ?? found?.supplierInvoiceNumber ?? billNumber),
      supplierId: inferredSupplierId,
      supplierName: String(party?.name ?? ''),
      supplierAddress: String(party?.address ?? ''),
      supplierGstin: String(party?.gstin ?? ''),
      supplierMobile: String(party?.mobile ?? ''),
    }));
  };

  const computedReturnItems = returnItems.map((it) => {
    const computed = computeReturnItem(it, gstEnabled);
    const match = originalItems.find(
      (o) =>
        String(o.description ?? '').trim().toLowerCase() === String(it.description ?? '').trim().toLowerCase() &&
        String(o.hsn ?? '').trim().toLowerCase() === String(it.hsn ?? '').trim().toLowerCase()
    );
    const maxQty = match ? toNumber(match.qty, undefined as any) : undefined;
    return { ...it, ...computed, maxQty };
  });

  const totals = computedReturnItems.reduce(
    (acc, it) => {
      acc.taxableAmountTotal += toNumber(it.taxableAmount, 0);
      acc.gstAmountTotal += toNumber(it.gstAmount, 0);
      acc.grandTotal += toNumber(it.totalAmount, 0);
      return acc;
    },
    { taxableAmountTotal: 0, gstAmountTotal: 0, grandTotal: 0 }
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (editing ? !canEdit : !canCreate) {
      alert(`You do not have permission to ${editing ? 'edit' : 'create'} debit notes`);
      return;
    }

    const dv = validateTransactionDate(String(form?.date ?? ''));
    if (!dv.ok) {
      alert(dv.message);
      return;
    }

    if (!String(form.originalBillNumber ?? '').trim()) {
      alert('Old Invoice Number is required');
      return;
    }

    if (!loadedBill) {
      alert('Please enter a valid Old Invoice Number to load the purchase bill');
      return;
    }

    if (!form.supplierName.trim()) {
      alert('Supplier is missing from the loaded purchase bill');
      return;
    }

    if (computedReturnItems.length === 0) {
      alert('Please add at least one return item');
      return;
    }

    for (const it of computedReturnItems) {
      const qty = toNumber(it.qty, 0);
      if (!it.description.trim()) {
        alert('Return item description is required');
        return;
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        alert('Return item qty must be greater than 0');
        return;
      }
      const maxQty = it.maxQty;
      if (typeof maxQty === 'number' && Number.isFinite(maxQty) && qty > maxQty) {
        alert(`Return qty cannot exceed original qty for item: ${it.description}`);
        return;
      }
    }

    const amt = Number(totals.grandTotal || 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert('Grand total must be greater than 0');
      return;
    }

    const nextId = editing ? editing.id : currentNumber;
    const nextNumber = editing ? editing.debitNoteNumber : `DN-${String(currentNumber).padStart(4, '0')}`;

    const nowIso = new Date().toISOString();
    const actor = getAuditActor();
    const createdAt = (editing as any)?.createdAt || nowIso;
    const createdById = (editing as any)?.createdById || actor.id || undefined;
    const createdByName = (editing as any)?.createdByName || actor.name || undefined;

    const next: DebitNote = {
      id: nextId,
      debitNoteNumber: nextNumber,
      date: form.date,
      supplierId: String(form.supplierId || '') || undefined,
      createdAt,
      createdById,
      createdByName,
      updatedAt: nowIso,
      updatedById: actor.id || undefined,
      updatedByName: actor.name || undefined,
      originalBillNumber: String(form.originalBillNumber || '').trim(),
      originalBillId: (loadedBill as any)?.id,
      originalBillDate: String((loadedBill as any)?.date ?? ''),
      originalBillItems: originalItems,
      items: computedReturnItems,
      taxableAmountTotal: totals.taxableAmountTotal,
      gstAmountTotal: totals.gstAmountTotal,
      grandTotal: totals.grandTotal,
      supplier: {
        name: form.supplierName.trim(),
        address: form.supplierAddress.trim(),
        gstin: form.supplierGstin.trim(),
        mobile: form.supplierMobile.trim(),
      },
      amount: amt,
      notes: form.notes?.trim() || '',
    };

    const prevAmount = editing ? Number((editing as any)?.amount ?? 0) || 0 : 0;
    const delta = Number(amt) - Number(prevAmount);
    if (delta !== 0) {
      updateSupplierBalance(String(form.supplierId || '') || undefined, form.supplierName, delta);
      try {
        await syncSupplierDocIfPossible(String(form.supplierId || '') || undefined, form.supplierName, nowIso);
      } catch {
        // ignore
      }
    }

    if (editing) {
      setItems((prev) => prev.map((it) => (String(it.id) === String(editing.id) ? next : it)));
    } else {
      setItems((prev) => [next, ...prev]);
      setCurrentNumber((n) => n + 1);
    }

    if (isLanDocsEnabled()) {
      try {
        await docApi.upsertDoc('debit_note', String(next.id), {
          docNumber: String(next.debitNoteNumber),
          date: String(next.date ?? ''),
          partyName: String(next.supplier?.name ?? ''),
          amount: Number(next.amount ?? next.grandTotal ?? 0) || 0,
          payload: next,
          createdAt: next.createdAt,
          updatedAt: next.updatedAt,
        });
      } catch (err: any) {
        alert(err?.message ?? 'Failed to sync debit note to host');
      }
    }
    close();
  };

  const deleteDebitNote = async (dn: DebitNote) => {
    if (!canDelete) {
      alert('You do not have permission to delete debit notes');
      return;
    }
    const ok = window.confirm(`Delete debit note ${String(dn?.debitNoteNumber ?? '')}?`);
    if (!ok) return;

    const dv = validateTransactionDate(String((dn as any)?.date ?? ''));
    if (!dv.ok) {
      alert(dv.message);
      return;
    }

    const amount = Number(dn?.amount ?? dn?.grandTotal ?? 0) || 0;
    if (amount !== 0) {
      updateSupplierBalance(String(dn?.supplierId ?? '') || undefined, String(dn?.supplier?.name ?? ''), -amount);
      try {
        await syncSupplierDocIfPossible(String(dn?.supplierId ?? '') || undefined, String(dn?.supplier?.name ?? ''), new Date().toISOString());
      } catch {
        // ignore
      }
    }

    setItems((prev) => prev.filter((x) => String(x.id) !== String(dn.id)));
    if (isLanDocsEnabled()) {
      try {
        await docApi.deleteDoc('debit_note', String(dn.id));
      } catch (err: any) {
        alert(err?.message ?? 'Failed to delete debit note from host');
      }
    }
  };

  const filtered = items.filter((dn) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      dn.debitNoteNumber.toLowerCase().includes(s) ||
      String(dn.supplier?.name ?? '').toLowerCase().includes(s)
    );
  });

  const allBillOptions = loadStoredPurchaseBills()
    .flatMap((b: any) => [String(b?.invoiceNumber ?? ''), String(b?.supplierInvoiceNumber ?? '')])
    .map((x: string) => x.trim())
    .filter(Boolean);

  const originalItemOptions = originalItems.map((it) => ({
    label: `${String(it.description ?? '')}${it.hsn ? ` (${String(it.hsn)})` : ''}`.trim(),
    description: String(it.description ?? ''),
    hsn: String(it.hsn ?? ''),
    rate: toNumber(it.rate, 0),
    gstRate: toNumber(it.gstRate, 0),
    qty: toNumber(it.qty, 0),
  }));
 
  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">Debit Notes</Typography>
          <Typography variant="body2" color="textSecondary">
            Create and manage debit notes for supplier purchase returns
          </Typography>
        </Box>
        <Button variant="contained" onClick={openNew} startIcon={<AddIcon />} disabled={!canCreate}>
          New Debit Note
        </Button>
      </Box>
 
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          placeholder="Search by debit note number or supplier name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          fullWidth
        />
      </Paper>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>DN #</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Old Invoice</TableCell>
              <TableCell>Supplier</TableCell>
              <TableCell>Created By</TableCell>
              <TableCell align="right">Amount (₹)</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No debit notes yet.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((dn) => (
                <TableRow key={dn.id} hover>
                  <TableCell>{dn.debitNoteNumber}</TableCell>
                  <TableCell>{new Date(dn.date).toLocaleDateString()}</TableCell>
                  <TableCell>{String((dn as any).originalBillNumber ?? '-') || '-'}</TableCell>
                  <TableCell>{dn.supplier?.name ?? '-'}</TableCell>
                  <TableCell>{String((dn as any).createdByName ?? (dn as any).createdBy ?? '-')}</TableCell>
                  <TableCell align="right">{Number(dn.amount || 0).toFixed(2)}</TableCell>
                  <TableCell align="center">
                    <IconButton onClick={() => openEdit(dn)} size="small" disabled={!canEdit}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton onClick={() => deleteDebitNote(dn)} size="small" disabled={!canDelete}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={close} fullWidth maxWidth="md">
        <DialogTitle>{editing ? 'Edit Debit Note' : 'New Debit Note'}</DialogTitle>
        <DialogContent dividers>
          <Box component="form" onSubmit={handleSubmit} mt={1}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Debit Note Number"
                value={editing ? editing.debitNoteNumber : `DN-${String(currentNumber).padStart(4, '0')}`}
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="Date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Box>

            <Box sx={{ mt: 2 }}>
              <Autocomplete
                freeSolo
                options={allBillOptions}
                value={form.originalBillNumber}
                onChange={(_, value: any) => {
                  const v = String(value ?? '');
                  setForm((p) => ({ ...p, originalBillNumber: v }));
                  loadBillByNumber(v);
                }}
                onInputChange={(_, value) => {
                  setForm((p) => ({ ...p, originalBillNumber: value }));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Old Invoice Number"
                    required
                    onBlur={() => loadBillByNumber(form.originalBillNumber)}
                    InputProps={{
                      ...params.InputProps,
                      readOnly: Boolean(editing),
                    }}
                  />
                )}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 2 }}>
              <TextField label="Supplier" value={form.supplierName} InputProps={{ readOnly: true }} />
              <TextField label="Mobile" value={form.supplierMobile} InputProps={{ readOnly: true }} />
              <TextField label="GSTIN" value={form.supplierGstin} InputProps={{ readOnly: true }} />
              <TextField label="Address" value={form.supplierAddress} InputProps={{ readOnly: true }} />
            </Box>

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Original Purchase Bill Items (Read-only)
              </Typography>
              {originalItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Enter Old Invoice Number to load purchase bill items.
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Description</TableCell>
                        <TableCell>HSN</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">Rate</TableCell>
                        {gstEnabled ? <TableCell align="right">GST %</TableCell> : null}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {originalItems.map((it, idx) => (
                        <TableRow key={String(it.id ?? idx)}>
                          <TableCell>{it.description}</TableCell>
                          <TableCell>{it.hsn}</TableCell>
                          <TableCell align="right">{Number(it.qty || 0)}</TableCell>
                          <TableCell align="right">{Number(it.rate || 0).toFixed(2)}</TableCell>
                          {gstEnabled ? <TableCell align="right">{Number(it.gstRate || 0).toFixed(2)}</TableCell> : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1">Return Items (Editable)</Typography>
              <Button variant="outlined" onClick={addReturnItem} startIcon={<AddIcon />} disabled={!loadedBill}>
                Add Return Item
              </Button>
            </Box>

            {computedReturnItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Add items that represent the actual return.
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Description</TableCell>
                      <TableCell>HSN</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell align="right">Disc %</TableCell>
                      {gstEnabled ? <TableCell align="right">GST %</TableCell> : null}
                      <TableCell align="right">Taxable</TableCell>
                      {gstEnabled ? <TableCell align="right">GST</TableCell> : null}
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {computedReturnItems.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell sx={{ minWidth: 220 }}>
                          <Autocomplete
                            freeSolo
                            options={originalItemOptions}
                            getOptionLabel={(o: any) => String(o?.label ?? o?.description ?? '')}
                            value={it.description}
                            onChange={(_, v: any) => {
                              if (!v) return;
                              const nextDesc = String(v?.description ?? v ?? '');
                              const nextHsn = String(v?.hsn ?? '');
                              const nextRate = String(v?.rate ?? it.rate);
                              const nextGst = String(v?.gstRate ?? it.gstRate);
                              setReturnItems((prev) =>
                                prev.map((x) =>
                                  x.id === it.id
                                    ? { ...x, description: nextDesc, hsn: nextHsn, rate: nextRate, gstRate: nextGst }
                                    : x
                                )
                              );
                            }}
                            onInputChange={(_, v) => {
                              setReturnItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, description: v } : x)));
                            }}
                            renderInput={(params) => <TextField {...params} placeholder="Item" />}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          <TextField
                            value={it.hsn}
                            onChange={(e) =>
                              setReturnItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, hsn: e.target.value } : x)))
                            }
                            placeholder="HSN"
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ minWidth: 90 }}>
                          <TextField
                            type="number"
                            value={it.qty}
                            onChange={(e) =>
                              setReturnItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, qty: e.target.value } : x)))
                            }
                            inputProps={{ min: 0, step: '0.01' }}
                            helperText={typeof it.maxQty === 'number' ? `Max ${it.maxQty}` : ''}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ minWidth: 110 }}>
                          <TextField
                            type="number"
                            value={it.rate}
                            onChange={(e) =>
                              setReturnItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, rate: e.target.value } : x)))
                            }
                            inputProps={{ min: 0, step: '0.01' }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ minWidth: 90 }}>
                          <TextField
                            type="number"
                            value={it.discountPercent}
                            onChange={(e) =>
                              setReturnItems((prev) =>
                                prev.map((x) => (x.id === it.id ? { ...x, discountPercent: e.target.value } : x))
                              )
                            }
                            inputProps={{ min: 0, step: '0.01' }}
                          />
                        </TableCell>
                        {gstEnabled ? (
                          <TableCell align="right" sx={{ minWidth: 90 }}>
                            <TextField
                              type="number"
                              value={it.gstRate}
                              onChange={(e) =>
                                setReturnItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, gstRate: e.target.value } : x)))
                              }
                              inputProps={{ min: 0, step: '0.01' }}
                            />
                          </TableCell>
                        ) : null}
                        <TableCell align="right">{Number(it.taxableAmount || 0).toFixed(2)}</TableCell>
                        {gstEnabled ? <TableCell align="right">{Number(it.gstAmount || 0).toFixed(2)}</TableCell> : null}
                        <TableCell align="right">{Number(it.totalAmount || 0).toFixed(2)}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={() => removeReturnItem(it.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 3 }}>
              <Typography variant="body2">Taxable: {totals.taxableAmountTotal.toFixed(2)}</Typography>
              {gstEnabled ? <Typography variant="body2">GST: {totals.gstAmountTotal.toFixed(2)}</Typography> : null}
              <Typography variant="body1" fontWeight={600}>
                Grand Total: {totals.grandTotal.toFixed(2)}
              </Typography>
            </Box>

            <TextField
              sx={{ mt: 2 }}
              fullWidth
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              multiline
              minRows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Cancel</Button>
          <Button onClick={handleSubmit as any} type="submit" variant="contained" disabled={editing ? !canEdit : !canCreate}>
            {editing ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
