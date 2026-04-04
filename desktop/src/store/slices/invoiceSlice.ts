// src/store/slices/invoiceSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

const isOfflineRuntime = () => {
  try {
    if ((window as any).__TAURI__ != null) return true;
    if ((window as any).__TAURI_INTERNALS__ != null) return true;
    if ((navigator as any)?.userAgent && String((navigator as any).userAgent).toLowerCase().includes('tauri')) return true;
    const p = window.location.protocol;
    return p === 'tauri:' || p === 'file:';
  } catch {
    return false;
  }
};

const INVOICES_STORAGE_KEY = 'pve_invoices';

const getStoredInvoices = (): Invoice[] => {
  try {
    const raw = localStorage.getItem(INVOICES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Invoice[]) : [];
  } catch {
    return [];
  }
};

const saveStoredInvoices = (invoices: Invoice[]) => {
  localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
};

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  amount?: number;
  partyId?: string;
  date?: string;
}

export interface InvoiceState {
  items: Invoice[];
  loading: boolean;
  error: string | null;
}

const initialState: InvoiceState = {
  items: [],
  loading: false,
  error: null,
};

export const fetchInvoices = createAsyncThunk<Invoice[], void, { rejectValue: string }>(
  'invoice/fetchInvoices',
  async (_, thunkAPI) => {
    try {
      if (isOfflineRuntime()) {
        return getStoredInvoices();
      }
      const res = await fetch('/api/invoices');
      if (!res.ok) return thunkAPI.rejectWithValue('Failed to fetch invoices');
      return (await res.json()) as Invoice[];
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

export const deleteInvoice = createAsyncThunk<string, string, { rejectValue: string }>(
  'invoice/deleteInvoice',
  async (id, thunkAPI) => {
    try {
      if (isOfflineRuntime()) {
        const invoices = getStoredInvoices();
        saveStoredInvoices(invoices.filter((i) => String(i.id) !== String(id)));
        return id;
      }
      const res = await fetch(`/api/invoices/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) return thunkAPI.rejectWithValue('Delete failed');
      return id;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

const invoiceSlice = createSlice({
  name: 'invoice',
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
    setInvoices(state, action: PayloadAction<Invoice[]>) { state.items = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInvoices.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchInvoices.fulfilled, (state, action: PayloadAction<Invoice[]>) => { state.loading = false; state.items = action.payload; })
      .addCase(fetchInvoices.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Failed'; })

      .addCase(deleteInvoice.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(deleteInvoice.fulfilled, (state, action: PayloadAction<string>) => { state.loading = false; state.items = state.items.filter(i => i.id !== action.payload); })
      .addCase(deleteInvoice.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Delete failed'; });
  },
});

export const { clearError, setInvoices } = invoiceSlice.actions;

export const selectInvoices = (state: any) => state.invoice?.items ?? [];
export const selectInvoiceLoading = (state: any) => !!state.invoice?.loading;
export const selectInvoiceError = (state: any) => state.invoice?.error ?? null;

export default invoiceSlice.reducer;
