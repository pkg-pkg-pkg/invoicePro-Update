// D:\PVEB\Desktop\src\pages\PurchaseInvoices.tsx
// Purchase invoice screen for bills from suppliers

import { useEffect, useState, FormEvent } from "react";
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
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Divider,
  Grid,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  InputAdornment,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon, Print as PrintIcon, Search as SearchIcon, FilterList as FilterListIcon, Sort as SortIcon, Clear as ClearIcon } from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";

import type { RootState, AppDispatch } from '../store';
import { fetchSuppliers } from '../store/slices/partySlice';
import { fetchProducts } from '../store/slices/productSlice';
import { detectSchemesForProduct, ignoreScheme } from '../store/slices/schemeSlice';
import type { Scheme } from '../services/schemeService';
import SchemePopup from '../components/SchemePopup';

import { docApi, getHostBaseUrl } from '../services/docApi';
import { getAppSettings, getDefaultTodayForEntry, validateTransactionDate } from '../services/appSettingsService';
import { usePermissions } from '../hooks/usePermissions';

const PURCHASE_STORAGE_KEY = 'pve_invoicepro_purchase_invoices';
const SUPPLIERS_STORAGE_KEY = 'pve_suppliers';

const isLanDocsEnabled = () => {
  try {
    return !!getHostBaseUrl();
  } catch {
    return false;
  }
};

const loadStoredPurchaseBills = (): InvoiceData[] => {
  try {
    const raw = localStorage.getItem(PURCHASE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InvoiceData[]) : [];
  } catch {
    return [];
  }
};

