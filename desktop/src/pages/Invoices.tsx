// D:\PVEB\Desktop\src\pages\invoices.tsx
// Invoice screen with: mobile, item search, MRP, discount, GST breakup, print

import React, { useEffect, useState, ChangeEvent } from "react";
import { useDispatch, useSelector } from "react-redux";
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
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Print as PrintIcon, Search as SearchIcon, FilterList as FilterListIcon, Sort as SortIcon, Clear as ClearIcon } from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";

import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

import { docApi, getHostBaseUrl } from '../services/docApi';
import { getAppSettings, getDefaultTodayForEntry, validateTransactionDate } from '../services/appSettingsService';
import { usePermissions } from '../hooks/usePermissions';

import type { RootState } from "../store";
import type { AppDispatch } from "../store";
import { fetchProducts } from "../store/slices/productSlice";
import { fetchCustomers } from "../store/slices/partySlice";
import { detectSchemesForProduct, ignoreScheme } from "../store/slices/schemeSlice";
import type { Scheme } from "../services/schemeService";
import SchemePopup from "../components/SchemePopup";

// ==== Types ====

type SupplyType = "INTRA" | "INTER"; // Intra-state (CGST+SGST), Inter-state (IGST)

interface PartyDetails {
  name: string;
  address: string;
  gstin: string;
  mobile: string;
}

interface InvoiceItem {
  id: number;
  description: string;
  hsn: string;
  qty: number;
  mrp: number;
  discountPercent: number;
  rate: number; // taxable rate after discount
  gstRate: number; // %
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number; // taxable + gst
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  supplyType: SupplyType;
  customerId?: string;
  paymentTerms?: string;
  createdAt?: string;
  createdById?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedById?: string;
  updatedByName?: string;
  billTo: PartyDetails;
  shipTo: PartyDetails;
  items: InvoiceItem[];
  taxableAmountTotal: number;
  gstAmountTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
}

interface InvoiceItemForm {
  description: string;
  hsn: string;
  qty: string;
  mrp: string;
  discountPercent: string;
  rate: string;
  gstRate: string;
  inclusivePrice: string;
  appliedSchemeId?: string;
  schemeDetails?: {
    benefit: string;
    type: string;
  };
}

interface InvoiceFormState {
  date: string;
  dueDate: string;
  supplyType: SupplyType;
  cdDiscountPercent: string;
  billToName: string;
  paymentTerms: string;
  billToAddress: string;
  billToGstin: string;
  billToMobile: string;
  shipToName: string;
  shipToAddress: string;
  shipToGstin: string;
  shipToMobile: string;
  items: InvoiceItemForm[];
}

// Product master just for suggestions
interface Product {
  id: any;
  name: string;
  hsn?: string;
  hsnCode?: string;
  mrp?: number;
  gstRate?: number;
  salePrice?: number;
}

const INVOICE_STORAGE_KEY = 'pve_invoicepro_invoices';
const CUSTOMERS_STORAGE_KEY = 'pve_customers';

const loadStoredInvoices = (): Invoice[] => {
  try {
    const raw = localStorage.getItem(INVOICE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Invoice[]) : [];
  } catch {
    return [];
  }
};

