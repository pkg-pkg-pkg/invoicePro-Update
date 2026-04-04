// src/store/slices/paymentSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Payment {
  id: string;
  amount: number;
  date?: string;
  partyId?: string;
  method?: string;
  note?: string;
}

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
  async (filters, thunkAPI) => {
    try {
      let url = '/api/payments';
      if (filters && Object.keys(filters).length > 0) {
        const params = new URLSearchParams();
        const f = filters as PaymentFilters;
        if (f.q) params.append('q', f.q);
        if (f.fromDate) params.append('fromDate', f.fromDate);
        if (f.toDate) params.append('toDate', f.toDate);
        if (f.minAmount !== undefined) params.append('minAmount', String(f.minAmount));
        if (f.maxAmount !== undefined) params.append('maxAmount', String(f.maxAmount));
        if (f.partyId) params.append('partyId', f.partyId);
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await res.json()) as Payment[];
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
      const res = await fetch(`/api/payments/${encodeURIComponent(id)}`);
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await res.json()) as Payment;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** Add new payment (canonical name: addPayment) */
export const addPayment = createAsyncThunk<Payment, Partial<Payment>, { rejectValue: string }>(
  'payment/addPayment',
  async (payload, thunkAPI) => {
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await res.json()) as Payment;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** createPayment alias for compatibility with PaymentForm.tsx imports */
export const createPayment = addPayment;

/** Update existing payment */
export const updatePayment = createAsyncThunk<Payment, { id: string; changes: Partial<Payment> }, { rejectValue: string }>(
  'payment/updatePayment',
  async ({ id, changes }, thunkAPI) => {
    try {
      const res = await fetch(`/api/payments/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await res.json()) as Payment;
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
      const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`, { method: 'DELETE' });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
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

export const selectPayments = (state: any) => state.payment?.items ?? [];
export const selectCurrentPayment = (state: any) => state.payment?.currentPayment ?? null;
export const selectPaymentFilters = (state: any) => state.payment?.filters ?? {};
export const selectPaymentLoading = (state: any) => !!state.payment?.loading;
export const selectPaymentError = (state: any) => state.payment?.error ?? null;

export default paymentSlice.reducer;
