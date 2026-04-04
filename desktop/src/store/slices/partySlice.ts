// src/store/slices/partySlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { docApi, getHostBaseUrl } from '../../services/docApi';

const API = (import.meta.env?.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '');

const isOfflineRuntime = () => {
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

const ensureJson = async (res: Response) => {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const txt = await res.text();
    throw new Error(`Unexpected response (${ct || 'unknown'}): ${txt.slice(0, 160)}`);
  }
  return res.json();
};

const isLanDocsEnabled = () => {
  try {
    return !!getHostBaseUrl();
  } catch {
    return false;
  }
};

export interface Party {
  id: string;
  name: string;
  balance?: number;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Customer {
  id: string;
  name: string;
  code?: string;
  phone: string;
  email?: string;
  whatsapp?: string;
  gstin?: string;
  pan?: string;
  group: 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR' | 'VIP';
  creditLimit: number;
  creditDays: number;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  code?: string;
  phone: string;
  email?: string;
  whatsapp?: string;
  gstin?: string;
  pan?: string;
  creditDays: number;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type?: string;
  reference?: string;
  description?: string;
  debit?: number;
  credit?: number;
  balance?: number;
  paymentStatus?: string;
}

export interface PartyFilters {
  q?: string;
  minBalance?: number;
  maxBalance?: number;

  // For customers/suppliers lists
  search?: string;
  page?: number;
  limit?: number;
  hasOutstanding?: boolean;
  hasPayable?: boolean;
  group?: string;
}

export interface PartyState {
  parties: Party[];
  customers: Customer[];
  suppliers: Supplier[];         // NEW: suppliers list
  currentParty: Party | null;
  filters: PartyFilters;
  customerLedger: LedgerEntry[];
  partyLedger?: {
    summary: {
      totalDebit: number;
      totalCredit: number;
      closingBalance: number;
    };
    transactions: LedgerEntry[];
  };
  ledgerLoading: boolean;
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Helper functions for localStorage persistence
const getStoredCustomers = (): Customer[] => {
  try {
    const stored = localStorage.getItem('pve_customers');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed;
    }
  } catch (e) {
    console.error("Failed to parse customers from localStorage", e);
    localStorage.removeItem('pve_customers');
  }
  return [];
};

const saveCustomers = (customers: Customer[]) => {
  localStorage.setItem('pve_customers', JSON.stringify(customers));
};

const getStoredSuppliers = (): Supplier[] => {
  try {
    const stored = localStorage.getItem('pve_suppliers');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed;
    }
  } catch (e) {
    console.error("Failed to parse suppliers from localStorage", e);
    localStorage.removeItem('pve_suppliers');
  }
  return [];
};

const saveSuppliers = (suppliers: Supplier[]) => {
  localStorage.setItem('pve_suppliers', JSON.stringify(suppliers));
};