const saveStoredInvoices = (items: Invoice[]) => {
  try {
    localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};

const loadStoredCustomers = (): any[] => {
  try {
    const raw = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredCustomers = (items: any[]) => {
  try {
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};

const updateCustomerBalance = (customerId: string | undefined, customerName: string, deltaIncreaseReceivable: number) => {
  const customers = loadStoredCustomers();
  const idKey = String(customerId ?? '').trim();
  const nameKey = String(customerName ?? '').trim().toLowerCase();
  const idx = customers.findIndex((c: any) =>
    (idKey ? String(c?.id ?? '') === idKey : String(c?.name ?? '').trim().toLowerCase() === nameKey)
  );
  if (idx < 0) return null;
  const prev = customers[idx];
  const prevBal = Number(prev?.currentBalance ?? 0) || 0;
  const updatedAt = new Date().toISOString();
  const next = { ...prev, currentBalance: prevBal + (Number(deltaIncreaseReceivable) || 0), updatedAt };
  customers[idx] = next;
  saveStoredCustomers(customers);
  return next;
};

const syncCustomerDocIfPossible = async (customerId: string | undefined, customerName: string, updatedAt?: string) => {
  let base: string | null = null;
  try {
    base = getHostBaseUrl();
  } catch {
    base = null;
  }
  if (!base) return;

  const idKey = String(customerId ?? '').trim();
  if (!idKey) return;
  const customers = loadStoredCustomers();
  const found = customers.find((c: any) => String(c?.id ?? '') === idKey) || customers.find((c: any) => String(c?.name ?? '').trim().toLowerCase() === String(customerName ?? '').trim().toLowerCase());
  if (!found) return;

  await docApi.upsertDoc('customer', String(found.id), {
    docNumber: String(found?.code ?? ''),
    partyName: String(found?.name ?? ''),
    amount: Number(found?.currentBalance ?? 0) || 0,
    payload: found,
    updatedAt: updatedAt ?? new Date().toISOString(),
  });
};

const today = () => getDefaultTodayForEntry();

// ==== Helper functions ====

const calculateItem = (formItem: InvoiceItemForm, id: number, cdDiscountPercent: number, gstEnabled: boolean): InvoiceItem | null => {
  const qty = Number(formItem.qty || 1); // default quantity to 1 if empty
  const mrp = Number(formItem.mrp);
  const discountAmount = Number(formItem.discountPercent || "0");
  const gstRate = gstEnabled ? Number(formItem.gstRate || "0") : 0;
  const inclusive = Number(formItem.inclusivePrice || "0");
  let rate = Number(formItem.rate);

  if (Number.isNaN(qty) || qty <= 0) return null;

  if (Number.isNaN(gstRate) || gstRate < 0) return null;

  // If rate not given, derive from Inclusive Price (reverse GST)
  if ((!rate || Number.isNaN(rate)) && inclusive && gstRate >= 0) {
    const denom = 1 + gstRate / 100;
    rate = denom > 0 ? inclusive / denom : inclusive;
  }

  // If rate still not given, derive from MRP and discount (discount amount)
  if ((!rate || Number.isNaN(rate)) && mrp) {
    rate = mrp - (Number.isNaN(discountAmount) ? 0 : discountAmount);
  }

  // If still invalid, fall back to mrp (or 0)
  if (Number.isNaN(rate) || rate < 0) rate = mrp || 0;
  if (rate <= 0) return null;

  const cdFactor = 1 - (Number.isNaN(cdDiscountPercent) ? 0 : cdDiscountPercent) / 100;
  const taxableAmount = qty * rate * (cdFactor > 0 ? cdFactor : 1);
  const gstAmount = (taxableAmount * gstRate) / 100;
  const totalAmount = taxableAmount + gstAmount;

  return {
    id,
    description: (formItem.description || "").trim(),
    hsn: (formItem.hsn || "").trim(),
    qty,
    mrp: mrp || rate,
    discountPercent: (Number.isNaN(discountAmount) ? 0 : discountAmount) || 0,
    rate,
    gstRate,
    taxableAmount,
    gstAmount,
    totalAmount,
  };
};

const calculateTotals = (items: InvoiceItem[]) => {
  let taxableAmountTotal = 0;
  let gstAmountTotal = 0;
  let grandTotal = 0;

  for (const item of items) {
    taxableAmountTotal += item.taxableAmount;
    gstAmountTotal += item.gstAmount;
    grandTotal += item.totalAmount;
  }

  return { taxableAmountTotal, gstAmountTotal, grandTotal };
};

const formatMoney = (amount: number) =>
  amount.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

const perUnitInclusivePrice = (rate: number, gstRate: number) =>
  rate + (rate * gstRate) / 100;

const loadInvoicePrintPrefs = () => {
  const rawSettings = localStorage.getItem('invoice-settings');
  const rawCompany = localStorage.getItem('company-info');
  const selectedFormat = localStorage.getItem('selected-format') || 'classic';
  let settings: any = null;
  let company: any = null;
  try {
    settings = rawSettings ? JSON.parse(rawSettings) : null;
  } catch {
    settings = null;
  }
  try {
    company = rawCompany ? JSON.parse(rawCompany) : null;
  } catch {
    company = null;
  }
  return {
    selectedFormat,
    settings: settings || {},
    company: company || {},
  };
};

const generateInvoiceHTMLForPrint = (invoice: Invoice) => {
  const { settings, company } = loadInvoicePrintPrefs();
  const showHSN = settings?.showHSN !== false;
  const showCustomerGSTIN = settings?.showCustomerGSTIN !== false;
  const showBankDetails = settings?.showBankDetails !== false;
  const showTerms = settings?.showTerms !== false;
  const showSignature = settings?.showSignature !== false;

  const primaryColor = String(settings?.primaryColor ?? '#1976d2');
  const secondaryColor = String(settings?.secondaryColor ?? '#f5f5f5');

  const itemsHTML = (invoice.items || [])
    .map((it, idx) => {
      const amount = Number(it.taxableAmount ?? 0);
      const schemeBadge = (it as any).appliedSchemeId && (it as any).schemeDetails
        ? `<span style="display:inline-block;background:#4caf50;color:white;padding:2px 6px;border-radius:3px;font-size:10px;margin-left:6px;font-weight:bold;">✓ ${String((it as any).schemeDetails?.benefit ?? 'Scheme Applied')}</span>`
        : '';
      return `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${String(it.description ?? '')}</strong>${schemeBadge}</td>
          ${showHSN ? `<td>${String(it.hsn ?? '')}</td>` : ''}
          <td class="text-right">${Number(it.qty ?? 0)}</td>
          <td class="text-right">₹${Number(it.rate ?? 0).toFixed(2)}</td>
          <td class="text-right">₹${amount.toFixed(2)}</td>
        </tr>
      `;
    })
    .join('');

  const termsText = String(company?.termsAndConditions ?? '').trim();
  const termsHTML = termsText ? termsText.replace(/\n/g, '<br>') : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${invoice.invoiceNumber}</title>
    <style>
      @media print { @page { size: A4; margin: 12mm; } body { margin: 0; } }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 18px; }
      .header { display:flex; justify-content:space-between; gap:16px; border-bottom:3px solid ${primaryColor}; padding-bottom:12px; margin-bottom:14px; }
      .company { flex: 1; }
      .company h1 { margin:0 0 6px 0; color:${primaryColor}; font-size:20px; }
      .company p { margin:2px 0; }
      .invbox { min-width: 220px; text-align:right; background:${primaryColor}; color:#fff; padding:10px 14px; border-radius:6px; }
      table { width:100%; border-collapse:collapse; margin-top:10px; }
      th { background:${primaryColor}; color:#fff; text-align:left; padding:8px; font-size:12px; }
      td { border-bottom:1px solid #ddd; padding:8px; font-size:12px; }
      tbody tr:nth-child(even){ background:${secondaryColor}; }
      .text-right { text-align:right; }
      .grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin:12px 0; }
      .box { border:1px solid #ddd; background:${secondaryColor}; padding:10px; border-radius:6px; }
      .box h3 { margin:0 0 6px 0; color:${primaryColor}; font-size:12px; text-transform:uppercase; }
      .totals { display:flex; justify-content:flex-end; margin-top:12px; }
      .totals table { width: 320px; border:1px solid #ddd; }
      .totals td { border:0; padding:6px 8px; }
      .totals tr.total td { background:${primaryColor}; color:#fff; font-weight:700; }
      .terms { margin-top:12px; padding:10px; background:#f8f8f8; border-left:4px solid ${primaryColor}; }
      .signature { display:flex; justify-content:space-between; margin-top:26px; }
      .sigbox { min-width:220px; text-align:center; }
      .sigline { border-top:2px solid #000; margin-top:50px; padding-top:4px; font-size:11px; }
    </style>
  </head><body>
    <div class="header">
      <div class="company">
        ${company?.logo ? `<img src="${String(company.logo)}" alt="Logo" style="max-width:120px;max-height:60px;object-fit:contain;margin-bottom:6px;">` : ''}
        <h1>${String(company?.name ?? 'InvoicePro')}</h1>
        ${company?.address ? `<p>${String(company.address)}</p>` : ''}
        ${(company?.phone || company?.email) ? `<p>${company?.phone ? `Phone: ${String(company.phone)}` : ''}${company?.phone && company?.email ? ' | ' : ''}${company?.email ? `Email: ${String(company.email)}` : ''}</p>` : ''}
        ${company?.gstin ? `<p>GSTIN: ${String(company.gstin)}</p>` : ''}
      </div>
      <div class="invbox">
        <div style="font-size:20px;font-weight:700;">INVOICE</div>
        <div style="margin-top:6px;">#${invoice.invoiceNumber}</div>
        <div>Date: ${new Date(invoice.date).toLocaleDateString('en-IN')}</div>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <h3>Bill To</h3>
        <div><strong>${invoice.billTo?.name ?? ''}</strong></div>
        <div>${invoice.billTo?.address ?? ''}</div>
        ${showCustomerGSTIN ? `<div>GSTIN: ${invoice.billTo?.gstin ?? ''}</div>` : ''}
        <div>Mobile: ${invoice.billTo?.mobile ?? ''}</div>
      </div>
      <div class="box">
        <h3>Ship To</h3>
        <div><strong>${invoice.shipTo?.name ?? ''}</strong></div>
        <div>${invoice.shipTo?.address ?? ''}</div>
        ${showCustomerGSTIN ? `<div>GSTIN: ${invoice.shipTo?.gstin ?? ''}</div>` : ''}
        <div>Mobile: ${invoice.shipTo?.mobile ?? ''}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:40px;">#</th>
          <th>Item</th>
          ${showHSN ? '<th style="width:90px;">HSN</th>' : ''}
          <th style="width:70px;" class="text-right">Qty</th>
          <th style="width:110px;" class="text-right">Rate</th>
          <th style="width:130px;" class="text-right">Taxable</th>
        </tr>
      </thead>
      <tbody>${itemsHTML}</tbody>
    </table>

    <div class="totals">
      <table>
        <tr><td>Taxable:</td><td class="text-right">₹${Number(invoice.taxableAmountTotal ?? 0).toFixed(2)}</td></tr>
        <tr><td>GST:</td><td class="text-right">₹${Number(invoice.gstAmountTotal ?? 0).toFixed(2)}</td></tr>
        <tr class="total"><td>Total:</td><td class="text-right">₹${Number(invoice.grandTotal ?? 0).toFixed(2)}</td></tr>
      </table>
    </div>

    ${showBankDetails && company?.bank ? `
      <div class="terms">
        <strong>Bank Details for Payment</strong><br>
        Bank: ${String(company.bank)}<br>
        Account: ${String(company.accountNo ?? '')}<br>
        IFSC: ${String(company.ifsc ?? '')}
      </div>
    ` : ''}

    ${showTerms && termsHTML ? `<div class="terms"><strong>Terms & Conditions</strong><br>${termsHTML}</div>` : ''}

    ${showSignature ? `
      <div class="signature">
        <div class="sigbox"><div class="sigline">Customer Signature</div></div>
        <div class="sigbox">${company?.signature ? `<img src="${String(company.signature)}" alt="Signature" style="max-width:120px;max-height:50px;object-fit:contain;display:block;margin:0 auto 4px;">` : ''}<div class="sigline">Authorized Signatory</div></div>
      </div>
    ` : ''}
  </body></html>`;
};

// ==== Component ====

const Invoices: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const productsFromStore = useSelector((state: RootState) => (state as any).products?.items ?? []);
  const customersFromStore = useSelector((state: RootState) => (state as any).parties?.customers ?? []);

  const { canAccessFeature } = usePermissions();
  const [appSettings, setAppSettings] = useState(() => getAppSettings());
  const gstEnabled = Boolean(appSettings?.features?.gstEnabled);

  const canCreate = canAccessFeature('create-invoice');
  const canEdit = canAccessFeature('edit-invoice');
  const canDelete = canAccessFeature('delete-invoice');
  const canPrint = canAccessFeature('print-invoices');

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

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [currentInvoiceNumber, setCurrentInvoiceNumber] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  

  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchCustomers({ page: 1, limit: 1000 } as any));
  }, [dispatch]);

  const computeNextInvoiceNumber = (items: Invoice[]) => {
    const maxId = (items || []).reduce((m, it) => {
      const n = Number((it as any)?.id ?? 0);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return maxId + 1;
  };

  const loadInvoicesSmart = async () => {
    const base = getHostBaseUrl();
    if (!base) {
      const stored = loadStoredInvoices();
      setInvoices(stored);
      setCurrentInvoiceNumber(computeNextInvoiceNumber(stored));
      return;
    }

    try {
      const rows = await docApi.listDocs('invoice');
      const items = rows
        .map((r: any) => r?.payload)
        .filter(Boolean) as Invoice[];
      setInvoices(items);
      setCurrentInvoiceNumber(computeNextInvoiceNumber(items));
    } catch {
      const stored = loadStoredInvoices();
      setInvoices(stored);
      setCurrentInvoiceNumber(computeNextInvoiceNumber(stored));
    }
  };

  useEffect(() => {
    loadInvoicesSmart();
    const onCfg = () => {
      loadInvoicesSmart();
    };
    window.addEventListener('networkConfigUpdated', onCfg as any);
    return () => window.removeEventListener('networkConfigUpdated', onCfg as any);
  }, []);

  useEffect(() => {
    if (getHostBaseUrl()) return;
    saveStoredInvoices(invoices);
  }, [invoices]);

  // Enhanced filtering state
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'partial' | 'overdue'>('all');
  const [amountRangeFilter, setAmountRangeFilter] = useState<'all' | '0-1000' | '1000-5000' | '5000-25000' | '25000+'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'customer'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [form, setForm] = useState<InvoiceFormState>({
    date: today(),
    dueDate: today(),
    supplyType: "INTRA",
    cdDiscountPercent: "0",
    billToName: "",
    paymentTerms: "",
    billToAddress: "",
    billToGstin: "",
    billToMobile: "",
    shipToName: "",
    shipToAddress: "",
    shipToGstin: "",
    shipToMobile: "",
    items: [
      {
        description: "",
        hsn: "",
        qty: "",
        mrp: "",
        discountPercent: "",
        rate: "",
        gstRate: "18",
        inclusivePrice: "",
      },
    ],
  });

  // Scheme popup state
  const { ignoredSchemes } = useSelector((s: RootState) => s.schemes);
  const [schemePopup, setSchemePopup] = useState<{
    scheme: Scheme | null;
    lineIndex: number;
  } | null>(null);

  const openNewInvoiceDialog = () => {
    if (!canCreate) {
      setFormError('You do not have permission to create invoices');
      return;
    }
    if (!Array.isArray(customersFromStore) || customersFromStore.length === 0) {
      setFormError('Please create a Customer first before making an Invoice.');
      return;
    }
    setEditingInvoice(null);
    setSelectedCustomerId('');
    setFormError(null);
    setForm({
      date: today(),
      dueDate: today(),
      supplyType: "INTRA",
      cdDiscountPercent: "0",
      billToName: "",
      paymentTerms: "",
      billToAddress: "",
      billToGstin: "",
      billToMobile: "",
      shipToName: "",
      shipToAddress: "",
      shipToGstin: "",
      shipToMobile: "",
      items: [
        {
          description: "",
          hsn: "",
          qty: "",
          mrp: "",
          discountPercent: "",
          rate: "",
          gstRate: "18",
          inclusivePrice: "",
        },
      ],
    });
    setIsDialogOpen(true);
  };

  useEffect(() => {
    try {
      if (!Array.isArray(customersFromStore) || customersFromStore.length === 0) return;
      const params = new URLSearchParams(window.location.search);
      const openNew = params.get('new');
      if (openNew !== '1' && openNew !== 'true') return;

      openNewInvoiceDialog();

      params.delete('new');
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
      window.history.replaceState({}, '', nextUrl);
    } catch {
    }
  }, [customersFromStore]);

  const openEditInvoiceDialog = (invoice: Invoice) => {
    if (!canEdit) {
      setFormError('You do not have permission to edit invoices');
      return;
    }
    setEditingInvoice(invoice);
    setSelectedCustomerId(String((invoice as any)?.customerId ?? ''));
    setFormError(null);
    setForm({
      date: String(invoice.date || today()),
      dueDate: String(invoice.dueDate || invoice.date || today()),
      supplyType: invoice.supplyType,
      cdDiscountPercent: "0",
      billToName: String(invoice.billTo?.name ?? ''),
      paymentTerms: String((invoice as any)?.paymentTerms ?? ''),
      billToAddress: String(invoice.billTo?.address ?? ''),
      billToGstin: String(invoice.billTo?.gstin ?? ''),
      billToMobile: String(invoice.billTo?.mobile ?? ''),
      shipToName: String(invoice.shipTo?.name ?? ''),
      shipToAddress: String(invoice.shipTo?.address ?? ''),
      shipToGstin: String(invoice.shipTo?.gstin ?? ''),
      shipToMobile: String(invoice.shipTo?.mobile ?? ''),
      items: (invoice.items || []).map((it) => ({
        description: String(it.description ?? ''),
        hsn: String(it.hsn ?? ''),
        qty: String(it.qty ?? ''),
        mrp: String(it.mrp ?? ''),
        discountPercent: String(it.discountPercent ?? ''),
        rate: String(it.rate ?? ''),
        gstRate: String(it.gstRate ?? ''),
        inclusivePrice: String(perUnitInclusivePrice(Number(it.rate ?? 0), Number(it.gstRate ?? 0)) || ''),
      })),
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setEditingInvoice(null);
    setSelectedCustomerId('');
    setFormError(null);
    setIsDialogOpen(false);
  };

  const handleFormChange =
    (field: keyof InvoiceFormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({
        ...prev,
        [field]: event.target.value as any,
      }));
    };

  const handleItemChange =
    (index: number, field: keyof InvoiceItemForm) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((prev) => {
        const newItems = [...prev.items];
        const current = newItems[index];
        const next: InvoiceItemForm = { ...current, [field]: value } as any;

        const mrpNum = Number(next.mrp || 0);
        const discountNum = Number(next.discountPercent || 0);
        const gstNum = Number(next.gstRate || 0);

        if (field === 'mrp' || field === 'discountPercent') {
          const computedRate = Math.max(0, mrpNum - discountNum);
          next.rate = computedRate ? String(computedRate) : '';
          next.inclusivePrice = computedRate ? String(perUnitInclusivePrice(computedRate, gstNum)) : '';
        }

        if (field === 'gstRate') {
          const rateNum = Number(next.rate || 0);
          if (rateNum > 0) {
            next.inclusivePrice = String(perUnitInclusivePrice(rateNum, gstNum));
          } else {
            const inclNum = Number(next.inclusivePrice || 0);
            if (inclNum > 0 && gstNum >= 0) {
              const denom = 1 + gstNum / 100;
              const computedRate = denom > 0 ? inclNum / denom : inclNum;
              next.rate = computedRate ? String(computedRate) : '';
            }
          }
        }

        if (field === 'rate') {
          const rateNum = Number(next.rate || 0);
          next.inclusivePrice = rateNum > 0 ? String(perUnitInclusivePrice(rateNum, gstNum)) : '';
        }

        if (field === 'inclusivePrice') {
          const inclNum = Number(next.inclusivePrice || 0);
          if (inclNum > 0 && gstNum >= 0) {
            const denom = 1 + gstNum / 100;
            const computedRate = denom > 0 ? inclNum / denom : inclNum;
            next.rate = computedRate ? String(computedRate) : '';
          }
        }

        newItems[index] = next;
        return { ...prev, items: newItems };
      });
    };

  const productOptions: Product[] = Array.isArray(productsFromStore)
    ? (productsFromStore as any[]).map((p: any) => ({
        id: p.id,
        name: p.name,
        hsn: p.hsn,
        hsnCode: p.hsnCode,
        mrp: p.mrp,
        salePrice: p.salePrice,
        gstRate: p.gstRate,
      }))
    : [];

  // Jab product select kare (search/dropdown se)
  const handleProductSelect = async (index: number, product: Product | null) => {
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

    setForm((prev) => {
      const newItems = [...prev.items];
      const mrpValue = Number(product.salePrice ?? product.mrp ?? 0);
      const gstValue = Number(product.gstRate ?? 0);
      newItems[index] = {
        ...newItems[index],
        description: product.name,
        hsn: String(product.hsn ?? product.hsnCode ?? ''),
        mrp: mrpValue ? String(mrpValue) : '',
        discountPercent: "0",
        rate: mrpValue ? String(mrpValue) : '',
        gstRate: String(gstValue),
        inclusivePrice: mrpValue ? String(perUnitInclusivePrice(mrpValue, gstValue)) : '',
      };
      return { ...prev, items: newItems };
    });

    // Detect schemes for this product
    if (companyId && product.id) {
      try {
        const result = await dispatch(
          detectSchemesForProduct({
            companyId,
            productId: product.id,
            invoiceDate: new Date(form.date || new Date()),
            appliesTo: 'SALES'
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
    setForm((prev) => {
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

    const productId = form.items[schemePopup.lineIndex]?.description || '';
    const key = `${productId}-${schemePopup.scheme.id}`;
    dispatch(ignoreScheme(key));

    setSchemePopup(null);
  };

  const addItemRow = () => {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          description: "",
          hsn: "",
          qty: "",
          mrp: "",
          discountPercent: "",
          rate: "",
          gstRate: "18",
          inclusivePrice: "",
        },
      ],
    }));
  };

  const removeItemRow = (index: number) => {
    setForm((prev) => {
      if (prev.items.length === 1) return prev; // at least one row
      const newItems = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: newItems };
    });
  };

  const handleSubmit = async (event?: any) => {
    try {
      if (event?.preventDefault) event.preventDefault();
    } catch {
      // ignore
    }

    // Clear previous errors
    setFormError(null);

    if (editingInvoice) {
      if (!canEdit) {
        setFormError('You do not have permission to edit invoices');
        return;
      }
    } else {
      if (!canCreate) {
        setFormError('You do not have permission to create invoices');
        return;
      }
    }

    // Validate date
    const dv = validateTransactionDate(String(form.date ?? ''));
    if (!dv.ok) {
      setFormError(dv.message);
      return;
    }

    // Validate due date
    if (!form.dueDate) {
      setFormError('Due date is required');
      return;
    }

    // Validate bill to name
    if (!form.billToName.trim()) {
      setFormError('Bill To Name is required');
      return;
    }

    // Validate items
    const calculatedItems: InvoiceItem[] = [];
    const cdDiscountPercent = Number(form.cdDiscountPercent || 0);
    form.items.forEach((itemForm, idx) => {
      const calculated = calculateItem(
        {
          ...itemForm,
          description: itemForm.description?.trim() || `Item ${idx + 1}`,
        },
        idx + 1,
        cdDiscountPercent,
        gstEnabled
      );
      if (calculated) calculatedItems.push(calculated);
    });

    if (calculatedItems.length === 0) {
      setFormError('Please add at least one valid item with quantity and rate');
      return;
    }

    const { taxableAmountTotal, gstAmountTotal, grandTotal } =
      calculateTotals(calculatedItems);

    let igstTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;

    if (form.supplyType === "INTER") {
      igstTotal = gstAmountTotal;
    } else {
      cgstTotal = gstAmountTotal / 2;
      sgstTotal = gstAmountTotal / 2;
    }

    const nextId = editingInvoice ? editingInvoice.id : currentInvoiceNumber;
    const nextInvoiceNumber = editingInvoice
      ? editingInvoice.invoiceNumber
      : `INV-${String(currentInvoiceNumber).padStart(4, "0")}`;

    const nowIso = new Date().toISOString();
    const actor = getAuditActor();
    const createdAt = editingInvoice?.createdAt || nowIso;
    const createdById = editingInvoice?.createdById || actor.id || undefined;
    const createdByName = editingInvoice?.createdByName || actor.name || undefined;

    const newInvoice: Invoice = {
      id: nextId,
      invoiceNumber: nextInvoiceNumber,
      date: form.date,
      dueDate: form.dueDate,
      supplyType: form.supplyType,
      customerId: selectedCustomerId || undefined,
      paymentTerms: form.paymentTerms,
      createdAt,
      createdById,
      createdByName,
      updatedAt: nowIso,
      updatedById: actor.id || undefined,
      updatedByName: actor.name || undefined,
      billTo: {
        name: form.billToName.trim(),
        address: form.billToAddress.trim(),
        gstin: form.billToGstin.trim(),
        mobile: form.billToMobile.trim(),
      },
      shipTo: {
        name: form.shipToName.trim() || form.billToName.trim(),
        address: form.shipToAddress.trim() || form.billToAddress.trim(),
        gstin: form.shipToGstin.trim() || form.billToGstin.trim(),
        mobile: form.shipToMobile.trim() || form.billToMobile.trim(),
      },
      items: calculatedItems,
      taxableAmountTotal,
      gstAmountTotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      grandTotal,
    };

    const hostBase = getHostBaseUrl();
    if (hostBase) {
      try {
        await docApi.upsertDoc('invoice', String(newInvoice.id), {
          docNumber: newInvoice.invoiceNumber,
          date: newInvoice.date,
          partyName: newInvoice.billTo?.name,
          amount: newInvoice.grandTotal,
          payload: newInvoice,
          createdAt: newInvoice.createdAt,
          createdById: newInvoice.createdById,
          createdByName: newInvoice.createdByName,
          updatedAt: newInvoice.updatedAt,
          updatedById: newInvoice.updatedById,
          updatedByName: newInvoice.updatedByName,
        });
      } catch (e: any) {
        alert(e?.message ?? 'Failed to sync invoice to host');
        return;
      }
    }

     try {
       const nextAmount = Number(newInvoice.grandTotal ?? 0) || 0;
       const nextCustomerId = String(newInvoice.customerId ?? '').trim() || undefined;

       if (editingInvoice) {
         const prevAmount = Number((editingInvoice as any)?.grandTotal ?? 0) || 0;
         const prevCustomerId = String((editingInvoice as any)?.customerId ?? '').trim() || undefined;

         if (prevCustomerId && nextCustomerId && String(prevCustomerId) !== String(nextCustomerId)) {
           const prevUpdated = updateCustomerBalance(prevCustomerId, String((editingInvoice as any)?.billTo?.name ?? ''), -prevAmount);
           const nextUpdated = updateCustomerBalance(nextCustomerId, String(newInvoice.billTo?.name ?? ''), nextAmount);
           try {
             if (prevUpdated) await syncCustomerDocIfPossible(String(prevUpdated?.id ?? prevCustomerId), String(prevUpdated?.name ?? ''), nowIso);
             if (nextUpdated) await syncCustomerDocIfPossible(String(nextUpdated?.id ?? nextCustomerId), String(nextUpdated?.name ?? ''), nowIso);
           } catch {
             // ignore
           }
         } else {
           const delta = nextAmount - prevAmount;
           if (delta !== 0) {
             const updated = updateCustomerBalance(nextCustomerId ?? prevCustomerId, String(newInvoice.billTo?.name ?? ''), delta);
             try {
               if (updated) await syncCustomerDocIfPossible(String(updated?.id ?? nextCustomerId ?? prevCustomerId), String(updated?.name ?? ''), nowIso);
             } catch {
               // ignore
             }
           }
         }
       } else {
         const updated = updateCustomerBalance(nextCustomerId, String(newInvoice.billTo?.name ?? ''), nextAmount);
         try {
           if (updated) await syncCustomerDocIfPossible(String(updated?.id ?? nextCustomerId), String(updated?.name ?? ''), nowIso);
         } catch {
           // ignore
         }
       }

       dispatch(fetchCustomers({ page: 1, limit: 1000 } as any));
     } catch {
       // ignore
     }

    if (editingInvoice) {
      setInvoices((prev) => prev.map((inv) => (String(inv.id) === String(editingInvoice.id) ? newInvoice : inv)));
    } else {
      setInvoices((prev) => [newInvoice, ...prev]);
      setCurrentInvoiceNumber((n) => n + 1);
    }
    setIsDialogOpen(false);
    setEditingInvoice(null);
    if (!editingInvoice) {
      handlePrint(newInvoice);
    }
  };

  const printHtml = (html: string) => {
    const isTauriRuntime = () => {
      try {
        if ((window as any).__TAURI__ != null) return true;
        if ((window as any).__TAURI_INTERNALS__ != null) return true;
        if ((window as any).__TAURI_IPC__ != null) return true;
        if ((window as any).__TAURI_METADATA__ != null) return true;
        if ((navigator as any)?.userAgent && String((navigator as any).userAgent).toLowerCase().includes('tauri')) return true;
        if (window.location.hostname === 'tauri.localhost') return true;
        const p = window.location.protocol;
        return p === 'tauri:' || p === 'file:';
      } catch {
        return false;
      }
    };

    if (isTauriRuntime()) {
      try {
        localStorage.setItem('pve_print_html', html);
      } catch {
        // ignore
      }

      try {
        const label = `print_${Date.now()}`;
        const url = '/#/print';
        const w = new WebviewWindow(label, {
          url,
          title: 'Print',
          width: 900,
          height: 650,
          resizable: true,
          focus: true,
          visible: true,
        });
        w.once('tauri://error', (e: any) => {
          try {
            alert(`Print window failed: ${String(e?.payload ?? e ?? '')}`);
          } catch {
            // ignore
          }
        });
        return;
      } catch {
        // fallthrough to iframe
      }
    }

    if (!isTauriRuntime()) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        const doPrint = () => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch {
            alert('Printing blocked. Please allow print or try again.');
          }
        };

        setTimeout(doPrint, 250);
        return;
      }
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const cleanup = () => {
      try {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      } catch {
        // ignore
      }
    };

    const cw = iframe.contentWindow;
    if (!cw) {
      cleanup();
      alert('Printing blocked. Please try again.');
      return;
    }

    const attachCleanup = () => {
      try {
        cw.onafterprint = () => cleanup();
      } catch {
        // ignore
      }
      setTimeout(cleanup, 15000);
    };

    const attemptPrint = () => {
      try {
        cw.focus();
        cw.print();
        attachCleanup();
        return true;
      } catch {
        return false;
      }
    };

    // Fallback: some runtimes only allow printing once the iframe load event fires.
    iframe.onload = () => {
      if (!attemptPrint()) {
        alert('Printing blocked. Please try again.');
        cleanup();
      }
    };

    try {
      (iframe as any).srcdoc = html;
    } catch {
      const cd = iframe.contentDocument || cw.document;
      cd.open();
      cd.write(html);
      cd.close();
    }

    // Primary path: try printing immediately in the same user-gesture tick.
    // If the content isn't ready yet, iframe.onload above will retry.
    if (!attemptPrint()) {
      // no-op, onload will retry
    }
  };

  const handlePrint = (invoice: Invoice) => {
    if (!canPrint) {
      alert('You do not have permission to print invoices');
      return;
    }
    const html = generateInvoiceHTMLForPrint(invoice);
    printHtml(html);
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (!canDelete) {
      alert('You do not have permission to delete invoices');
      return;
    }
    const ok = window.confirm(`Delete invoice ${String(invoice.invoiceNumber ?? invoice.id)}?`);
    if (!ok) return;

    const dv = validateTransactionDate(String((invoice as any)?.date ?? ''));
    if (!dv.ok) {
      alert(dv.message);
      return;
    }

    try {
      const base = getHostBaseUrl();
      if (base) {
        await docApi.deleteDoc('invoice', String(invoice.id));
      }

       try {
         const amount = Number((invoice as any)?.grandTotal ?? 0) || 0;
         const customerId = String((invoice as any)?.customerId ?? '').trim() || undefined;
         const updated = updateCustomerBalance(customerId, String((invoice as any)?.billTo?.name ?? ''), -amount);
         try {
           if (updated) await syncCustomerDocIfPossible(String(updated?.id ?? customerId), String(updated?.name ?? ''), new Date().toISOString());
         } catch {
           // ignore
         }
         dispatch(fetchCustomers({ page: 1, limit: 1000 } as any));
       } catch {
         // ignore
       }

      setInvoices((prev) => prev.filter((x) => String(x.id) !== String(invoice.id)));
    } catch (e: any) {
      alert(e?.message ?? 'Failed to delete invoice');
    }
  };

  // Live totals preview for current form
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

  const handleSortChange = (sortByValue: 'date' | 'amount' | 'customer') => {
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

  // Apply filters to invoices
  const getFilteredInvoices = () => {
    let filtered = [...invoices];

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(invoice =>
        invoice.invoiceNumber.toLowerCase().includes(search) ||
        invoice.billTo.name.toLowerCase().includes(search)
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
        case 'customer':
          aValue = a.billTo.name.toLowerCase();
          bValue = b.billTo.name.toLowerCase();
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

  const getPreviewTotals = () => {
    const itemsPreview: InvoiceItem[] = [];
    const cdDiscountPercent = Number(form.cdDiscountPercent || 0);
    form.items.forEach((itemForm, idx) => {
      const calc = calculateItem(itemForm, idx + 1, cdDiscountPercent, gstEnabled);
      if (calc) itemsPreview.push(calc);
    });
    const { taxableAmountTotal, gstAmountTotal, grandTotal } =
      calculateTotals(itemsPreview);

    let igstTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;

    if (form.supplyType === "INTER") {
      igstTotal = gstAmountTotal;
    } else {
      cgstTotal = gstAmountTotal / 2;
      sgstTotal = gstAmountTotal / 2;
    }

    return { taxableAmountTotal, gstAmountTotal, grandTotal, igstTotal, cgstTotal, sgstTotal };
  };

  const previewTotals = getPreviewTotals();

  return (
    <Box p={3}>
      {/* Print-only styles to avoid full-screen capture */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            font-family: "Segoe UI", "Arial", "Helvetica", sans-serif;
            font-size: 10pt;
          }
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 190mm;
            padding: 0 6mm 8mm 6mm;
            color: #111;
            background: #fff;
          }
          #print-area .print-card { width: 100%; border: 1px solid #000; padding: 8px; }
          #print-area h1, #print-area h2, #print-area h3, #print-area h4, #print-area h5, #print-area h6 { margin: 0 0 6px 0; color: #000; font-weight: 700; }
          #print-area p { margin: 1px 0; color: #111; }
          #print-area table { border-collapse: collapse; width: 100%; margin-top: 6px; }
          #print-area th, #print-area td { border: 1px solid #000; padding: 4px 6px; font-size: 9.5pt; color: #111; }
          #print-area th { background: #f3f3f3; font-weight: 700; }
          #print-area .text-right { text-align: right; }
          #print-area .text-center { text-align: center; }
          #print-area .small { font-size: 8.8pt; color: #222; }
          #print-area .muted { color: #444; }
          #print-area .section-title { margin: 6px 0 4px; font-weight: 700; }
          #print-area .totals { margin-top: 8px; }
          #print-area .totals table { width: 60mm; margin-left: auto; }
          #print-area .totals td { border: 0; padding: 3px 4px; }
          #print-area .totals tr.total td { font-weight: 700; border-top: 1px solid #000; }
          #print-area .signature { margin-top: 18px; display: flex; justify-content: space-between; font-size: 9pt; }
          .MuiDialog-root, .MuiDialog-paper { box-shadow: none !important; }
        }
      `}</style>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">Customer Creation</Typography>
          <Typography variant="body2" color="textSecondary">
            Capture customer details and keep them ready for invoice creation.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          onClick={openNewInvoiceDialog}
          startIcon={<AddIcon />}
          disabled={!canCreate}
        >
          New Invoice
        </Button>
      </Box>

      {/* Enhanced Filtering */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <TextField
            placeholder="Search by invoice number or customer name..."
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
            {sortBy === 'date' ? 'Date' : sortBy === 'amount' ? 'Amount' : 'Customer'}
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
                      <MenuItem value="customer">Customer</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}
      </Paper>

      {/* Invoices List */}
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Invoice #</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Customer (Bill To)</TableCell>
              <TableCell>Created By</TableCell>
              <TableCell>Mobile</TableCell>
              <TableCell align="right">Taxable (₹)</TableCell>
              {gstEnabled ? <TableCell align="right">GST (₹)</TableCell> : null}
              <TableCell align="right">Total (₹)</TableCell>
              <TableCell align="center">Schemes</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {getFilteredInvoices().length === 0 ? (
              <TableRow>
                <TableCell colSpan={gstEnabled ? 10 : 9} align="center">
                  No invoices yet. Click &quot;New Invoice&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              getFilteredInvoices().map((inv) => {
                const schemeCount = (inv.items || []).filter((it: any) => it.appliedSchemeId).length;
                return (
                  <TableRow key={inv.id} hover>
                    <TableCell>{inv.invoiceNumber}</TableCell>
                    <TableCell>{new Date(inv.date).toLocaleDateString()}</TableCell>
                    <TableCell>{inv.billTo.name}</TableCell>
                    <TableCell>{String((inv as any).createdByName ?? (inv as any).createdBy ?? '-')}</TableCell>
                    <TableCell>{inv.billTo.mobile}</TableCell>
                    <TableCell align="right">{formatMoney(inv.taxableAmountTotal)}</TableCell>
                    {gstEnabled ? <TableCell align="right">{formatMoney(inv.gstAmountTotal)}</TableCell> : null}
                    <TableCell align="right">{formatMoney(inv.grandTotal)}</TableCell>
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
                      <IconButton onClick={() => openEditInvoiceDialog(inv)} size="small" disabled={!canEdit}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton onClick={() => handlePrint(inv)} size="small" disabled={!canPrint}>
                        <PrintIcon fontSize="small" />
                      </IconButton>
                      <IconButton onClick={() => handleDeleteInvoice(inv)} size="small" color="error" disabled={!canDelete}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* New Invoice Dialog */}
      <Dialog open={isDialogOpen} onClose={closeDialog} fullWidth maxWidth="lg">
        <DialogTitle>{editingInvoice ? 'Edit Invoice' : 'New Invoice'}</DialogTitle>
        <DialogContent dividers>
          {/* Error Display */}
          {formError && (
            <Box sx={{ mb: 2 }}>
              <Typography color="error" variant="body2">
                {formError}
              </Typography>
            </Box>
          )}
          
          <Box component="form" onSubmit={handleSubmit} mt={1}>
            {/* Top row: Invoice info & supply type */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Invoice Number"
                  value={
                    editingInvoice
                      ? editingInvoice.invoiceNumber
                      : `INV-${currentInvoiceNumber.toString().padStart(4, "0")}`
                  }
                  fullWidth
                  margin="normal"
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Invoice Date"
                  type="date"
                  value={form.date}
                  onChange={handleFormChange("date")}
                  fullWidth
                  margin="normal"
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Due Date"
                  type="date"
                  value={form.dueDate}
                  onChange={handleFormChange("dueDate")}
                  fullWidth
                  margin="normal"
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              {gstEnabled ? (
                <Grid item xs={12} sm={3}>
                  <TextField
                    select
                    label="Supply Type"
                    value={form.supplyType}
                    onChange={handleFormChange("supplyType")}
                    fullWidth
                    margin="normal"
                  >
                    <MenuItem value="INTRA">Intra-State (CGST + SGST)</MenuItem>
                    <MenuItem value="INTER">Inter-State (IGST)</MenuItem>
                  </TextField>
                </Grid>
              ) : null}

              <Grid item xs={12} sm={3}>
                <TextField
                  label="Payment Terms"
                  select
                  value={form.paymentTerms}
                  onChange={handleFormChange("paymentTerms")}
                  fullWidth
                  margin="normal"
                  helperText="Select payment terms for this invoice"
                >
                  <MenuItem value="">Select Payment Terms</MenuItem>
                  <MenuItem value="Due on Receipt">Due on Receipt</MenuItem>
                  <MenuItem value="Net 15">Net 15 Days</MenuItem>
                  <MenuItem value="Net 30">Net 30 Days</MenuItem>
                  <MenuItem value="Net 45">Net 45 Days</MenuItem>
                  <MenuItem value="Net 60">Net 60 Days</MenuItem>
                  <MenuItem value="2/10 Net 30">2/10 Net 30 (2% discount in 10 days)</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  label="CD Discount (%)"
                  value={form.cdDiscountPercent}
                  onChange={handleFormChange("cdDiscountPercent")}
                  type="number"
                  fullWidth
                  margin="normal"
                  inputProps={{ min: 0, step: "0.01" }}
                  helperText="Cash discount applied before GST"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Bill To / Ship To */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Bill To
                </Typography>
                <Autocomplete
                  options={Array.isArray(customersFromStore) ? (customersFromStore as any[]) : []}
                  getOptionLabel={(option: any) => String(option?.name ?? '')}
                  value={
                    (Array.isArray(customersFromStore)
                      ? (customersFromStore as any[]).find(
                          (c: any) => String(c?.name ?? '').toLowerCase() === String(form.billToName ?? '').toLowerCase()
                        )
                      : null) ?? null
                  }
                  onChange={(_, value: any) => {
                    if (!value) return;
                    setSelectedCustomerId(String(value.id ?? ''));
                    setForm((prev) => ({
                      ...prev,
                      billToName: String(value.name ?? ''),
                      billToMobile: String(value.phone ?? ''),
                      billToGstin: String(value.gstin ?? ''),
                      billToAddress: `${String(value.addressLine1 ?? '')}${value.addressLine2 ? `, ${String(value.addressLine2)}` : ''}${value.city ? `, ${String(value.city)}` : ''}${value.state ? `, ${String(value.state)}` : ''}${value.pincode ? ` - ${String(value.pincode)}` : ''}`.trim(),
                      shipToName: prev.shipToName || String(value.name ?? ''),
                      shipToMobile: prev.shipToMobile || String(value.phone ?? ''),
                      shipToGstin: prev.shipToGstin || String(value.gstin ?? ''),
                      shipToAddress:
                        prev.shipToAddress ||
                        `${String(value.addressLine1 ?? '')}${value.addressLine2 ? `, ${String(value.addressLine2)}` : ''}${value.city ? `, ${String(value.city)}` : ''}${value.state ? `, ${String(value.state)}` : ''}${value.pincode ? ` - ${String(value.pincode)}` : ''}`.trim(),
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Customer Name"
                      fullWidth
                      margin="normal"
                      required
                      onChange={(e) => {
                        setSelectedCustomerId('');
                        setForm((prev) => ({ ...prev, billToName: e.target.value }));
                      }}
                    />
                  )}
                />
                <TextField
                  label="Address"
                  value={form.billToAddress}
                  onChange={handleFormChange("billToAddress")}
                  fullWidth
                  margin="normal"
                  multiline
                  minRows={2}
                />
                {gstEnabled ? (
                  <TextField
                    label="GSTIN"
                    value={form.billToGstin}
                    onChange={handleFormChange("billToGstin")}
                    fullWidth
                    margin="normal"
                  />
                ) : null}
                <TextField
                  label="Mobile"
                  value={form.billToMobile}
                  onChange={handleFormChange("billToMobile")}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Ship To
                </Typography>
                <TextField
                  label="Name"
                  value={form.shipToName}
                  onChange={handleFormChange("shipToName")}
                  fullWidth
                  margin="normal"
                  placeholder="Leave blank to use Bill To"
                />
                <TextField
                  label="Address"
                  value={form.shipToAddress}
                  onChange={handleFormChange("shipToAddress")}
                  fullWidth
                  margin="normal"
                  multiline
                  minRows={2}
                  placeholder="Leave blank to use Bill To"
                />
                {gstEnabled ? (
                  <TextField
                    label="GSTIN"
                    value={form.shipToGstin}
                    onChange={handleFormChange("shipToGstin")}
                    fullWidth
                    margin="normal"
                    placeholder="Leave blank to use Bill To"
                  />
                ) : null}
                <TextField
                  label="Mobile"
                  value={form.shipToMobile}
                  onChange={handleFormChange("shipToMobile")}
                  fullWidth
                  margin="normal"
                  placeholder="Leave blank to use Bill To"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Items Table */}
            <Typography variant="subtitle1" gutterBottom>
              Items
            </Typography>
            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="22%">Item (search & select)</TableCell>
                    <TableCell>HSN/SAC</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">MRP (₹)</TableCell>
                    <TableCell align="right">Discount (₹)</TableCell>
                    <TableCell align="right">Rate (₹)</TableCell>
                    {gstEnabled ? <TableCell align="right">GST %</TableCell> : null}
                    <TableCell align="right">Incl. Price / Unit (₹)</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {form.items.map((item, index) => {
                    const rateNum = Number(item.rate || "0") || 0;
                    const gstNum = gstEnabled ? Number(item.gstRate || "0") || 0 : 0;
                    const inclFallback = perUnitInclusivePrice(rateNum, gstNum);

                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <Autocomplete
                            size="small"
                            options={productOptions}
                            getOptionLabel={(option) => option.name}
                            onChange={(_, value) => handleProductSelect(index, value)}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                variant="standard"
                                placeholder="Search item"
                                value={item.description}
                                onChange={(e) =>
                                  handleItemChange(index, "description")(e as any)
                                }
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={item.hsn}
                            onChange={handleItemChange(index, "hsn")}
                            fullWidth
                            variant="standard"
                            placeholder="HSN/SAC"
                          />
                        </TableCell>
                        <TableCell align="right" style={{ minWidth: 80 }}>
                          <TextField
                            value={item.qty}
                            onChange={handleItemChange(index, "qty")}
                            type="number"
                            variant="standard"
                            fullWidth
                            inputProps={{ min: 0, step: "1" }}
                          />
                        </TableCell>
                        <TableCell align="right" style={{ minWidth: 110 }}>
                          <TextField
                            value={item.mrp}
                            onChange={handleItemChange(index, "mrp")}
                            type="number"
                            variant="standard"
                            fullWidth
                            inputProps={{ min: 0, step: "0.01" }}
                          />
                        </TableCell>
                        <TableCell align="right" style={{ minWidth: 90 }}>
                          <TextField
                            value={item.discountPercent}
                            onChange={handleItemChange(index, "discountPercent")}
                            type="number"
                            variant="standard"
                            fullWidth
                            inputProps={{ min: 0, step: "0.01" }}
                            placeholder="Discount (₹)"
                          />
                        </TableCell>
                        <TableCell align="right" style={{ minWidth: 110 }}>
                          <TextField
                            value={item.rate}
                            onChange={handleItemChange(index, "rate")}
                            type="number"
                            variant="standard"
                            fullWidth
                            inputProps={{ min: 0, step: "0.01" }}
                            placeholder="Auto from MRP-Discount"
                          />
                        </TableCell>
                        {gstEnabled ? (
                          <TableCell align="right" style={{ minWidth: 80 }}>
                            <TextField
                              value={item.gstRate}
                              onChange={handleItemChange(index, "gstRate")}
                              type="number"
                              variant="standard"
                              fullWidth
                              inputProps={{ min: 0, step: "0.1" }}
                            />
                          </TableCell>
                        ) : null}
                        <TableCell align="right" style={{ minWidth: 130 }}>
                          <TextField
                            value={item.inclusivePrice}
                            onChange={handleItemChange(index, "inclusivePrice")}
                            type="number"
                            variant="standard"
                            fullWidth
                            inputProps={{ min: 0, step: "0.01" }}
                            placeholder={formatMoney(inclFallback || 0)}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton onClick={() => removeItemRow(index)} size="small">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  <TableRow>
                    <TableCell colSpan={9}>
                      <Button startIcon={<AddIcon />} onClick={addItemRow} size="small">
                        Add Item
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
          </Box>
        </DialogContent>

        {/* Totals preview */}
        <DialogActions sx={{ flexDirection: "column", alignItems: "stretch" }}>
          <Box display="flex" justifyContent="flex-end" width="100%" mb={1}>
            <Box textAlign="right">
              <Typography variant="body2">
                Taxable Amount: ₹ {formatMoney(previewTotals.taxableAmountTotal)}
              </Typography>
              {gstEnabled ? (
                <Typography variant="body2">
                  Total GST: ₹ {formatMoney(previewTotals.gstAmountTotal)}
                </Typography>
              ) : null}
              {gstEnabled ? (
                <Typography variant="body2">
                  CGST: ₹ {formatMoney(previewTotals.cgstTotal)} | SGST: ₹{" "}
                  {formatMoney(previewTotals.sgstTotal)} | IGST: ₹{" "}
                  {formatMoney(previewTotals.igstTotal)}
                </Typography>
              ) : null}
              <Typography variant="subtitle1" fontWeight="bold">
                Grand Total: ₹ {formatMoney(previewTotals.grandTotal)}
              </Typography>
            </Box>
          </Box>

          <Box display="flex" justifyContent="flex-end" width="100%">
            <Button onClick={closeDialog} sx={{ mr: 1 }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              Save Invoice
            </Button>
          </Box>
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
};

export default Invoices;
