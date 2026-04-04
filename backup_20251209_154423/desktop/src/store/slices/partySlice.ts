// src/store/slices/partySlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

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
  phone?: string;
  email?: string;
  balance?: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  balance?: number;
  address?: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  description?: string;
  debit?: number;
  credit?: number;
  balance?: number;
}

export interface PartyFilters {
  q?: string;
  minBalance?: number;
  maxBalance?: number;
}

export interface PartyState {
  parties: Party[];
  customers: Customer[];
  suppliers: Supplier[];         // NEW: suppliers list
  currentParty: Party | null;
  filters: PartyFilters;
  customerLedger: LedgerEntry[];
  ledgerLoading: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: PartyState = {
  parties: [],
  customers: [],
  suppliers: [],
  currentParty: null,
  filters: {},
  customerLedger: [],
  ledgerLoading: false,
  loading: false,
  error: null,
};

/* --------------------
   THUNKS - CUSTOMERS
-------------------- */

export const fetchCustomers = createAsyncThunk<Customer[], void, { rejectValue: string }>(
  'party/fetchCustomers',
  async (_, thunkAPI) => {
    try {
      const res = await fetch('/api/customers');
      if (!res.ok) return thunkAPI.rejectWithValue(`Server error: ${res.status}`);
      return (await res.json()) as Customer[];
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

export const fetchCustomer = createAsyncThunk<Customer, string, { rejectValue: string }>(
  'party/fetchCustomer',
  async (id, thunkAPI) => {
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(id)}`);
      if (!res.ok) return thunkAPI.rejectWithValue(`Server error: ${res.status}`);
      return (await res.json()) as Customer;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

export const createCustomer = createAsyncThunk<Customer, Partial<Customer>, { rejectValue: string }>(
  'party/createCustomer',
  async (payload, thunkAPI) => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return thunkAPI.rejectWithValue(`Server error: ${res.status}`);
      return (await res.json()) as Customer;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

export const updateCustomer = createAsyncThunk<Customer, { id: string; changes: Partial<Customer> }, { rejectValue: string }>(
  'party/updateCustomer',
  async ({ id, changes }, thunkAPI) => {
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!res.ok) return thunkAPI.rejectWithValue(`Server error: ${res.status}`);
      return (await res.json()) as Customer;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

export const deleteCustomer = createAsyncThunk<string, string, { rejectValue: string }>(
  'party/deleteCustomer',
  async (customerId, thunkAPI) => {
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, { method: 'DELETE' });
      if (!res.ok) return thunkAPI.rejectWithValue(`Server error: ${res.status}`);
      return customerId;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/* --------------------
   THUNKS - SUPPLIERS (NEW)
   Endpoints: adjust if your backend differs
-------------------- */

export const fetchSuppliers = createAsyncThunk<Supplier[], void, { rejectValue: string }>(
  'party/fetchSuppliers',
  async (_, thunkAPI) => {
    try {
      const res = await fetch('/api/suppliers');
      if (!res.ok) return thunkAPI.rejectWithValue(`Server error: ${res.status}`);
      return (await res.json()) as Supplier[];
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

export const fetchSupplier = createAsyncThunk<Supplier, string, { rejectValue: string }>(
  'party/fetchSupplier',
  async (id, thunkAPI) => {
    try {
      const res = await fetch(`/api/suppliers/${encodeURIComponent(id)}`);
      if (!res.ok) return thunkAPI.rejectWithValue(`Server error: ${res.status}`);
      return (await res.json()) as Supplier;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

export const createSupplier = createAsyncThunk<Supplier, Partial<Supplier>, { rejectValue: string }>(
  'party/createSupplier',
  async (payload, thunkAPI) => {
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return thunkAPI.rejectWithValue(`Server error: ${res.status}`);
      return (await res.json()) as Supplier;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

export const updateSupplier = createAsyncThunk<Supplier, { id: string; changes: Partial<Supplier> }, { rejectValue: string }>(
  'party/updateSupplier',
  async ({ id, changes }, thunkAPI) => {
    try {
      const res = await fetch(`/api/suppliers/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!res.ok) return thunkAPI.rejectWithValue(`Server error: ${res.status}`);
      return (await res.json()) as Supplier;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

export const deleteSupplier = createAsyncThunk<string, string, { rejectValue: string }>(
  'party/deleteSupplier',
  async (supplierId, thunkAPI) => {
    try {
      const res = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}`, { method: 'DELETE' });
      if (!res.ok) return thunkAPI.rejectWithValue(`Server error: ${res.status}`);
      return supplierId;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/* --------------------
   THUNKS - LEDGER
-------------------- */

export const fetchCustomerLedger = createAsyncThunk<LedgerEntry[], string, { rejectValue: string }>(
  'party/fetchCustomerLedger',
  async (customerId, thunkAPI) => {
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/ledger`);
      if (!res.ok) return thunkAPI.rejectWithValue(`Server error: ${res.status}`);
      return (await res.json()) as LedgerEntry[];
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
      .addCase(fetchCustomers.fulfilled, (state, action: PayloadAction<Customer[]>) => { state.loading = false; state.customers = action.payload; })
      .addCase(fetchCustomers.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Failed to load customers'; })

      // single customer
      .addCase(fetchCustomer.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchCustomer.fulfilled, (state, action: PayloadAction<Customer>) => {
        state.loading = false;
        state.currentParty = { id: action.payload.id, name: action.payload.name, phone: action.payload.phone, email: action.payload.email, balance: action.payload.balance };
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
        if (state.currentParty?.id === action.payload.id) state.currentParty = { id: action.payload.id, name: action.payload.name, phone: action.payload.phone, email: action.payload.email, balance: action.payload.balance };
      })
      .addCase(updateCustomer.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Update failed'; })

      .addCase(deleteCustomer.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(deleteCustomer.fulfilled, (state, action: PayloadAction<string>) => { state.loading = false; state.customers = state.customers.filter(c => c.id !== action.payload); })
      .addCase(deleteCustomer.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Delete failed'; })

      // suppliers list
      .addCase(fetchSuppliers.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchSuppliers.fulfilled, (state, action: PayloadAction<Supplier[]>) => { state.loading = false; state.suppliers = action.payload; })
      .addCase(fetchSuppliers.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? action.error?.message ?? 'Failed to load suppliers'; })

      // single supplier
      .addCase(fetchSupplier.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchSupplier.fulfilled, (state, action: PayloadAction<Supplier>) => {
        state.loading = false;
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

      // customer ledger
      .addCase(fetchCustomerLedger.pending, (state) => { state.ledgerLoading = true; state.error = null; state.customerLedger = []; })
      .addCase(fetchCustomerLedger.fulfilled, (state, action: PayloadAction<LedgerEntry[]>) => { state.ledgerLoading = false; state.customerLedger = action.payload; })
      .addCase(fetchCustomerLedger.rejected, (state, action) => { state.ledgerLoading = false; state.error = action.payload ?? action.error?.message ?? 'Failed to load ledger'; });
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