const toDateSafe = (value: any): Date | null => {
  try {
    const d = new Date(String(value ?? ''));
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const isInRange = (dateStr: any, fromDate?: string, toDate?: string) => {
  const d = toDateSafe(dateStr);
  if (!d) return false;
  if (fromDate) {
    const f = toDateSafe(fromDate);
    if (f && d.getTime() < f.getTime()) return false;
  }
  if (toDate) {
    const t = toDateSafe(toDate);
    if (t) {
      const end = new Date(t);
      end.setHours(23, 59, 59, 999);
      if (d.getTime() > end.getTime()) return false;
    }
  }
  return true;
};

const getStoredSalesInvoices = (): any[] => {
  try {
    const raw = localStorage.getItem('pve_invoicepro_invoices');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getStoredPurchaseBills = (): any[] => {
  try {
    const raw = localStorage.getItem('pve_invoicepro_purchase_invoices');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getStoredCreditNotes = (): any[] => {
  try {
    const raw = localStorage.getItem('pve_invoicepro_credit_notes');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getStoredDebitNotes = (): any[] => {
  try {
    const raw = localStorage.getItem('pve_invoicepro_debit_notes');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getStoredPayments = (): any[] => {
  try {
    const raw = localStorage.getItem('pve_invoicepro_payments');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getStoredSalesInvoicesSmart = async (): Promise<any[]> => {
  if (isLanDocsEnabled()) {
    try {
      return await docApi.listPayloads<any>('invoice');
    } catch {
      // fall back
    }
  }
  return getStoredSalesInvoices();
};

const getStoredPaymentsSmart = async (): Promise<any[]> => {
  if (isLanDocsEnabled()) {
    try {
      return await docApi.listPayloads<any>('payment');
    } catch {
      // fall back
    }
  }
  return getStoredPayments();
};

const getStoredPurchaseBillsSmart = async (): Promise<any[]> => {
  if (isLanDocsEnabled()) {
    try {
      const rows = await docApi.listPayloads<any>('purchase_invoice');
      try {
        localStorage.setItem('pve_invoicepro_purchase_invoices', JSON.stringify(rows));
      } catch {
        // ignore
      }
      return rows;
    } catch {
      // fall back
    }
  }
  return getStoredPurchaseBills();
};

const getStoredDebitNotesSmart = async (): Promise<any[]> => {
  if (isLanDocsEnabled()) {
    try {
      const rows = await docApi.listPayloads<any>('debit_note');
      try {
        localStorage.setItem('pve_invoicepro_debit_notes', JSON.stringify(rows));
      } catch {
        // ignore
      }
      return rows;
    } catch {
      // fall back
    }
  }
  return getStoredDebitNotes();
};

const getStoredCreditNotesSmart = async (): Promise<any[]> => {
  if (isLanDocsEnabled()) {
    try {
      const rows = await docApi.listPayloads<any>('credit_note');
      try {
        localStorage.setItem('pve_invoicepro_credit_notes', JSON.stringify(rows));
      } catch {
        // ignore
      }
      return rows;
    } catch {
      // fall back
    }
  }
  return getStoredCreditNotes();
};

const buildLanCustomerLedger = async (customerId: string, fromDate?: string, toDate?: string) => {
  const customers = getStoredCustomers();
  const customer = customers.find((c) => String(c.id) === String(customerId));
  if (!customer) throw new Error('Customer not found');

  const nameKey = String(customer.name ?? '').trim().toLowerCase();
  const invoicesAll = await getStoredSalesInvoicesSmart();
  const invoices = invoicesAll.filter((inv) => {
    const invCustomerId = String(inv?.customerId ?? inv?.partyId ?? inv?.billToId ?? '').trim();
    if (invCustomerId && String(invCustomerId) === String(customerId)) {
      return isInRange(inv?.date, fromDate, toDate);
    }
    const billToName = String(inv?.billTo?.name ?? inv?.billToName ?? inv?.customerName ?? '').trim().toLowerCase();
    if (!nameKey || !billToName) return false;
    if (billToName !== nameKey) return false;
    return isInRange(inv?.date, fromDate, toDate);
  });

  const creditNotesAll = await getStoredCreditNotesSmart();
  const creditNotes = creditNotesAll.filter((cn) => {
    const cnCustomerId = String(cn?.customerId ?? cn?.partyId ?? '').trim();
    if (cnCustomerId && String(cnCustomerId) === String(customerId)) {
      return isInRange(cn?.date, fromDate, toDate);
    }
    const custName = String(cn?.customer?.name ?? cn?.customerName ?? '').trim().toLowerCase();
    if (!nameKey || !custName) return false;
    if (custName !== nameKey) return false;
    return isInRange(cn?.date, fromDate, toDate);
  });

  const paymentsAll = await getStoredPaymentsSmart();
  const payments = paymentsAll.filter((p) => {
    const partyType = String(p?.partyType ?? '').toUpperCase();
    if (partyType !== 'CUSTOMER') return false;
    const partyId = String(p?.partyId ?? '').trim();
    if (partyId && String(partyId) === String(customerId)) {
      return isInRange(p?.date, fromDate, toDate);
    }
    return false;
  });

  const events: Array<{ kind: 'invoice' | 'credit_note' | 'payment'; date: any; payload: any }> = [
    ...invoices.map((inv) => ({ kind: 'invoice' as const, date: inv?.date, payload: inv })),
    ...creditNotes.map((cn) => ({ kind: 'credit_note' as const, date: cn?.date, payload: cn })),
    ...payments.map((p) => ({ kind: 'payment' as const, date: p?.date, payload: p })),
  ].sort((a, b) => (toDateSafe(a?.date)?.getTime() ?? 0) - (toDateSafe(b?.date)?.getTime() ?? 0));

  let running = Number(customer.openingBalance ?? 0) || 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const transactions: LedgerEntry[] = events.map((ev, idx) => {
    if (ev.kind === 'invoice') {
      const inv = ev.payload;
      const debit = Number(inv?.grandTotal ?? inv?.amount ?? 0) || 0;
      running += debit;
      totalDebit += debit;
      return {
        id: String(inv?.id ?? inv?.invoiceNumber ?? `inv-${idx}`),
        date: String(inv?.date ?? ''),
        type: 'SALES_INVOICE',
        reference: String(inv?.invoiceNumber ?? ''),
        description: `Invoice ${String(inv?.invoiceNumber ?? '')}`.trim(),
        debit,
        credit: 0,
        balance: running,
        paymentStatus: String(inv?.paymentStatus ?? 'UNPAID'),
      };
    }

    if (ev.kind === 'payment') {
      const p = ev.payload;
      const amount = Number(p?.amount ?? 0) || 0;
      const pType = String(p?.type ?? '').toUpperCase();
      const isReceipt = pType === 'RECEIPT';
      const debit = isReceipt ? 0 : amount;
      const credit = isReceipt ? amount : 0;
      running += debit;
      running -= credit;
      totalDebit += debit;
      totalCredit += credit;
      return {
        id: String(p?.id ?? `pay-${idx}`),
        date: String(p?.date ?? ''),
        type: 'PAYMENT',
        reference: String(p?.referenceNumber ?? ''),
        description: (isReceipt ? 'Receipt' : 'Payment').trim(),
        debit,
        credit,
        balance: running,
      };
    }

    const cn = ev.payload;
    const credit = Number(cn?.amount ?? cn?.grandTotal ?? 0) || 0;
    running -= credit;
    totalCredit += credit;
    return {
      id: String(cn?.id ?? cn?.creditNoteNumber ?? `cn-${idx}`),
      date: String(cn?.date ?? ''),
      type: 'SALES_RETURN',
      reference: String(cn?.creditNoteNumber ?? ''),
      description: `Credit Note ${String(cn?.creditNoteNumber ?? '')}`.trim(),
      debit: 0,
      credit,
      balance: running,
    };
  });

  return {
    summary: {
      totalDebit,
      totalCredit,
      closingBalance: running,
    },
    transactions,
  };
};

const buildLanSupplierLedger = async (supplierId: string, fromDate?: string, toDate?: string) => {
  const suppliers = getStoredSuppliers();
  const supplier = suppliers.find((s) => String(s.id) === String(supplierId));
  if (!supplier) throw new Error('Supplier not found');

  const nameKey = String(supplier.name ?? '').trim().toLowerCase();
  const billsAll = await getStoredPurchaseBillsSmart();
  const bills = billsAll.filter((inv) => {
    const invSupplierId = String(inv?.supplierId ?? inv?.partyId ?? '').trim();
    if (invSupplierId && String(invSupplierId) === String(supplierId)) {
      return isInRange(inv?.date, fromDate, toDate);
    }
    const partyName = String(inv?.party?.name ?? inv?.supplierName ?? '').trim().toLowerCase();
    if (!nameKey || !partyName) return false;
    if (partyName !== nameKey) return false;
    return isInRange(inv?.date, fromDate, toDate);
  });

  const debitNotesAll = await getStoredDebitNotesSmart();
  const debitNotes = debitNotesAll.filter((dn) => {
    const dnSupplierId = String(dn?.supplierId ?? dn?.partyId ?? '').trim();
    if (dnSupplierId && String(dnSupplierId) === String(supplierId)) {
      return isInRange(dn?.date, fromDate, toDate);
    }
    const suppName = String(dn?.supplier?.name ?? dn?.supplierName ?? '').trim().toLowerCase();
    if (!nameKey || !suppName) return false;
    if (suppName !== nameKey) return false;
    return isInRange(dn?.date, fromDate, toDate);
  });

  const paymentsAll = await getStoredPaymentsSmart();
  const payments = paymentsAll.filter((p) => {
    const partyType = String(p?.partyType ?? '').toUpperCase();
    if (partyType !== 'SUPPLIER') return false;
    const partyId = String(p?.partyId ?? '').trim();
    if (partyId && String(partyId) === String(supplierId)) {
      return isInRange(p?.date, fromDate, toDate);
    }
    return false;
  });

  const events: Array<{ kind: 'purchase_bill' | 'debit_note' | 'payment'; date: any; payload: any }> = [
    ...bills.map((b) => ({ kind: 'purchase_bill' as const, date: b?.date, payload: b })),
    ...debitNotes.map((dn) => ({ kind: 'debit_note' as const, date: dn?.date, payload: dn })),
    ...payments.map((p) => ({ kind: 'payment' as const, date: p?.date, payload: p })),
  ].sort((a, b) => (toDateSafe(a?.date)?.getTime() ?? 0) - (toDateSafe(b?.date)?.getTime() ?? 0));

  let running = Number(supplier.openingBalance ?? 0) || 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const transactions: LedgerEntry[] = events.map((ev, idx) => {
    if (ev.kind === 'purchase_bill') {
      const inv = ev.payload;
      const credit = Number(inv?.grandTotal ?? inv?.amount ?? 0) || 0;
      running -= credit;
      totalCredit += credit;
      return {
        id: String(inv?.invoiceNumber ?? inv?.id ?? `pb-${idx}`),
        date: String(inv?.date ?? ''),
        type: 'PURCHASE_BILL',
        reference: String(inv?.invoiceNumber ?? ''),
        description: `Purchase Bill ${String(inv?.invoiceNumber ?? '')}`.trim(),
        debit: 0,
        credit,
        balance: running,
      };
    }

    if (ev.kind === 'payment') {
      const p = ev.payload;
      const amount = Number(p?.amount ?? 0) || 0;
      const pType = String(p?.type ?? '').toUpperCase();
      const isPayment = pType === 'PAYMENT';
      const debit = isPayment ? amount : 0;
      const credit = isPayment ? 0 : amount;
      running += debit;
      running -= credit;
      totalDebit += debit;
      totalCredit += credit;
      return {
        id: String(p?.id ?? `pay-${idx}`),
        date: String(p?.date ?? ''),
        type: 'PAYMENT',
        reference: String(p?.referenceNumber ?? ''),
        description: (isPayment ? 'Payment' : 'Receipt').trim(),
        debit,
        credit,
        balance: running,
      };
    }

    const dn = ev.payload;
    const debit = Number(dn?.amount ?? dn?.grandTotal ?? 0) || 0;
    running += debit;
    totalDebit += debit;
    return {
      id: String(dn?.id ?? dn?.debitNoteNumber ?? `dn-${idx}`),
      date: String(dn?.date ?? ''),
      type: 'PURCHASE_RETURN',
      reference: String(dn?.debitNoteNumber ?? ''),
      description: `Debit Note ${String(dn?.debitNoteNumber ?? '')}`.trim(),
      debit,
      credit: 0,
      balance: running,
    };
  });

  return {
    summary: {
      totalDebit,
      totalCredit,
      closingBalance: running,
    },
    transactions,
  };
};

const buildOfflineCustomerLedger = (customerId: string, fromDate?: string, toDate?: string) => {
  const customers = getStoredCustomers();
  const customer = customers.find((c) => String(c.id) === String(customerId));
  if (!customer) throw new Error('Customer not found');

  const nameKey = String(customer.name ?? '').trim().toLowerCase();
  const invoices = getStoredSalesInvoices().filter((inv) => {
    const invCustomerId = String(inv?.customerId ?? inv?.partyId ?? inv?.billToId ?? '').trim();
    if (invCustomerId && String(invCustomerId) === String(customerId)) {
      return isInRange(inv?.date, fromDate, toDate);
    }
    const billToName = String(inv?.billTo?.name ?? inv?.billToName ?? inv?.customerName ?? '').trim().toLowerCase();
    if (!nameKey || !billToName) return false;
    if (billToName !== nameKey) return false;
    return isInRange(inv?.date, fromDate, toDate);
  });

  const creditNotes = getStoredCreditNotes().filter((cn) => {
    const cnCustomerId = String(cn?.customerId ?? cn?.partyId ?? '').trim();
    if (cnCustomerId && String(cnCustomerId) === String(customerId)) {
      return isInRange(cn?.date, fromDate, toDate);
    }
    const custName = String(cn?.customer?.name ?? cn?.customerName ?? '').trim().toLowerCase();
    if (!nameKey || !custName) return false;
    if (custName !== nameKey) return false;
    return isInRange(cn?.date, fromDate, toDate);
  });

  const payments = getStoredPayments().filter((p) => {
    const partyType = String(p?.partyType ?? '').toUpperCase();
    if (partyType !== 'CUSTOMER') return false;
    const partyId = String(p?.partyId ?? '').trim();
    if (partyId && String(partyId) === String(customerId)) {
      return isInRange(p?.date, fromDate, toDate);
    }
    return false;
  });

  const events: Array<{ kind: 'invoice' | 'credit_note' | 'payment'; date: any; payload: any }> = [
    ...invoices.map((inv) => ({ kind: 'invoice' as const, date: inv?.date, payload: inv })),
    ...creditNotes.map((cn) => ({ kind: 'credit_note' as const, date: cn?.date, payload: cn })),
    ...payments.map((p) => ({ kind: 'payment' as const, date: p?.date, payload: p })),
  ].sort((a, b) => (toDateSafe(a?.date)?.getTime() ?? 0) - (toDateSafe(b?.date)?.getTime() ?? 0));

  let running = Number(customer.openingBalance ?? 0) || 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const transactions: LedgerEntry[] = events.map((ev, idx) => {
    if (ev.kind === 'invoice') {
      const inv = ev.payload;
      const debit = Number(inv?.grandTotal ?? inv?.amount ?? 0) || 0;
      running += debit;
      totalDebit += debit;
      return {
        id: String(inv?.id ?? inv?.invoiceNumber ?? `inv-${idx}`),
        date: String(inv?.date ?? ''),
        type: 'SALES_INVOICE',
        reference: String(inv?.invoiceNumber ?? ''),
        description: `Invoice ${String(inv?.invoiceNumber ?? '')}`.trim(),
        debit,
        credit: 0,
        balance: running,
        paymentStatus: String(inv?.paymentStatus ?? 'UNPAID'),
      };
    }

    if (ev.kind === 'payment') {
      const p = ev.payload;
      const amount = Number(p?.amount ?? 0) || 0;
      const pType = String(p?.type ?? '').toUpperCase();
      const isReceipt = pType === 'RECEIPT';
      const debit = isReceipt ? 0 : amount;
      const credit = isReceipt ? amount : 0;
      running += debit;
      running -= credit;
      totalDebit += debit;
      totalCredit += credit;
      return {
        id: String(p?.id ?? `pay-${idx}`),
        date: String(p?.date ?? ''),
        type: 'PAYMENT',
        reference: String(p?.referenceNumber ?? ''),
        description: (isReceipt ? 'Receipt' : 'Payment').trim(),
        debit,
        credit,
        balance: running,
      };
    }

    const cn = ev.payload;
    const credit = Number(cn?.amount ?? cn?.grandTotal ?? 0) || 0;
    running -= credit;
    totalCredit += credit;
    return {
      id: String(cn?.id ?? cn?.creditNoteNumber ?? `cn-${idx}`),
      date: String(cn?.date ?? ''),
      type: 'SALES_RETURN',
      reference: String(cn?.creditNoteNumber ?? ''),
      description: `Credit Note ${String(cn?.creditNoteNumber ?? '')}`.trim(),
      debit: 0,
      credit,
      balance: running,
    };
  });

  return {
    summary: {
      totalDebit,
      totalCredit,
      closingBalance: running,
    },
    transactions,
  };
};

const buildOfflineSupplierLedger = (supplierId: string, fromDate?: string, toDate?: string) => {
  const suppliers = getStoredSuppliers();
  const supplier = suppliers.find((s) => String(s.id) === String(supplierId));
  if (!supplier) throw new Error('Supplier not found');

  const nameKey = String(supplier.name ?? '').trim().toLowerCase();
  const bills = getStoredPurchaseBills().filter((inv) => {
    const invSupplierId = String(inv?.supplierId ?? inv?.partyId ?? '').trim();
    if (invSupplierId && String(invSupplierId) === String(supplierId)) {
      return isInRange(inv?.date, fromDate, toDate);
    }
    const partyName = String(inv?.party?.name ?? inv?.supplierName ?? '').trim().toLowerCase();
    if (!nameKey || !partyName) return false;
    if (partyName !== nameKey) return false;
    return isInRange(inv?.date, fromDate, toDate);
  });

  const debitNotes = getStoredDebitNotes().filter((dn) => {
    const dnSupplierId = String(dn?.supplierId ?? dn?.partyId ?? '').trim();
    if (dnSupplierId && String(dnSupplierId) === String(supplierId)) {
      return isInRange(dn?.date, fromDate, toDate);
    }
    const suppName = String(dn?.supplier?.name ?? dn?.supplierName ?? '').trim().toLowerCase();
    if (!nameKey || !suppName) return false;
    if (suppName !== nameKey) return false;
    return isInRange(dn?.date, fromDate, toDate);
  });

  const payments = getStoredPayments().filter((p) => {
    const partyType = String(p?.partyType ?? '').toUpperCase();
    if (partyType !== 'SUPPLIER') return false;
    const partyId = String(p?.partyId ?? '').trim();
    if (partyId && String(partyId) === String(supplierId)) {
      return isInRange(p?.date, fromDate, toDate);
    }
    return false;
  });

  const events: Array<{ kind: 'purchase_bill' | 'debit_note' | 'payment'; date: any; payload: any }> = [
    ...bills.map((b) => ({ kind: 'purchase_bill' as const, date: b?.date, payload: b })),
    ...debitNotes.map((dn) => ({ kind: 'debit_note' as const, date: dn?.date, payload: dn })),
    ...payments.map((p) => ({ kind: 'payment' as const, date: p?.date, payload: p })),
  ].sort((a, b) => (toDateSafe(a?.date)?.getTime() ?? 0) - (toDateSafe(b?.date)?.getTime() ?? 0));

  let running = Number(supplier.openingBalance ?? 0) || 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const transactions: LedgerEntry[] = events.map((ev, idx) => {
    if (ev.kind === 'purchase_bill') {
      const inv = ev.payload;
      const credit = Number(inv?.grandTotal ?? inv?.amount ?? 0) || 0;
      running -= credit;
      totalCredit += credit;
      return {
        id: String(inv?.invoiceNumber ?? inv?.id ?? `pb-${idx}`),
        date: String(inv?.date ?? ''),
        type: 'PURCHASE_BILL',
        reference: String(inv?.invoiceNumber ?? ''),
        description: `Purchase Bill ${String(inv?.invoiceNumber ?? '')}`.trim(),
        debit: 0,
        credit,
        balance: running,
      };
    }

    if (ev.kind === 'payment') {
      const p = ev.payload;
      const amount = Number(p?.amount ?? 0) || 0;
      const pType = String(p?.type ?? '').toUpperCase();
      const isPayment = pType === 'PAYMENT';
      // Supplier: PAYMENT reduces payable (moves balance towards 0) => debit
      // RECEIPT from supplier increases payable => credit
      const debit = isPayment ? amount : 0;
      const credit = isPayment ? 0 : amount;
      running += debit;
      running -= credit;
      totalDebit += debit;
      totalCredit += credit;
      return {
        id: String(p?.id ?? `pay-${idx}`),
        date: String(p?.date ?? ''),
        type: 'PAYMENT',
        reference: String(p?.referenceNumber ?? ''),
        description: (isPayment ? 'Payment' : 'Receipt').trim(),
        debit,
        credit,
        balance: running,
      };
    }

    const dn = ev.payload;
    const debit = Number(dn?.amount ?? dn?.grandTotal ?? 0) || 0;
    running += debit;
    totalDebit += debit;
    return {
      id: String(dn?.id ?? dn?.debitNoteNumber ?? `dn-${idx}`),
      date: String(dn?.date ?? ''),
      type: 'PURCHASE_RETURN',
      reference: String(dn?.debitNoteNumber ?? ''),
      description: `Debit Note ${String(dn?.debitNoteNumber ?? '')}`.trim(),
      debit,
      credit: 0,
      balance: running,
    };
  });

  return {
    summary: {
      totalDebit,
      totalCredit,
      closingBalance: running,
    },
    transactions,
  };
};

const initialState: PartyState = {
  parties: [],
  customers: [],
  suppliers: [],
  currentParty: null,
  filters: {},
  customerLedger: [],
  partyLedger: undefined,
  ledgerLoading: false,
  loading: false,
  error: null,
  pagination: { total: 0, page: 1, limit: 50, totalPages: 0 },
};

/* --------------------
   THUNKS - CUSTOMERS
-------------------- */

export const fetchCustomers = createAsyncThunk<{ data: Customer[]; pagination?: any }, PartyFilters | void, { rejectValue: string }>(
  'party/fetchCustomers',
  async (filters, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));

      let customers = getStoredCustomers();
      if (isLanDocsEnabled()) {
        try {
          customers = await docApi.listPayloads<Customer>('customer');
          saveCustomers(customers);
        } catch {
          // fall back
        }
      }
      const f = filters || {};

      // Apply search filter
      if (f.search) {
        const searchTerm = f.search.toLowerCase();
        customers = customers.filter(customer =>
          customer.name.toLowerCase().includes(searchTerm) ||
          customer.phone.includes(searchTerm) ||
          customer.email?.toLowerCase().includes(searchTerm) ||
          customer.gstin?.toLowerCase().includes(searchTerm) ||
          customer.pan?.toLowerCase().includes(searchTerm)
        );
      }

      // Apply outstanding balance filter
      if (f.hasOutstanding !== undefined) {
        customers = customers.filter(customer =>
          f.hasOutstanding ? customer.currentBalance > 0 : customer.currentBalance === 0
        );
      }

      // Apply group filter
      if (f.group) {
        customers = customers.filter(customer => customer.group === f.group);
      }

      // Apply pagination
      const page = f.page || 1;
      const limit = f.limit || 10;
      const startIndex = (page - 1) * limit;
      const paginatedCustomers = customers.slice(startIndex, startIndex + limit);

      const data = paginatedCustomers;

      return {
        data,
        pagination: {
          total: customers.length,
          page,
          limit,
          totalPages: Math.ceil(customers.length / limit)
        }
      };
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to fetch customers');
    }
  }
);

export const fetchCustomer = createAsyncThunk<Customer, string, { rejectValue: string }>(
  'party/fetchCustomer',
  async (id, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));

      if (isLanDocsEnabled()) {
        try {
          const row = await docApi.getDoc('customer', String(id));
          const payload = row?.payload as Customer | undefined;
          if (!payload) return thunkAPI.rejectWithValue('Customer not found');
          const customers = getStoredCustomers();
          const next = [payload, ...customers.filter((c) => String(c.id) !== String(payload.id))];
          saveCustomers(next);
          return payload;
        } catch (e: any) {
          return thunkAPI.rejectWithValue(e?.message ?? 'Failed to fetch customer');
        }
      }

      const customers = getStoredCustomers();
      const customer = customers.find(c => c.id === id);

      if (!customer) {
        return thunkAPI.rejectWithValue('Customer not found');
      }

      return customer;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to fetch customer');
    }
  }
);

export const createCustomer = createAsyncThunk<Customer, Partial<Customer>, { rejectValue: string }>(
  'party/createCustomer',
  async (payload, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const customers = getStoredCustomers();
      const newCustomer: Customer = {
        id: `cust_${Date.now()}`,
        name: payload.name || '',
        code: payload.code || `CUST${customers.length + 1}`,
        phone: payload.phone || '',
        email: payload.email || '',
        whatsapp: payload.whatsapp || '',
        gstin: payload.gstin || '',
        pan: payload.pan || '',
        group: payload.group || 'RETAIL',
        creditLimit: payload.creditLimit || 0,
        creditDays: payload.creditDays || 30,
        addressLine1: payload.addressLine1 || '',
        addressLine2: payload.addressLine2 || '',
        city: payload.city || '',
        state: payload.state || '',
        pincode: payload.pincode || '',
        country: payload.country || 'India',
        openingBalance: payload.openingBalance || 0,
        currentBalance: payload.currentBalance || 0,
        isActive: payload.isActive !== undefined ? payload.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      customers.push(newCustomer);
      saveCustomers(customers);

      if (isLanDocsEnabled()) {
        await docApi.upsertDoc('customer', String(newCustomer.id), {
          docNumber: newCustomer.code,
          date: newCustomer.createdAt,
          partyName: newCustomer.name,
          amount: newCustomer.currentBalance,
          payload: newCustomer,
          createdAt: newCustomer.createdAt,
          updatedAt: newCustomer.updatedAt,
        });
      }

      return newCustomer;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to create customer');
    }
  }
);

export const updateCustomer = createAsyncThunk<Customer, { id: string; changes: Partial<Customer> }, { rejectValue: string }>(
  'party/updateCustomer',
  async ({ id, changes }, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const customers = getStoredCustomers();
      const customerIndex = customers.findIndex(c => c.id === id);

      if (customerIndex === -1) {
        return thunkAPI.rejectWithValue('Customer not found');
      }

      const updatedCustomer = {
        ...customers[customerIndex],
        ...changes,
        updatedAt: new Date().toISOString(),
      };

      customers[customerIndex] = updatedCustomer;
      saveCustomers(customers);

      if (isLanDocsEnabled()) {
        await docApi.upsertDoc('customer', String(updatedCustomer.id), {
          docNumber: updatedCustomer.code,
          date: updatedCustomer.updatedAt,
          partyName: updatedCustomer.name,
          amount: updatedCustomer.currentBalance,
          payload: updatedCustomer,
          updatedAt: updatedCustomer.updatedAt,
        });
      }

      return updatedCustomer;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to update customer');
    }
  }
);

export const deleteCustomer = createAsyncThunk<string, string, { rejectValue: string }>(
  'party/deleteCustomer',
  async (customerId, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      if (isLanDocsEnabled()) {
        await docApi.deleteDoc('customer', String(customerId));
      }

      const customers = getStoredCustomers();
      const customerIndex = customers.findIndex(c => c.id === customerId);

      if (customerIndex === -1) {
        return thunkAPI.rejectWithValue('Customer not found');
      }

      customers.splice(customerIndex, 1);
      saveCustomers(customers);

      return customerId;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to delete customer');
    }
  }
);

/* --------------------
   THUNKS - SUPPLIERS (NEW)
   Endpoints: adjust if your backend differs
-------------------- */

export const fetchSuppliers = createAsyncThunk<{ data: Supplier[]; pagination?: any }, PartyFilters | void, { rejectValue: string }>(
  'party/fetchSuppliers',
  async (filters, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));

      let suppliers = getStoredSuppliers();
      if (isLanDocsEnabled()) {
        try {
          suppliers = await docApi.listPayloads<Supplier>('supplier');
          saveSuppliers(suppliers);
        } catch {
          // fall back
        }
      }
      const f = filters || {};

      // Apply search filter
      if (f.search) {
        const searchTerm = f.search.toLowerCase();
        suppliers = suppliers.filter(supplier =>
          supplier.name.toLowerCase().includes(searchTerm) ||
          supplier.phone.includes(searchTerm) ||
          supplier.email?.toLowerCase().includes(searchTerm) ||
          supplier.gstin?.toLowerCase().includes(searchTerm) ||
          supplier.pan?.toLowerCase().includes(searchTerm)
        );
      }

      // Apply payable balance filter
      if (f.hasPayable !== undefined) {
        suppliers = suppliers.filter(supplier =>
          f.hasPayable ? supplier.currentBalance < 0 : supplier.currentBalance === 0
        );
      }

      // Apply pagination
      const page = f.page || 1;
      const limit = f.limit || 10;
      const startIndex = (page - 1) * limit;
      const paginatedSuppliers = suppliers.slice(startIndex, startIndex + limit);

      const data = paginatedSuppliers;

      return {
        data,
        pagination: {
          total: suppliers.length,
          page,
          limit,
          totalPages: Math.ceil(suppliers.length / limit)
        }
      };
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to fetch suppliers');
    }
  }
);

export const fetchSupplier = createAsyncThunk<Supplier, string, { rejectValue: string }>(
  'party/fetchSupplier',
  async (id, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));

      if (isLanDocsEnabled()) {
        try {
          const row = await docApi.getDoc('supplier', String(id));
          const payload = row?.payload as Supplier | undefined;
          if (!payload) return thunkAPI.rejectWithValue('Supplier not found');
          const suppliers = getStoredSuppliers();
          const next = [payload, ...suppliers.filter((s) => String(s.id) !== String(payload.id))];
          saveSuppliers(next);
          return payload;
        } catch (e: any) {
          return thunkAPI.rejectWithValue(e?.message ?? 'Failed to fetch supplier');
        }
      }

      const suppliers = getStoredSuppliers();
      const supplier = suppliers.find(s => s.id === id);

      if (!supplier) {
        return thunkAPI.rejectWithValue('Supplier not found');
      }

      return supplier;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to fetch supplier');
    }
  }
);

