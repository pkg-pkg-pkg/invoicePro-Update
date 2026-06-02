// src/store/slices/paymentSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Payment, PaymentType, PartyType } from "@gst-billing/shared";
import { CreatePaymentData } from '../../services/paymentService';

import { docApi, getHostBaseUrl } from '../../services/docApi';
import { companyScopedKey, readCompanyScopedRaw } from '../../utils/companyStorage';

const PAYMENTS_STORAGE_KEY = companyScopedKey('pve_invoicepro_payments');
const CUSTOMERS_STORAGE_KEY = companyScopedKey('pve_customers');
const SUPPLIERS_STORAGE_KEY = companyScopedKey('pve_suppliers');

const isLanDocsEnabled = () => {
  try {
    return !!getHostBaseUrl();
  } catch {
    return false;
  }
};

const toDateSafe = (value: any): Date | undefined => {
  try {
    const d = new Date(String(value ?? ''));
    if (Number.isNaN(d.getTime())) return undefined;
    return d;
  } catch {
    return undefined;
  }
};

const normalizePayment = (raw: any): Payment => {
  const date = toDateSafe(raw?.date) ?? new Date();
  const createdAt = toDateSafe(raw?.createdAt) ?? new Date();
  const chequeDate = raw?.chequeDate ? toDateSafe(raw.chequeDate) : undefined;

  return {
    ...raw,
    date,
    createdAt,
    chequeDate,
  } as Payment;
};

const serializePayment = (p: Payment) => {
  const anyP: any = p as any;
  return {
    ...anyP,
    date: (anyP?.date instanceof Date ? anyP.date.toISOString() : anyP?.date) ?? new Date().toISOString(),
    createdAt:
      (anyP?.createdAt instanceof Date ? anyP.createdAt.toISOString() : anyP?.createdAt) ?? new Date().toISOString(),
    chequeDate: anyP?.chequeDate
      ? (anyP.chequeDate instanceof Date ? anyP.chequeDate.toISOString() : anyP.chequeDate)
      : undefined,
  };
};

const getStoredPayments = (): Payment[] => {
  try {
    const raw = readCompanyScopedRaw('pve_invoicepro_payments') ?? localStorage.getItem(PAYMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePayment);
  } catch {
    return [];
  }
};

const saveStoredPayments = (payments: Payment[]) => {
  try {
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(payments.map(serializePayment)));
  } catch {
    // ignore
  }
};

const getStoredPaymentsSmart = async (): Promise<Payment[]> => {
  if (isLanDocsEnabled()) {
    try {
      const raw = await docApi.listPayloads<any>('payment');
      const normalized = (Array.isArray(raw) ? raw : []).map(normalizePayment);
      saveStoredPayments(normalized);
      return normalized;
    } catch {
      // fall back
    }
  }
  return getStoredPayments();
};

const getPartyName = (partyType: PartyType, partyId: string): string => {
  try {
    const key = partyType === PartyType.SUPPLIER ? SUPPLIERS_STORAGE_KEY : CUSTOMERS_STORAGE_KEY;
    const baseKey = partyType === PartyType.SUPPLIER ? 'pve_suppliers' : 'pve_customers';
    const raw = readCompanyScopedRaw(baseKey) ?? localStorage.getItem(key);
    if (!raw) return '';
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return '';
    const found = arr.find((p: any) => String(p?.id ?? '') === String(partyId));
    return String(found?.name ?? '').trim();
  } catch {
    return '';
  }
};

const getBalanceEffect = (payment: Pick<Payment, 'partyType' | 'type' | 'amount'>) => {
  const amount = Number(payment.amount ?? 0) || 0;
  if (!amount) return 0;

  if (payment.partyType === PartyType.CUSTOMER) {
    // +ve customer balance means they owe us.
    // RECEIPT reduces balance, PAYMENT (refund) increases balance.
    return payment.type === PaymentType.RECEIPT ? -amount : amount;
  }

  // +ve supplier balance means supplier owes us, -ve means we owe supplier.
  // PAYMENT reduces payable -> increases balance towards 0.
  // RECEIPT from supplier would increase payable -> decreases balance.
  return payment.type === PaymentType.PAYMENT ? amount : -amount;
};

