// src/store/slices/bankSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
  accountType: string;
  openingBalance: number;
  currentBalance: number;
  type?: string;
  branch?: string;
  isActive?: boolean;
  _count?: {
    payments?: number;
  };
}

export interface BankTransaction {
  id: string;
  accountId: string;
  date: string;
  type: 'credit' | 'debit' | 'RECEIPT' | 'PAYMENT';
  amount: number;
  description?: string;
  reference?: string;
  referenceNumber?: string;
  balance: number;
  paymentMode?: string;
  invoice?: {
    invoiceNumber: string;
  };
}

export interface BankFilters {
  q?: string;
  search?: string;
  minBalance?: number;
  maxBalance?: number;
  type?: string;
  accountType?: string;
  isActive?: boolean;
}

export interface BankState {
  accounts: BankAccount[];
  currentAccount: BankAccount | null;
  summary: any;
  statement: any;
  transactions: BankTransaction[];
  filters: BankFilters;
  loading: boolean;
  error: string | null;
  reconciliationData: any;
}

const initialState: BankState = {
  accounts: [],
  currentAccount: null,
  summary: null,
  statement: null,
  transactions: [],
  filters: {},
  loading: false,
  error: null,
  reconciliationData: null,
};

/* --------------------
   THUNKS
-------------------- */