export const createSupplier = createAsyncThunk<Supplier, Partial<Supplier>, { rejectValue: string }>(
  'party/createSupplier',
  async (payload, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const suppliers = getStoredSuppliers();
      const newSupplier: Supplier = {
        id: `supp_${Date.now()}`,
        name: payload.name || '',
        code: payload.code || `SUPP${suppliers.length + 1}`,
        phone: payload.phone || '',
        email: payload.email || '',
        whatsapp: payload.whatsapp || '',
        gstin: payload.gstin || '',
        pan: payload.pan || '',
        creditDays: payload.creditDays || 30,
        addressLine1: payload.addressLine1 || '',
        addressLine2: payload.addressLine2 || '',
        city: payload.city || '',
        state: payload.state || '',
        pincode: payload.pincode || '',
        country: payload.country || 'India',
        openingBalance: payload.openingBalance || 0,
        currentBalance: payload.currentBalance || 0,
        isActive: payload.isActive !== undefined ? payload.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      suppliers.push(newSupplier);
      saveSuppliers(suppliers);

      if (isLanDocsEnabled()) {
        await docApi.upsertDoc('supplier', String(newSupplier.id), {
          docNumber: newSupplier.code,
          date: newSupplier.createdAt,
          partyName: newSupplier.name,
          amount: newSupplier.currentBalance,
          payload: newSupplier,
          createdAt: newSupplier.createdAt,
          updatedAt: newSupplier.updatedAt,
        });
      }

      return newSupplier;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to create supplier');
    }
  }
);