const applyPartyBalanceDelta = (partyType: PartyType, partyId: string, delta: number) => {
  if (!partyId || !delta) return;
  const key = partyType === PartyType.SUPPLIER ? SUPPLIERS_STORAGE_KEY : CUSTOMERS_STORAGE_KEY;

  try {
    const baseKey = partyType === PartyType.SUPPLIER ? 'pve_suppliers' : 'pve_customers';
    const raw = readCompanyScopedRaw(baseKey) ?? localStorage.getItem(key);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    const idx = arr.findIndex((p: any) => String(p?.id ?? '') === String(partyId));
    if (idx < 0) return;

    const current = Number(arr[idx]?.currentBalance ?? 0) || 0;
    arr[idx] = { ...arr[idx], currentBalance: current + delta, updatedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(arr));

    if (isLanDocsEnabled()) {
      const updated = arr[idx];
      const docType = partyType === PartyType.SUPPLIER ? 'supplier' : 'customer';
      docApi
        .upsertDoc(docType, String(updated?.id ?? partyId), {
          docNumber: String(updated?.code ?? ''),
          partyName: String(updated?.name ?? ''),
          amount: Number(updated?.currentBalance ?? 0) || 0,
          payload: updated,
          updatedAt: String(updated?.updatedAt ?? new Date().toISOString()),
        })
        .catch(() => {
          // ignore
        });
    }
  } catch {
    // ignore
  }
};

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

export interface PaymentFilters {
  q?: string;
  fromDate?: string;
  toDate?: string;
  minAmount?: number;
  maxAmount?: number;
  partyId?: string;
}

export interface PaymentState {
  items: Payment[];
  currentPayment: Payment | null;
  filters: PaymentFilters;
  loading: boolean;
  error: string | null;
}

const initialState: PaymentState = {
  items: [],
  currentPayment: null,
  filters: {},
  loading: false,
  error: null,
};

/* --------------------
   THUNKS
-------------------- */