const saveStoredPurchaseBills = (items: InvoiceData[]) => {
  try {
    localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};

const loadStoredSuppliers = (): any[] => {
  try {
    const raw = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredSuppliers = (items: any[]) => {
  try {
    localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};

const updateSupplierBalance = (supplierId: string | undefined, supplierName: string, deltaIncreasePayable: number) => {
  const suppliers = loadStoredSuppliers();
  const idKey = String(supplierId ?? '').trim();
  const nameKey = String(supplierName ?? '').trim().toLowerCase();
  const idx = suppliers.findIndex((s: any) => (idKey ? String(s?.id ?? '') === idKey : String(s?.name ?? '').trim().toLowerCase() === nameKey));
  if (idx < 0) return null;
  const prev = suppliers[idx];
  const prevBal = Number(prev?.currentBalance ?? 0) || 0;
  const next = { ...prev, currentBalance: prevBal - (Number(deltaIncreasePayable) || 0) };
  suppliers[idx] = next;
  saveStoredSuppliers(suppliers);
  return next;
};

const syncSupplierDocIfPossible = async (supplierId: string | undefined, supplierName: string, updatedAt?: string) => {
  if (!isLanDocsEnabled()) return;
  const idKey = String(supplierId ?? '').trim();
  if (!idKey) return;
  const suppliers = loadStoredSuppliers();
  const found = suppliers.find((s: any) => String(s?.id ?? '') === idKey) || suppliers.find((s: any) => String(s?.name ?? '').trim().toLowerCase() === String(supplierName ?? '').trim().toLowerCase());
  if (!found) return;
  await docApi.upsertDoc('supplier', String(found.id), {
    partyName: String(found?.name ?? ''),
    amount: Number(found?.currentBalance ?? 0) || 0,
    payload: found,
    updatedAt: updatedAt ?? new Date().toISOString(),
  });
};

// ==== Types ====

type SupplyType = "INTRA" | "INTER"; // Intra-state (CGST+SGST), Inter-state (IGST)

interface PartyDetails {
  name: string;
  address: string;
  gstin: string;
  mobile: string;
}

interface InvoiceData {
  invoiceNumber: string; // Our internal invoice number
  supplierInvoiceNumber?: string; // Supplier's invoice number
  date: string;
  supplyType: SupplyType;
  supplierId?: string;
  createdAt?: string;
  createdById?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedById?: string;
  updatedByName?: string;
  party: PartyDetails;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  gstAmount: number;
  roundOff: number;
  grandTotal: number;
  notes: string;
}

interface InvoiceItem {
  id: number;
  description: string;
  hsn: string;
  qty: number;
  purchasePrice: number; // Purchase price from supplier
  discountPercent: number;
  rate: number; // taxable rate after discount
  gstRate: number; // %
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number; // taxable + gst
  priceWithGST: number; // Purchase price + GST (non-editable)
  appliedSchemeId?: string;
  schemeDetails?: {
    benefit: string;
    type: string;
  };
}

export default function PurchaseInvoices() {
  const dispatch = useDispatch<AppDispatch>();
  const suppliersFromStore = useSelector((state: RootState) => (state as any).parties?.suppliers ?? []);
  const productsFromStore = useSelector((state: RootState) => (state as any).products?.items ?? []);

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

  const [invoices, setInvoices] = useState<InvoiceData[]>(() => loadStoredPurchaseBills());
  const [open, setOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(null);

  useEffect(() => {
    const loadSmart = async () => {
      if (!isLanDocsEnabled()) return;
      try {
        const rows = await docApi.listPayloads<InvoiceData>('purchase_invoice');
        if (Array.isArray(rows)) {
          setInvoices(rows);
          saveStoredPurchaseBills(rows);
        }
      } catch {
        // ignore
      }
    };
    loadSmart();
  }, []);

  useEffect(() => {
    dispatch(fetchSuppliers({ page: 1, limit: 1000 } as any));
    dispatch(fetchProducts() as any);
  }, [dispatch]);

  // Enhanced filtering state
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'partial' | 'overdue'>('all');
  const [amountRangeFilter, setAmountRangeFilter] = useState<'all' | '0-1000' | '1000-5000' | '5000-25000' | '25000+'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'supplier'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [formData, setFormData] = useState<InvoiceData>({
    invoiceNumber: "",
    supplierInvoiceNumber: "",
    date: getDefaultTodayForEntry(),
    supplyType: "INTRA",
    party: {
      name: "",
      address: "",
      gstin: "",
      mobile: "",
    },
    items: [],
    subtotal: 0,
    discount: 0,
    gstAmount: 0,
    roundOff: 0,
    grandTotal: 0,
    notes: "",
  });

  // Scheme popup state
  const { ignoredSchemes } = useSelector((s: RootState) => s.schemes);
  const [schemePopup, setSchemePopup] = useState<{
    scheme: Scheme | null;
    lineIndex: number;
  } | null>(null);

  useEffect(() => {
    saveStoredPurchaseBills(invoices);
  }, [invoices]);

  const supplierOptions = Array.isArray(suppliersFromStore) ? (suppliersFromStore as any[]) : [];

  const productOptions = Array.isArray(productsFromStore) ? (productsFromStore as any[]) : [];

  const handleOpen = (invoice?: InvoiceData) => {
    if (invoice) {
      if (!canEdit) {
        alert('You do not have permission to edit purchase bills');
        return;
      }
      setEditingInvoice(invoice);
      setFormData(invoice);
    } else {
      if (!canCreate) {
        alert('You do not have permission to create purchase bills');
        return;
      }
      setEditingInvoice(null);
      setFormData({
        invoiceNumber: `PUR-${Date.now()}`,
        supplierId: '',
        date: getDefaultTodayForEntry(),
        supplyType: "INTRA",
        party: {
          name: "",
          address: "",
          gstin: "",
          mobile: "",
        },
        items: [],
        subtotal: 0,
        discount: 0,
        gstAmount: 0,
        roundOff: 0,
        grandTotal: 0,
        notes: "",
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingInvoice(null);
  };

  // Enhanced filtering functions
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleDateFilterChange = (value: 'all' | 'today' | 'week' | 'month' | 'custom') => {
    setDateFilter(value);
  };

  const handlePaymentStatusFilterChange = (value: 'all' | 'paid' | 'unpaid' | 'partial' | 'overdue') => {
    setPaymentStatusFilter(value);
  };

  const handleAmountRangeFilterChange = (value: 'all' | '0-1000' | '1000-5000' | '5000-25000' | '25000+') => {
    setAmountRangeFilter(value);
  };

  const handleSortChange = (sortByValue: 'date' | 'amount' | 'supplier') => {
    setSortBy(sortByValue);
  };

  const handleSortOrderChange = (order: 'asc' | 'desc') => {
    setSortOrder(order);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateFilter('all');
    setPaymentStatusFilter('all');
    setAmountRangeFilter('all');
    setSortBy('date');
    setSortOrder('desc');
  };

  // Apply filters to purchase invoices
  const getFilteredInvoices = () => {
    let filtered = [...invoices];

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(invoice =>
        invoice.invoiceNumber.toLowerCase().includes(search) ||
        invoice.supplierInvoiceNumber?.toLowerCase().includes(search) ||
        invoice.party.name.toLowerCase().includes(search)
      );
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(invoice => {
        const invoiceDate = new Date(invoice.date);
        const invoiceDay = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), invoiceDate.getDate());

        switch (dateFilter) {
          case 'today':
            return invoiceDay.getTime() === today.getTime();
          case 'week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            return invoiceDay >= weekStart && invoiceDay <= weekEnd;
          case 'month':
            return invoiceDate.getMonth() === now.getMonth() && invoiceDate.getFullYear() === now.getFullYear();
          default:
            return true;
        }
      });
    }

    // Apply payment status filter
    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter((invoice: any) => {
        const statusRaw = String(invoice?.paymentStatus ?? invoice?.status ?? '').trim().toLowerCase();
        const status = statusRaw || 'unpaid';
        return status === String(paymentStatusFilter).toLowerCase();
      });
    }

    // Apply amount range filter
    if (amountRangeFilter !== 'all') {
      filtered = filtered.filter(invoice => {
        const amount = invoice.grandTotal;
        switch (amountRangeFilter) {
          case '0-1000':
            return amount >= 0 && amount <= 1000;
          case '1000-5000':
            return amount > 1000 && amount <= 5000;
          case '5000-25000':
            return amount > 5000 && amount <= 25000;
          case '25000+':
            return amount > 25000;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'amount':
          aValue = a.grandTotal;
          bValue = b.grandTotal;
          break;
        case 'supplier':
          aValue = a.party.name.toLowerCase();
          bValue = b.party.name.toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  };

  const calculateTotals = (items: InvoiceItem[], discount: any) => {
    const discountNum = Number(discount);
    const disc = Number.isFinite(discountNum) ? discountNum : 0;
    const subtotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
    const discountAmount = (subtotal * disc) / 100;
    const taxableAfterDiscount = subtotal - discountAmount;
    const gstAmount = items.reduce((sum, item) => sum + item.gstAmount, 0);
    const grandTotal = taxableAfterDiscount + gstAmount;

    return {
      subtotal,
      gstAmount,
      grandTotal: Math.round(grandTotal),
      roundOff: grandTotal - Math.round(grandTotal),
    };
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    const toNum = (v: any, fallback = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    // Recalculate amounts - handle empty/invalid values
    const qty = toNum(updatedItems[index].qty, 0);
    const purchasePrice = toNum(updatedItems[index].purchasePrice, 0);
    const discountPercent = toNum(updatedItems[index].discountPercent, 0);
    const gstRate = gstEnabled ? toNum(updatedItems[index].gstRate, 0) : 0;

    const discountAmount = (purchasePrice * discountPercent) / 100;
    const rate = purchasePrice - discountAmount;
    const taxableAmount = rate * qty;
    const gstAmount = gstEnabled ? (taxableAmount * gstRate) / 100 : 0;
    const totalAmount = taxableAmount + gstAmount;
    const priceWithGST = rate + (gstEnabled ? (rate * gstRate) / 100 : 0);

    updatedItems[index] = {
      ...updatedItems[index],
      rate,
      taxableAmount,
      gstAmount,
      totalAmount,
      priceWithGST,
    };

    const newFormData = { ...formData, items: updatedItems };
    const totals = calculateTotals(updatedItems, formData.discount);
    setFormData({ ...newFormData, ...totals });
  };

  // Handle product selection with scheme detection
  const handleProductSelectPurchase = async (index: number, product: any) => {
    if (!product) return;

    // Get company ID
    const companyId = (() => {
      try {
        const raw = localStorage.getItem('company');
        if (!raw) return '';
        const c = JSON.parse(raw);
        return String(c?.id ?? '').trim();
      } catch {
        return '';
      }
    })();

    const name = String(product?.name ?? '').trim();
    const hsn = String(product?.hsn ?? product?.hsnCode ?? '').trim();
    const purchasePrice = Number(product?.purchasePrice ?? 0) || 0;
    const gstRate = Number(product?.gstRate ?? 0) || 0;

    handleItemChange(index, 'description', name);
    handleItemChange(index, 'hsn', hsn);
    handleItemChange(index, 'purchasePrice', purchasePrice);
    handleItemChange(index, 'gstRate', gstRate);

    // Detect schemes for this product
    if (companyId && product.id) {
      try {
        const result = await dispatch(
          detectSchemesForProduct({
            companyId,
            productId: product.id,
            invoiceDate: new Date(formData.date || new Date()),
            appliesTo: 'PURCHASE'
          })
        ).unwrap();

        if (result.schemes?.length > 0) {
          const scheme = result.schemes[0];
          const key = `${product.id}-${scheme.id}`;
          // Only show if not already ignored in this session
          if (!ignoredSchemes.includes(key)) {
            setSchemePopup({ scheme, lineIndex: index });
          }
        }
      } catch (error) {
        // Silently fail - scheme detection is optional
        console.error('Scheme detection error:', error);
      }
    }
  };

  // Handle applying scheme to line item
  const handleApplyScheme = () => {
    if (!schemePopup?.scheme) return;

    const scheme = schemePopup.scheme;
    const lineIndex = schemePopup.lineIndex;

    // Add scheme data to the line item
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[lineIndex] = {
        ...newItems[lineIndex],
        appliedSchemeId: scheme.id,
        schemeDetails: {
          benefit: scheme.name,
          type: scheme.schemeType
        },
      };
      return { ...prev, items: newItems };
    });

    setSchemePopup(null);
  };

  // Handle skipping scheme
  const handleSkipScheme = () => {
    if (!schemePopup?.scheme) return;

    const productName = formData.items[schemePopup.lineIndex]?.description || '';
    const key = `${productName}-${schemePopup.scheme.id}`;
    dispatch(ignoreScheme(key));

    setSchemePopup(null);
  };

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now(),
      description: "",
      hsn: "",
      qty: 1,
      purchasePrice: 0,
      discountPercent: 0,
      rate: 0,
      gstRate: gstEnabled ? 18 : 0,
      taxableAmount: 0,
      gstAmount: 0,
      totalAmount: 0,
      priceWithGST: 0,
    };
    setFormData({ ...formData, items: [...formData.items, newItem] });
  };

  const removeItem = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    const newFormData = { ...formData, items: updatedItems };
    const totals = calculateTotals(updatedItems, formData.discount);
    setFormData({ ...newFormData, ...totals });
  };

  const handleDiscountChange = (value: any) => {
    const raw = String(value ?? '');
    const parsed = raw.trim() === '' ? undefined : parseFloat(raw);
    const nextDiscount: any = Number.isFinite(parsed as any) ? parsed : undefined;
    const newFormData = { ...formData, discount: nextDiscount } as any;
    const totals = calculateTotals(formData.items, nextDiscount);
    setFormData({ ...newFormData, ...totals });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (editingInvoice) {
      if (!canEdit) {
        alert('You do not have permission to edit purchase bills');
        return;
      }
    } else {
      if (!canCreate) {
        alert('You do not have permission to create purchase bills');
        return;
      }
    }

    const dv = validateTransactionDate(String(formData?.date ?? ''));
    if (!dv.ok) {
      alert(dv.message);
      return;
    }

    if (!formData.party?.name?.trim()) {
      alert('Supplier is required');
      return;
    }
    const toNum = (v: any, fallback = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const normalizedItems: InvoiceItem[] = (Array.isArray(formData.items) ? formData.items : []).map((it: any) => ({
      ...it,
      qty: toNum(it?.qty, 0),
      purchasePrice: toNum(it?.purchasePrice, 0),
      discountPercent: toNum(it?.discountPercent, 0),
      gstRate: gstEnabled ? toNum(it?.gstRate, 0) : 0,
      rate: toNum(it?.rate, 0),
      taxableAmount: toNum(it?.taxableAmount, 0),
      gstAmount: gstEnabled ? toNum(it?.gstAmount, 0) : 0,
      totalAmount: toNum(it?.taxableAmount, 0) + (gstEnabled ? toNum(it?.gstAmount, 0) : 0),
      priceWithGST: gstEnabled ? toNum(it?.priceWithGST, 0) : toNum(it?.rate, 0),
    }));

    const normalizedDiscount = toNum((formData as any).discount, 0);
    const normalizedTotals = calculateTotals(normalizedItems, normalizedDiscount);
    const nowIso = new Date().toISOString();
    const actor = getAuditActor();
    const next: InvoiceData = {
      ...formData,
      items: normalizedItems,
      discount: normalizedDiscount as any,
      subtotal: normalizedTotals.subtotal,
      gstAmount: normalizedTotals.gstAmount,
      grandTotal: normalizedTotals.grandTotal,
      roundOff: normalizedTotals.roundOff,
      createdAt: editingInvoice?.createdAt || formData.createdAt || nowIso,
      createdById: editingInvoice?.createdById || formData.createdById || actor.id || undefined,
      createdByName: editingInvoice?.createdByName || formData.createdByName || actor.name || undefined,
      updatedAt: nowIso,
      updatedById: actor.id || undefined,
      updatedByName: actor.name || undefined,
    };

    const prevAmount = editingInvoice ? Number(editingInvoice?.grandTotal ?? 0) || 0 : 0;
    const delta = Number(next.grandTotal ?? 0) - prevAmount;
    if (delta !== 0) {
      const updated = updateSupplierBalance(String(next.supplierId || '') || undefined, String(next.party?.name ?? ''), delta);
      try {
        if (updated) await syncSupplierDocIfPossible(String(next.supplierId || '') || undefined, String(next.party?.name ?? ''), nowIso);
      } catch {
        // ignore
      }
    }

    if (editingInvoice) {
      setInvoices(invoices.map(inv => inv.invoiceNumber === editingInvoice.invoiceNumber ? next : inv));
    } else {
      setInvoices([...invoices, next]);
    }

    if (isLanDocsEnabled()) {
      try {
        await docApi.upsertDoc('purchase_invoice', String(next.invoiceNumber), {
          docNumber: String(next.invoiceNumber),
          date: String(next.date ?? ''),
          partyName: String(next.party?.name ?? ''),
          amount: Number(next.grandTotal ?? 0) || 0,
          payload: next,
          createdAt: next.createdAt,
          updatedAt: next.updatedAt,
        });
      } catch (e: any) {
        alert(e?.message ?? 'Failed to sync purchase bill to host');
      }
    }

    handleClose();
  };

  const deleteInvoice = async (invoiceNumber: string) => {
    if (!canDelete) {
      alert('You do not have permission to delete purchase bills');
      return;
    }
    const inv = invoices.find((x) => String(x.invoiceNumber) === String(invoiceNumber));
    if (!inv) {
      setInvoices(invoices.filter(i => i.invoiceNumber !== invoiceNumber));
      return;
    }

    const dv = validateTransactionDate(String((inv as any)?.date ?? ''));
    if (!dv.ok) {
      alert(dv.message);
      return;
    }

    const ok = window.confirm(`Delete purchase bill ${String(inv.invoiceNumber ?? invoiceNumber)}?`);
    if (!ok) return;

    const amount = Number(inv?.grandTotal ?? 0) || 0;
    if (amount !== 0) {
      const updated = updateSupplierBalance(String(inv.supplierId || '') || undefined, String(inv.party?.name ?? ''), -amount);
      try {
        if (updated) await syncSupplierDocIfPossible(String(inv.supplierId || '') || undefined, String(inv.party?.name ?? ''), new Date().toISOString());
      } catch {
        // ignore
      }
    }

    setInvoices(invoices.filter(i => i.invoiceNumber !== invoiceNumber));
    if (isLanDocsEnabled()) {
      try {
        await docApi.deleteDoc('purchase_invoice', String(invoiceNumber));
      } catch (e: any) {
        alert(e?.message ?? 'Failed to delete purchase bill from host');
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Purchase Bills</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          New Purchase Bill
        </Button>
      </Box>

      {/* Enhanced Filtering */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <TextField
            placeholder="Search by bill number or supplier name..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, minWidth: 300 }}
          />

          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={() => setFiltersExpanded(!filtersExpanded)}
          >
            Filters {filtersExpanded ? '▼' : '▶'}
          </Button>

          <Button
            variant="outlined"
            startIcon={<SortIcon />}
            onClick={() => handleSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortBy === 'date' ? 'Date' : sortBy === 'amount' ? 'Amount' : 'Supplier'}
            {sortOrder === 'asc' ? ' ↑' : ' ↓'}
          </Button>

          <Button
            variant="text"
            startIcon={<ClearIcon />}
            onClick={clearFilters}
          >
            Clear
          </Button>
        </Box>

        {/* Advanced Filters */}
        {filtersExpanded && (
          <Accordion expanded={filtersExpanded}>
            <AccordionSummary sx={{ display: 'none' }} />
            <AccordionDetails sx={{ pt: 0 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Date Range</InputLabel>
                    <Select
                      value={dateFilter}
                      onChange={(e) => handleDateFilterChange(e.target.value as any)}
                      label="Date Range"
                    >
                      <MenuItem value="all">All Dates</MenuItem>
                      <MenuItem value="today">Today</MenuItem>
                      <MenuItem value="week">This Week</MenuItem>
                      <MenuItem value="month">This Month</MenuItem>
                      <MenuItem value="custom">Custom Range</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Status</InputLabel>
                    <Select
                      value={paymentStatusFilter}
                      onChange={(e) => handlePaymentStatusFilterChange(e.target.value as any)}
                      label="Payment Status"
                    >
                      <MenuItem value="all">All Status</MenuItem>
                      <MenuItem value="paid">Paid</MenuItem>
                      <MenuItem value="unpaid">Unpaid</MenuItem>
                      <MenuItem value="partial">Partial</MenuItem>
                      <MenuItem value="overdue">Overdue</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Amount Range</InputLabel>
                    <Select
                      value={amountRangeFilter}
                      onChange={(e) => handleAmountRangeFilterChange(e.target.value as any)}
                      label="Amount Range"
                    >
                      <MenuItem value="all">All Amounts</MenuItem>
                      <MenuItem value="0-1000">₹0 - ₹1,000</MenuItem>
                      <MenuItem value="1000-5000">₹1,000 - ₹5,000</MenuItem>
                      <MenuItem value="5000-25000">₹5,000 - ₹25,000</MenuItem>
                      <MenuItem value="25000+">₹25,000+</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Sort By</InputLabel>
                    <Select
                      value={sortBy}
                      onChange={(e) => handleSortChange(e.target.value as any)}
                      label="Sort By"
                    >
                      <MenuItem value="date">Date</MenuItem>
                      <MenuItem value="amount">Amount</MenuItem>
                      <MenuItem value="supplier">Supplier</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        {getFilteredInvoices().length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No purchase bills found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create your first purchase bill to get started
            </Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Our Bill No.</TableCell>
                <TableCell>Supplier Bill No.</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="center">Schemes</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {getFilteredInvoices().map((invoice) => {
                const schemeCount = (invoice.items || []).filter((it: any) => it.appliedSchemeId).length;
                return (
                  <TableRow key={invoice.invoiceNumber} hover>
                    <TableCell>{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.supplierInvoiceNumber}</TableCell>
                    <TableCell>{invoice.party.name}</TableCell>
                    <TableCell>{String((invoice as any).createdByName ?? (invoice as any).createdBy ?? '-')}</TableCell>
                    <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                    <TableCell align="right">₹{invoice.grandTotal.toLocaleString()}</TableCell>
                    <TableCell align="center">
                      {schemeCount > 0 ? (
                        <Box sx={{ display: 'inline-block', background: '#4caf50', color: 'white', px: 1.5, py: 0.5, borderRadius: 1, fontSize: '12px', fontWeight: 'bold' }}>
                          ✓ {schemeCount} Applied
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleOpen(invoice)} disabled={!canEdit}>
                        Edit
                      </IconButton>
                      <IconButton size="small" onClick={() => deleteInvoice(invoice.invoiceNumber)} disabled={!canDelete}>
                        <DeleteIcon />
                      </IconButton>
                      <IconButton size="small">
                        <PrintIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Invoice Form Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          {editingInvoice ? 'Edit Purchase Bill' : 'New Purchase Bill'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Our Bill Number"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  required
                  helperText="Internal bill number for our records"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Supplier Invoice Number"
                  value={formData.supplierInvoiceNumber}
                  onChange={(e) => setFormData({ ...formData, supplierInvoiceNumber: e.target.value })}
                  required
                  helperText="Original invoice number from supplier"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              {gstEnabled ? (
                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    fullWidth
                    label="Supply Type"
                    value={formData.supplyType}
                    onChange={(e) => setFormData({ ...formData, supplyType: e.target.value as SupplyType })}
                  >
                    <MenuItem value="INTRA">Intra-state (CGST + SGST)</MenuItem>
                    <MenuItem value="INTER">Inter-state (IGST)</MenuItem>
                  </TextField>
                </Grid>
              ) : null}

              <Grid item xs={12}>
                <Autocomplete
                  options={supplierOptions}
                  getOptionLabel={(option: any) => String(option?.name ?? '')}
                  value={
                    (supplierOptions.find((s: any) => String(s.id) === String(formData.supplierId)) ||
                      supplierOptions.find((s: any) => String(s.name ?? '').toLowerCase() === String(formData.party.name ?? '').toLowerCase()) ||
                      null) as any
                  }
                  onChange={(_, newValue) => {
                    if (newValue) {
                      setFormData({
                        ...formData,
                        supplierId: String((newValue as any).id ?? ''),
                        party: {
                          name: String((newValue as any).name ?? ''),
                          address: `${String((newValue as any).addressLine1 ?? '')}${(newValue as any).addressLine2 ? `, ${String((newValue as any).addressLine2)}` : ''}${(newValue as any).city ? `, ${String((newValue as any).city)}` : ''}${(newValue as any).state ? `, ${String((newValue as any).state)}` : ''}${(newValue as any).pincode ? ` - ${String((newValue as any).pincode)}` : ''}`.trim(),
                          gstin: String((newValue as any).gstin ?? ''),
                          mobile: String((newValue as any).phone ?? (newValue as any).mobile ?? ''),
                        }
                      });
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Supplier *"
                      required
                      onChange={(e) => {
                        setFormData((p) => ({
                          ...p,
                          supplierId: '',
                          party: { ...p.party, name: e.target.value },
                        }));
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Supplier Address"
                  value={formData.party.address}
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              {gstEnabled ? (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="GSTIN"
                    value={formData.party.gstin}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              ) : null}

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Mobile"
                  value={formData.party.mobile}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ mb: 2 }}>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={addItem}>
                Add Item
              </Button>
            </Box>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>HSN</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Purchase Price</TableCell>
                  <TableCell align="right">Disc %</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  {gstEnabled ? <TableCell align="right">GST %</TableCell> : null}
                  <TableCell align="right">Taxable</TableCell>
                  {gstEnabled ? <TableCell align="right">GST Amt</TableCell> : null}
                  {gstEnabled ? <TableCell align="right">Price with GST</TableCell> : null}
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {formData.items.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Autocomplete
                        options={productOptions}
                        getOptionLabel={(option: any) => String(option?.name ?? '')}
                        value={productOptions.find((p: any) => String(p?.name ?? '') === String(item.description ?? '')) || null}
                        onChange={(_, newValue) => {
                          if (newValue) {
                            handleProductSelectPurchase(index, newValue);
                          }
                        }}
                        renderInput={(params) => (
                          <TextField {...params} size="small" />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={item.hsn}
                        onChange={(e) => handleItemChange(index, 'hsn', e.target.value)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={(item as any).qty ?? ''}
                        onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                        inputProps={{ min: 0 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={(item as any).purchasePrice ?? ''}
                        onChange={(e) => handleItemChange(index, 'purchasePrice', e.target.value)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={(item as any).discountPercent ?? ''}
                        onChange={(e) => handleItemChange(index, 'discountPercent', e.target.value)}
                      />
                    </TableCell>
                    <TableCell align="right">₹{item.rate.toFixed(2)}</TableCell>
                    {gstEnabled ? (
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          value={(item as any).gstRate ?? ''}
                          onChange={(e) => handleItemChange(index, 'gstRate', e.target.value)}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell align="right">₹{item.taxableAmount.toFixed(2)}</TableCell>
                    {gstEnabled ? <TableCell align="right">₹{item.gstAmount.toFixed(2)}</TableCell> : null}
                    {gstEnabled ? (
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        ₹{item.priceWithGST.toFixed(2)}
                      </TableCell>
                    ) : null}
                    <TableCell align="right">₹{item.totalAmount.toFixed(2)}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => removeItem(index)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Overall Discount (%)"
                    type="number"
                    value={(formData as any).discount ?? ''}
                    onChange={(e) => handleDiscountChange(e.target.value as any)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Round Off"
                    value={formData.roundOff.toFixed(2)}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2">Subtotal: ₹{formData.subtotal.toFixed(2)}</Typography>
                  {gstEnabled ? <Typography variant="body2">GST Amount: ₹{formData.gstAmount.toFixed(2)}</Typography> : null}
                  <Typography variant="body2">Round Off: ₹{formData.roundOff.toFixed(2)}</Typography>
                </Box>
                <Typography variant="h6" color="primary">
                  Grand Total: ₹{formData.grandTotal.toLocaleString()}
                </Typography>
              </Box>
            </Box>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="contained" onClick={handleSubmit}>
            {editingInvoice ? 'Update' : 'Save'} Bill
          </Button>
        </DialogActions>
      </Dialog>

      {/* Scheme Popup */}
      <SchemePopup
        open={!!schemePopup}
        scheme={schemePopup?.scheme || null}
        onApply={handleApplyScheme}
        onSkip={handleSkipScheme}
        productName={schemePopup?.scheme?.products?.[0]?.product?.name}
      />
    </Box>
  );
}