export const updateSupplier = createAsyncThunk<Supplier, { id: string; changes: Partial<Supplier> }, { rejectValue: string }>(
  'party/updateSupplier',
  async ({ id, changes }, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const suppliers = getStoredSuppliers();
      const supplierIndex = suppliers.findIndex(s => s.id === id);

      if (supplierIndex === -1) {
        return thunkAPI.rejectWithValue('Supplier not found');
      }

      const updatedSupplier = {
        ...suppliers[supplierIndex],
        ...changes,
        updatedAt: new Date().toISOString(),
      };

      suppliers[supplierIndex] = updatedSupplier;
      saveSuppliers(suppliers);

      if (isLanDocsEnabled()) {
        await docApi.upsertDoc('supplier', String(updatedSupplier.id), {
          docNumber: updatedSupplier.code,
          date: updatedSupplier.updatedAt,
          partyName: updatedSupplier.name,
          amount: updatedSupplier.currentBalance,
          payload: updatedSupplier,
          updatedAt: updatedSupplier.updatedAt,
        });
      }

      return updatedSupplier;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to update supplier');
    }
  }
);

export const deleteSupplier = createAsyncThunk<string, string, { rejectValue: string }>(
  'party/deleteSupplier',
  async (supplierId, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      if (isLanDocsEnabled()) {
        await docApi.deleteDoc('supplier', String(supplierId));
      }

      const suppliers = getStoredSuppliers();
      const supplierIndex = suppliers.findIndex(s => s.id === supplierId);

      if (supplierIndex === -1) {
        return thunkAPI.rejectWithValue('Supplier not found');
      }

      suppliers.splice(supplierIndex, 1);
      saveSuppliers(suppliers);

      return supplierId;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to delete supplier');
    }
  }
);