/** Fetch all payments (optionally with filters) */
export const fetchPayments = createAsyncThunk<Payment[], PaymentFilters | void, { rejectValue: string }>(
  'payment/fetchPayments',
  async (_filters, thunkAPI) => {
    try {
      const payments = await getStoredPaymentsSmart();
      const withParty = payments.map((p: any) => {
        const nm = getPartyName(p.partyType, p.partyId);
        return nm ? { ...p, party: { name: nm } } : p;
      });

      // newest first
      withParty.sort((a: any, b: any) => {
        const at = (a?.date instanceof Date ? a.date.getTime() : new Date(a?.date).getTime()) || 0;
        const bt = (b?.date instanceof Date ? b.date.getTime() : new Date(b?.date).getTime()) || 0;
        return bt - at;
      });
      return withParty as Payment[];
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** Fetch single payment (used by PaymentForm) */
export const fetchPayment = createAsyncThunk<Payment, string, { rejectValue: string }>(
  'payment/fetchPayment',
  async (id, thunkAPI) => {
    try {
      if (isLanDocsEnabled()) {
        const row = await docApi.getDoc('payment', String(id));
        const payload = row?.payload;
        if (!payload) return thunkAPI.rejectWithValue('Payment not found');
        const found = normalizePayment(payload);
        const nm = getPartyName(found.partyType, found.partyId);
        return (nm ? ({ ...(found as any), party: { name: nm } } as any) : found) as Payment;
      }

      const payments = getStoredPayments();
      const found = payments.find((p) => String(p.id) === String(id));
      if (!found) return thunkAPI.rejectWithValue('Payment not found');
      const nm = getPartyName(found.partyType, found.partyId);
      return (nm ? ({ ...(found as any), party: { name: nm } } as any) : found) as Payment;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** Add new payment (canonical name: addPayment) */
export const addPayment = createAsyncThunk<Payment, CreatePaymentData, { rejectValue: string }>(
  'payment/addPayment',
  async (payload, thunkAPI) => {
    try {
      const actor = getAuditActor();
      const newPayment: Payment = {
        id: `payment-${Date.now()}`,
        type: payload.type,
        partyId: payload.partyId,
        partyType: payload.partyType,
        amount: payload.amount,
        paymentMode: payload.paymentMode,
        referenceNumber: payload.referenceNumber,
        chequeNumber: payload.chequeNumber,
        chequeDate: payload.chequeDate ? new Date(payload.chequeDate) : undefined,
        chequeDrawnOnBank: payload.chequeDrawnOnBank,
        bankId: payload.bankId,
        notes: payload.notes,
        date: new Date(payload.date),
        createdAt: new Date(),
        createdBy: actor.name || actor.id || 'user'
      };

      const payments = getStoredPayments();
      payments.unshift(newPayment);
      saveStoredPayments(payments);

      if (isLanDocsEnabled()) {
        const nm = getPartyName(newPayment.partyType, newPayment.partyId);
        await docApi.upsertDoc('payment', String(newPayment.id), {
          docNumber: String((newPayment as any)?.referenceNumber ?? ''),
          date: (newPayment.date instanceof Date ? newPayment.date.toISOString() : String(newPayment.date)),
          partyName: nm,
          amount: Number(newPayment.amount ?? 0) || 0,
          payload: serializePayment(newPayment),
          createdAt: (newPayment.createdAt instanceof Date ? newPayment.createdAt.toISOString() : String((newPayment as any).createdAt)),
          createdByName: String((newPayment as any)?.createdBy ?? ''),
          updatedAt: new Date().toISOString(),
        });
      }

      // update outstanding
      applyPartyBalanceDelta(newPayment.partyType, newPayment.partyId, getBalanceEffect(newPayment));

      const nm = getPartyName(newPayment.partyType, newPayment.partyId);
      return (nm ? ({ ...(newPayment as any), party: { name: nm } } as any) : newPayment) as Payment;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** createPayment alias for compatibility with PaymentForm.tsx imports */
export const createPayment = addPayment;

/** Update existing payment */
export const updatePayment = createAsyncThunk<Payment, { id: string; data: CreatePaymentData }, { rejectValue: string }>(
  'payment/updatePayment',
  async ({ id, data }, thunkAPI) => {
    try {
      const actor = getAuditActor();
      const payments = getStoredPayments();
      const prev = payments.find((p) => String(p.id) === String(id));

      const updatedPayment: Payment = {
        id: id,
        type: data.type,
        partyId: data.partyId,
        partyType: data.partyType,
        amount: data.amount,
        paymentMode: data.paymentMode,
        referenceNumber: data.referenceNumber,
        chequeNumber: data.chequeNumber,
        chequeDate: data.chequeDate ? new Date(data.chequeDate) : undefined,
        chequeDrawnOnBank: data.chequeDrawnOnBank,
        bankId: data.bankId,
        notes: data.notes,
        date: new Date(data.date),
        createdAt: prev?.createdAt ?? new Date(),
        createdBy: prev?.createdBy ?? (actor.name || actor.id || 'user')
      };

      const idx = payments.findIndex((p) => String(p.id) === String(id));
      if (idx >= 0) payments[idx] = updatedPayment;
      else payments.unshift(updatedPayment);
      saveStoredPayments(payments);

      if (isLanDocsEnabled()) {
        const nm2 = getPartyName(updatedPayment.partyType, updatedPayment.partyId);
        await docApi.upsertDoc('payment', String(updatedPayment.id), {
          docNumber: String((updatedPayment as any)?.referenceNumber ?? ''),
          date: (updatedPayment.date instanceof Date ? updatedPayment.date.toISOString() : String(updatedPayment.date)),
          partyName: nm2,
          amount: Number(updatedPayment.amount ?? 0) || 0,
          payload: serializePayment(updatedPayment),
          updatedAt: new Date().toISOString(),
          updatedByName: String((updatedPayment as any)?.createdBy ?? ''),
        });
      }

      // reverse previous effect, apply new
      if (prev) {
        applyPartyBalanceDelta(prev.partyType, prev.partyId, -getBalanceEffect(prev));
      }
      applyPartyBalanceDelta(updatedPayment.partyType, updatedPayment.partyId, getBalanceEffect(updatedPayment));

      const nm = getPartyName(updatedPayment.partyType, updatedPayment.partyId);
      return (nm ? ({ ...(updatedPayment as any), party: { name: nm } } as any) : updatedPayment) as Payment;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** DELETE payment */
export const deletePayment = createAsyncThunk<string, string, { rejectValue: string }>(
  'payment/deletePayment',
  async (paymentId, thunkAPI) => {
    try {
      if (isLanDocsEnabled()) {
        await docApi.deleteDoc('payment', String(paymentId));
      }
      const payments = getStoredPayments();
      const prev = payments.find((p) => String(p.id) === String(paymentId));
      const next = payments.filter((p) => String(p.id) !== String(paymentId));
      saveStoredPayments(next);

      if (prev) {
        applyPartyBalanceDelta(prev.partyType, prev.partyId, -getBalanceEffect(prev));
      }

      return paymentId;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/* --------------------
   SLICE
-------------------- */

const paymentSlice = createSlice({
  name: 'payment',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setPayments(state, action: PayloadAction<Payment[]>) {
      state.items = action.payload;
    },
    // FILTERS
    setFilters(state, action: PayloadAction<PaymentFilters>) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters(state) {
      state.filters = {};
    },

    // CURRENT PAYMENT helpers (required by PaymentForm)
    setCurrentPayment(state, action: PayloadAction<Payment | null>) {
      state.currentPayment = action.payload;
    },
    clearCurrentPayment(state) {
      state.currentPayment = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchPayments
      .addCase(fetchPayments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPayments.fulfilled, (state, action: PayloadAction<Payment[]>) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchPayments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to fetch payments';
      })

      // fetchPayment (single)
      .addCase(fetchPayment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPayment.fulfilled, (state, action: PayloadAction<Payment>) => {
        state.loading = false;
        state.currentPayment = action.payload;
        const idx = state.items.findIndex(p => p.id === action.payload.id);
        if (idx >= 0) state.items[idx] = action.payload;
        else state.items.unshift(action.payload);
      })
      .addCase(fetchPayment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to load payment';
      })

      // add/create Payment (works for both addPayment and createPayment)
      .addCase(addPayment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addPayment.fulfilled, (state, action: PayloadAction<Payment>) => {
        state.loading = false;
        state.items.unshift(action.payload);
      })
      .addCase(addPayment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Add payment failed';
      })

      // updatePayment
      .addCase(updatePayment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updatePayment.fulfilled, (state, action: PayloadAction<Payment>) => {
        state.loading = false;
        const idx = state.items.findIndex(p => p.id === action.payload.id);
        if (idx >= 0) state.items[idx] = action.payload;
        if (state.currentPayment?.id === action.payload.id) state.currentPayment = action.payload;
      })
      .addCase(updatePayment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Update failed';
      })

      // deletePayment
      .addCase(deletePayment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deletePayment.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false;
        state.items = state.items.filter(p => p.id !== action.payload);
        if (state.currentPayment?.id === action.payload) state.currentPayment = null;
      })
      .addCase(deletePayment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Delete failed';
      });
  },
});

export const {
  clearError,
  setPayments,
  setFilters,
  clearFilters,
  setCurrentPayment,
  clearCurrentPayment,
} = paymentSlice.actions;

export const selectPayments = (state: any) => state.payments?.items ?? [];
export const selectCurrentPayment = (state: any) => state.payments?.currentPayment ?? null;
export const selectPaymentFilters = (state: any) => state.payments?.filters ?? {};
export const selectPaymentLoading = (state: any) => !!state.payments?.loading;
export const selectPaymentError = (state: any) => state.payments?.error ?? null;


export default paymentSlice.reducer;
