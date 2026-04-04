// src/store/slices/invoiceSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

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