/* --------------------
   THUNKS - LEDGER
-------------------- */

export const fetchCustomerLedger = createAsyncThunk<{ summary: any; transactions: LedgerEntry[] }, { id: string; fromDate?: string; toDate?: string }, { rejectValue: string }>(
  'party/fetchCustomerLedger',
  async ({ id, fromDate, toDate }, thunkAPI) => {
    try {
      if (isLanDocsEnabled()) {
        return await buildLanCustomerLedger(id, fromDate, toDate);
      }

      if (isOfflineRuntime()) {
        return buildOfflineCustomerLedger(id, fromDate, toDate);
      }

      let url = `${API}/api/customers/${encodeURIComponent(id)}/ledger`;
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t.slice(0, 120)}`);
      }
      return (await ensureJson(res)) as any;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

export const fetchSupplierLedger = createAsyncThunk<{ summary: any; transactions: LedgerEntry[] }, { id: string; fromDate?: string; toDate?: string }, { rejectValue: string }>(
  'party/fetchSupplierLedger',
  async ({ id, fromDate, toDate }, thunkAPI) => {
    try {
      if (isLanDocsEnabled()) {
        return await buildLanSupplierLedger(id, fromDate, toDate);
      }

      if (isOfflineRuntime()) {
        return buildOfflineSupplierLedger(id, fromDate, toDate);
      }

      let url = `${API}/api/suppliers/${encodeURIComponent(id)}/ledger`;
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t.slice(0, 120)}`);
      }
      return (await ensureJson(res)) as any;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/* --------------------
   SLICE
-------------------- */