/** Fetch all bank accounts */
export const fetchBanks = createAsyncThunk<BankAccount[], any, { rejectValue: string }>(
  'bank/fetchBanks',
  async (filters, thunkAPI) => {
    try {
      let url = '/api/banks';
      if (filters && Object.keys(filters).length > 0) {
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        if (filters.accountType) params.append('accountType', filters.accountType);
        if (filters.isActive !== undefined) params.append('isActive', String(filters.isActive));
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await res.json()) as BankAccount[];
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

// Alias for compatibility
export const fetchBankAccounts = fetchBanks;

/** Fetch single bank account */
export const fetchBank = createAsyncThunk<BankAccount, string, { rejectValue: string }>(
  'bank/fetchBank',
  async (id, thunkAPI) => {
    try {
      const res = await fetch(`/api/banks/${encodeURIComponent(id)}`);
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await res.json()) as BankAccount;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

// Alias for compatibility
export const fetchBankAccount = fetchBank;

/** Fetch bank summary/statistics */
export const fetchBankSummary = createAsyncThunk<any, void, { rejectValue: string }>(
  'bank/fetchBankSummary',
  async (_, thunkAPI) => {
    try {
      const res = await fetch('/api/banks/summary');
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return await res.json();
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** Fetch bank statement */
export const fetchBankStatement = createAsyncThunk<any, { id: string; fromDate?: string; toDate?: string; page?: number; limit?: number }, { rejectValue: string }>(
  'bank/fetchBankStatement',
  async ({ id, fromDate, toDate, page, limit }, thunkAPI) => {
    try {
      let url = `/api/banks/${encodeURIComponent(id)}/statement`;
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (page) params.append('page', String(page));
      if (limit) params.append('limit', String(limit));
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return await res.json();
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** Fetch bank transactions */
export const fetchBankTransactions = createAsyncThunk<BankTransaction[], { accountId?: string; fromDate?: string; toDate?: string }, { rejectValue: string }>(
  'bank/fetchBankTransactions',
  async ({ accountId, fromDate, toDate }, thunkAPI) => {
    try {
      let url = '/api/bank-transactions';
      const params = new URLSearchParams();
      if (accountId) params.append('accountId', accountId);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await res.json()) as BankTransaction[];
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** Add new bank account */
export const addBank = createAsyncThunk<BankAccount, Partial<BankAccount>, { rejectValue: string }>(
  'bank/addBank',
  async (payload, thunkAPI) => {
    try {
      const res = await fetch('/api/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await res.json()) as BankAccount;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

// Alias for compatibility
export const createBankAccount = addBank;

/** Update existing bank account */
export const updateBank = createAsyncThunk<BankAccount, { id: string; changes: Partial<BankAccount> }, { rejectValue: string }>(
  'bank/updateBank',
  async ({ id, changes }, thunkAPI) => {
    try {
      const res = await fetch(`/api/banks/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await res.json()) as BankAccount;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

// Alias for compatibility
export const updateBankAccount = updateBank;

/** Delete bank account */
export const deleteBank = createAsyncThunk<string, string, { rejectValue: string }>(
  'bank/deleteBank',
  async (id, thunkAPI) => {
    try {
      const res = await fetch(`/api/banks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return id;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

// Alias for compatibility
export const deleteBankAccount = deleteBank;

/** Reconcile bank account */
export const reconcileBank = createAsyncThunk<any, { id: string; data: any }, { rejectValue: string }>(
  'bank/reconcileBank',
  async ({ id, data }, thunkAPI) => {
    try {
      const res = await fetch(`/api/banks/${encodeURIComponent(id)}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return await res.json();
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

// Alias for compatibility
export const reconcileBankAccount = reconcileBank;

/** Transfer between bank accounts */
export const transferBetweenAccounts = createAsyncThunk<any, { fromAccountId: string; toAccountId: string; amount: number; note?: string }, { rejectValue: string }>(
  'bank/transferBetweenAccounts',
  async ({ fromAccountId, toAccountId, amount, note }, thunkAPI) => {
    try {
      const res = await fetch('/api/banks/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAccountId, toAccountId, amount, note }),
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return await res.json();
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** Add bank transaction */
export const addBankTransaction = createAsyncThunk<BankTransaction, Partial<BankTransaction>, { rejectValue: string }>(
  'bank/addBankTransaction',
  async (payload, thunkAPI) => {
    try {
      const res = await fetch('/api/bank-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await res.json()) as BankTransaction;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** Update bank transaction */
export const updateBankTransaction = createAsyncThunk<BankTransaction, { id: string; changes: Partial<BankTransaction> }, { rejectValue: string }>(
  'bank/updateBankTransaction',
  async ({ id, changes }, thunkAPI) => {
    try {
      const res = await fetch(`/api/bank-transactions/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await res.json()) as BankTransaction;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** Delete bank transaction */
export const deleteBankTransaction = createAsyncThunk<string, string, { rejectValue: string }>(
  'bank/deleteBankTransaction',
  async (id, thunkAPI) => {
    try {
      const res = await fetch(`/api/bank-transactions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return id;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** Import bank statement */
export const importBankStatement = createAsyncThunk<any, { accountId: string; file: File }, { rejectValue: string }>(
  'bank/importBankStatement',
  async ({ accountId, file }, thunkAPI) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('accountId', accountId);

      const res = await fetch('/api/banks/import-statement', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return await res.json();
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** Export bank statement */
export const exportBankStatement = createAsyncThunk<any, { accountId: string; fromDate?: string; toDate?: string; format?: string }, { rejectValue: string }>(
  'bank/exportBankStatement',
  async ({ accountId, fromDate, toDate, format = 'pdf' }, thunkAPI) => {
    try {
      let url = `/api/banks/${encodeURIComponent(accountId)}/export`;
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      params.append('format', format);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return await res.blob();
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** Get bank balance */
export const getBankBalance = createAsyncThunk<{ balance: number }, string, { rejectValue: string }>(
  'bank/getBankBalance',
  async (accountId, thunkAPI) => {
    try {
      const res = await fetch(`/api/banks/${encodeURIComponent(accountId)}/balance`);
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return await res.json();
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** Activate/Deactivate bank account */
export const toggleBankAccountStatus = createAsyncThunk<BankAccount, { id: string; isActive: boolean }, { rejectValue: string }>(
  'bank/toggleBankAccountStatus',
  async ({ id, isActive }, thunkAPI) => {
    try {
      const res = await fetch(`/api/banks/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await res.json()) as BankAccount;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/* --------------------
   SLICE
-------------------- */

const bankSlice = createSlice({
  name: 'bank',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setBanks(state, action: PayloadAction<BankAccount[]>) {
      state.accounts = action.payload;
    },
    setCurrentAccount(state, action: PayloadAction<BankAccount | null>) {
      state.currentAccount = action.payload;
    },
    clearCurrentAccount(state) {
      state.currentAccount = null;
    },
    setBankStatement(state, action: PayloadAction<any>) {
      state.statement = action.payload;
    },
    clearBankStatement(state) {
      state.statement = null;
    },
    setBankTransactions(state, action: PayloadAction<BankTransaction[]>) {
      state.transactions = action.payload;
    },
    clearBankTransactions(state) {
      state.transactions = [];
    },
    setReconciliationData(state, action: PayloadAction<any>) {
      state.reconciliationData = action.payload;
    },
    clearReconciliationData(state) {
      state.reconciliationData = null;
    },
    // FILTERS
    setFilters(state, action: PayloadAction<BankFilters>) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters(state) {
      state.filters = {};
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchBanks
      .addCase(fetchBanks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBanks.fulfilled, (state, action: PayloadAction<BankAccount[]>) => {
        state.loading = false;
        state.accounts = action.payload;
      })
      .addCase(fetchBanks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to fetch banks';
      })

      // fetchBank (single)
      .addCase(fetchBank.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBank.fulfilled, (state, action: PayloadAction<BankAccount>) => {
        state.loading = false;
        state.currentAccount = action.payload;
        const idx = state.accounts.findIndex(b => b.id === action.payload.id);
        if (idx >= 0) state.accounts[idx] = action.payload;
        else state.accounts.unshift(action.payload);
      })
      .addCase(fetchBank.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to load bank account';
      })

      // fetchBankSummary
      .addCase(fetchBankSummary.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBankSummary.fulfilled, (state, action) => {
        state.loading = false;
        state.summary = action.payload;
      })
      .addCase(fetchBankSummary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to fetch summary';
      })

      // fetchBankStatement
      .addCase(fetchBankStatement.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBankStatement.fulfilled, (state, action) => {
        state.loading = false;
        state.statement = action.payload;
      })
      .addCase(fetchBankStatement.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to fetch statement';
      })

      // fetchBankTransactions
      .addCase(fetchBankTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBankTransactions.fulfilled, (state, action: PayloadAction<BankTransaction[]>) => {
        state.loading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchBankTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to fetch transactions';
      })

      // addBank
      .addCase(addBank.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addBank.fulfilled, (state, action: PayloadAction<BankAccount>) => {
        state.loading = false;
        state.accounts.unshift(action.payload);
      })
      .addCase(addBank.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Add bank failed';
      })

      // updateBank
      .addCase(updateBank.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateBank.fulfilled, (state, action: PayloadAction<BankAccount>) => {
        state.loading = false;
        const idx = state.accounts.findIndex(b => b.id === action.payload.id);
        if (idx >= 0) state.accounts[idx] = action.payload;
        if (state.currentAccount?.id === action.payload.id) state.currentAccount = action.payload;
      })
      .addCase(updateBank.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Update failed';
      })

      // deleteBank
      .addCase(deleteBank.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteBank.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false;
        state.accounts = state.accounts.filter(b => b.id !== action.payload);
        if (state.currentAccount?.id === action.payload) state.currentAccount = null;
      })
      .addCase(deleteBank.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Delete failed';
      })

      // reconcileBank
      .addCase(reconcileBank.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(reconcileBank.fulfilled, (state, action) => {
        state.loading = false;
        state.reconciliationData = action.payload;
      })
      .addCase(reconcileBank.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Reconciliation failed';
      })

      // transferBetweenAccounts
      .addCase(transferBetweenAccounts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(transferBetweenAccounts.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(transferBetweenAccounts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Transfer failed';
      })

      // addBankTransaction
      .addCase(addBankTransaction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addBankTransaction.fulfilled, (state, action: PayloadAction<BankTransaction>) => {
        state.loading = false;
        state.transactions.unshift(action.payload);
      })
      .addCase(addBankTransaction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Add transaction failed';
      })

      // updateBankTransaction
      .addCase(updateBankTransaction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateBankTransaction.fulfilled, (state, action: PayloadAction<BankTransaction>) => {
        state.loading = false;
        const idx = state.transactions.findIndex(t => t.id === action.payload.id);
        if (idx >= 0) state.transactions[idx] = action.payload;
      })
      .addCase(updateBankTransaction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Update transaction failed';
      })

      // deleteBankTransaction
      .addCase(deleteBankTransaction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteBankTransaction.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false;
        state.transactions = state.transactions.filter(t => t.id !== action.payload);
      })
      .addCase(deleteBankTransaction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Delete transaction failed';
      })

      // importBankStatement
      .addCase(importBankStatement.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(importBankStatement.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(importBankStatement.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Import failed';
      })

      // exportBankStatement
      .addCase(exportBankStatement.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(exportBankStatement.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(exportBankStatement.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Export failed';
      })

      // getBankBalance
      .addCase(getBankBalance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getBankBalance.fulfilled, (state, action) => {
        state.loading = false;
        if (state.currentAccount) {
          state.currentAccount.currentBalance = action.payload.balance;
        }
      })
      .addCase(getBankBalance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to get balance';
      })

      // toggleBankAccountStatus
      .addCase(toggleBankAccountStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(toggleBankAccountStatus.fulfilled, (state, action: PayloadAction<BankAccount>) => {
        state.loading = false;
        const idx = state.accounts.findIndex(b => b.id === action.payload.id);
        if (idx >= 0) state.accounts[idx] = action.payload;
        if (state.currentAccount?.id === action.payload.id) state.currentAccount = action.payload;
      })
      .addCase(toggleBankAccountStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Status update failed';
      });
  },
});

export const {
  clearError,
  setBanks,
  setCurrentAccount,
  clearCurrentAccount,
  setBankStatement,
  clearBankStatement,
  setBankTransactions,
  clearBankTransactions,
  setReconciliationData,
  clearReconciliationData,
  setFilters,
  clearFilters,
} = bankSlice.actions;

// Additional aliases for compatibility
export const setCurrentBankAccount = setCurrentAccount;
export const clearCurrentBankAccount = clearCurrentAccount;

// ✅ FIXED SELECTORS - ab state.bank.accounts ko properly access karenge
export const selectBanks = (state: any) => state.bank?.accounts ?? [];
export const selectBankAccounts = (state: any) => state.bank?.accounts ?? [];  // NEW ALIAS
export const selectCurrentAccount = (state: any) => state.bank?.currentAccount ?? null;
export const selectBankSummary = (state: any) => state.bank?.summary ?? null;
export const selectBankStatement = (state: any) => state.bank?.statement ?? null;
export const selectBankTransactions = (state: any) => state.bank?.transactions ?? [];
export const selectReconciliationData = (state: any) => state.bank?.reconciliationData ?? null;
export const selectBankFilters = (state: any) => state.bank?.filters ?? {};
export const selectBankLoading = (state: any) => !!state.bank?.loading;
export const selectBankError = (state: any) => state.bank?.error ?? null;
export default bankSlice.reducer;