const partySlice = createSlice({
  name: 'party',
  initialState,
  reducers: {
    setParties(state, action: PayloadAction<Party[]>) { state.parties = action.payload; },
    addParty(state, action: PayloadAction<Party>) { state.parties.push(action.payload); },
    updateParty(state, action: PayloadAction<Party>) {
      const idx = state.parties.findIndex(p => p.id === action.payload.id);
      if (idx >= 0) state.parties[idx] = action.payload;
    },
    removeParty(state, action: PayloadAction<string>) { state.parties = state.parties.filter(p => p.id !== action.payload); },

    // current party helpers for forms
    setCurrentParty(state, action: PayloadAction<Party | null>) { state.currentParty = action.payload; },
    clearCurrentParty(state) { state.currentParty = null; },

    // filters
    setFilters(state, action: PayloadAction<PartyFilters>) { state.filters = { ...state.filters, ...action.payload }; },
    clearFilters(state) { state.filters = {}; },

    // helpers
    clearError(state) { state.error = null; },
    setPartyLoading(state, action: PayloadAction<boolean>) { state.loading = action.payload; },
    setPartyError(state, action: PayloadAction<string | null>) { state.error = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      // customers list
      .addCase(fetchCustomers.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        state.loading = false;
        state.customers = action.payload.data;
        if (action.payload.pagination) state.pagination = action.payload.pagination;
      })
      .addCase(fetchCustomers.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Failed to load customers'; })

      // single customer
      .addCase(fetchCustomer.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchCustomer.fulfilled, (state, action: PayloadAction<Customer>) => {
        state.loading = false;
        state.currentParty = { id: action.payload.id, name: action.payload.name, phone: action.payload.phone, email: action.payload.email, balance: action.payload.currentBalance };
        const idx = state.customers.findIndex(c => c.id === action.payload.id);
        if (idx >= 0) state.customers[idx] = action.payload; else state.customers.unshift(action.payload);
      })
      .addCase(fetchCustomer.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Failed to load customer'; })

      // create/update/delete customer
      .addCase(createCustomer.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(createCustomer.fulfilled, (state, action: PayloadAction<Customer>) => { state.loading = false; state.customers.unshift(action.payload); })
      .addCase(createCustomer.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Create failed'; })

      .addCase(updateCustomer.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(updateCustomer.fulfilled, (state, action: PayloadAction<Customer>) => {
        state.loading = false;
        const idx = state.customers.findIndex(c => c.id === action.payload.id);
        if (idx >= 0) state.customers[idx] = action.payload;
        if (state.currentParty?.id === action.payload.id) state.currentParty = { id: action.payload.id, name: action.payload.name, phone: action.payload.phone, email: action.payload.email, balance: action.payload.currentBalance };
      })
      .addCase(updateCustomer.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Update failed'; })

      .addCase(deleteCustomer.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(deleteCustomer.fulfilled, (state, action: PayloadAction<string>) => { state.loading = false; state.customers = state.customers.filter(c => c.id !== action.payload); })
      .addCase(deleteCustomer.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Delete failed'; })

      // suppliers list
      .addCase(fetchSuppliers.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchSuppliers.fulfilled, (state, action) => {
        state.loading = false;
        state.suppliers = action.payload.data;
        if (action.payload.pagination) state.pagination = action.payload.pagination;
      })
      .addCase(fetchSuppliers.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Failed to load suppliers'; })

      // single supplier
      .addCase(fetchSupplier.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchSupplier.fulfilled, (state, action: PayloadAction<Supplier>) => {
        state.loading = false;
        state.currentParty = { id: action.payload.id, name: action.payload.name, phone: action.payload.phone, email: action.payload.email, balance: action.payload.currentBalance };
        const idx = state.suppliers.findIndex(s => s.id === action.payload.id);
        if (idx >= 0) state.suppliers[idx] = action.payload; else state.suppliers.unshift(action.payload);
      })
      .addCase(fetchSupplier.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Failed to load supplier'; })

      // supplier create/update/delete
      .addCase(createSupplier.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(createSupplier.fulfilled, (state, action: PayloadAction<Supplier>) => { state.loading = false; state.suppliers.unshift(action.payload); })
      .addCase(createSupplier.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Create supplier failed'; })

      .addCase(updateSupplier.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(updateSupplier.fulfilled, (state, action: PayloadAction<Supplier>) => {
        state.loading = false;
        const idx = state.suppliers.findIndex(s => s.id === action.payload.id);
        if (idx >= 0) state.suppliers[idx] = action.payload;
      })
      .addCase(updateSupplier.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Update supplier failed'; })

      .addCase(deleteSupplier.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(deleteSupplier.fulfilled, (state, action: PayloadAction<string>) => { state.loading = false; state.suppliers = state.suppliers.filter(s => s.id !== action.payload); })
      .addCase(deleteSupplier.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Delete supplier failed'; })

      // ledgers
      .addCase(fetchCustomerLedger.pending, (state) => { state.ledgerLoading = true; state.error = null; state.partyLedger = undefined; })
      .addCase(fetchCustomerLedger.fulfilled, (state, action: PayloadAction<any>) => {
        state.ledgerLoading = false;
        state.partyLedger = action.payload;
      })
      .addCase(fetchCustomerLedger.rejected, (state, action) => { state.ledgerLoading = false; state.error = action.payload ?? action.error?.message ?? 'Failed to load ledger'; })

      .addCase(fetchSupplierLedger.pending, (state) => { state.ledgerLoading = true; state.error = null; state.partyLedger = undefined; })
      .addCase(fetchSupplierLedger.fulfilled, (state, action: PayloadAction<any>) => {
        state.ledgerLoading = false;
        state.partyLedger = action.payload;
      })
      .addCase(fetchSupplierLedger.rejected, (state, action) => { state.ledgerLoading = false; state.error = action.payload ?? action.error?.message ?? 'Failed to load ledger'; });
  },
});

/* --------------------
   EXPORTS
-------------------- */

export const {
  setParties,
  addParty,
  updateParty,
  removeParty,
  setCurrentParty,
  clearCurrentParty,
  setFilters,
  clearFilters,
  clearError,
  setPartyLoading,
  setPartyError,
} = partySlice.actions;

/* selectors */
export const selectParties = (state: any) => state.party?.parties ?? [];
export const selectCustomers = (state: any) => state.party?.customers ?? [];
export const selectSuppliers = (state: any) => state.party?.suppliers ?? [];
export const selectCurrentParty = (state: any) => state.party?.currentParty ?? null;
export const selectPartyFilters = (state: any) => state.party?.filters ?? {};
export const selectPartyLoading = (state: any) => !!state.party?.loading;
export const selectPartyError = (state: any) => state.party?.error ?? null;

export const selectCustomerLedger = (state: any) => state.party?.customerLedger ?? [];
export const selectCustomerLedgerLoading = (state: any) => !!state.party?.ledgerLoading;

export default partySlice.reducer;
