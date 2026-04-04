// src/store/slices/bankSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

const API = (import.meta.env?.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '');

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

const BANKS_STORAGE_KEY = 'pve_bank_accounts';
const BANK_TX_STORAGE_KEY = 'pve_bank_transactions';

const getStoredBankAccounts = (): BankAccount[] => {
  try {
    const raw = localStorage.getItem(BANKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BankAccount[]) : [];
  } catch {
    return [];
  }
};

const saveStoredBankAccounts = (accounts: BankAccount[]) => {
  localStorage.setItem(BANKS_STORAGE_KEY, JSON.stringify(accounts));
};

const getStoredBankTransactions = (): BankTransaction[] => {
  try {
    const raw = localStorage.getItem(BANK_TX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BankTransaction[]) : [];
  } catch {
    return [];
  }
};

const saveStoredBankTransactions = (tx: BankTransaction[]) => {
  localStorage.setItem(BANK_TX_STORAGE_KEY, JSON.stringify(tx));
};

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
  bankAccounts?: BankAccount[]; // Alias for accounts
  currentAccount: BankAccount | null;
  summary: any;
  statement: any;
  bankStatement?: any; // Alias for statement
  transactions: BankTransaction[];
  filters: BankFilters;
  loading: boolean;
  error: string | null;
  reconciliationData: any;
}

const initialState: BankState = {
  accounts: [],
  bankAccounts: [],
  currentAccount: null,
  summary: null,
  statement: null,
  bankStatement: null,
  transactions: [],
  filters: {},
  loading: false,
  error: null,
  reconciliationData: null,
};

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const ensureJson = async (res: Response) => {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const txt = await res.text();
    throw new Error(`Unexpected response (${ct || 'unknown'}): ${txt.slice(0, 160)}`);
  }
  return res.json();
};

/* --------------------
   THUNKS
-------------------- */

/** Fetch all bank accounts */
export const fetchBanks = createAsyncThunk<BankAccount[], any, { rejectValue: string }>(
  'bank/fetchBanks',
  async (filters, thunkAPI) => {
    try {
      if (isOfflineRuntime()) {
        let accounts = getStoredBankAccounts();
        const f = filters || {};
        if (f.search) {
          const s = String(f.search).toLowerCase();
          accounts = accounts.filter((a) =>
            String(a.name ?? '').toLowerCase().includes(s) ||
            String(a.accountNumber ?? '').toLowerCase().includes(s) ||
            String(a.bankName ?? '').toLowerCase().includes(s) ||
            String(a.ifscCode ?? '').toLowerCase().includes(s)
          );
        }
        if (f.accountType) {
          accounts = accounts.filter((a) => a.accountType === f.accountType);
        }
        if (f.isActive !== undefined) {
          accounts = accounts.filter((a) => Boolean(a.isActive) === Boolean(f.isActive));
        }
        return accounts;
      }
      let url = `${API}/api/banks`;
      if (filters && Object.keys(filters).length > 0) {
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        if (filters.accountType) params.append('accountType', filters.accountType);
        if (filters.isActive !== undefined) params.append('isActive', String(filters.isActive));
        url += `?${params.toString()}`;
      }

      const res = await fetch(url, { headers: { ...getAuthHeaders() } });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      const parsed = await ensureJson(res);
      if (Array.isArray(parsed)) return parsed as BankAccount[];
      if (Array.isArray(parsed?.data)) return parsed.data as BankAccount[];
      return [];
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
      if (isOfflineRuntime()) {
        const accounts = getStoredBankAccounts();
        const found = accounts.find((a) => String(a.id) === String(id));
        if (!found) return thunkAPI.rejectWithValue('Bank account not found');
        return found;
      }
      const res = await fetch(`${API}/api/banks/${encodeURIComponent(id)}`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await ensureJson(res)) as BankAccount;
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
      if (isOfflineRuntime()) {
        const accounts = getStoredBankAccounts();
        const cashBalance = accounts
          .filter((a) => String(a.accountType).toUpperCase() === 'CASH')
          .reduce((sum, a) => sum + Number(a.currentBalance ?? 0), 0);
        const bankBalance = accounts
          .filter((a) => String(a.accountType).toUpperCase() !== 'CASH')
          .reduce((sum, a) => sum + Number(a.currentBalance ?? 0), 0);
        const totalBalance = cashBalance + bankBalance;
        return {
          totalBalance,
          cashBalance,
          bankBalance,
          accountCount: accounts.length,
        };
      }
      const res = await fetch(`${API}/api/banks/summary`, { headers: { ...getAuthHeaders() } });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return await ensureJson(res);
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
      if (isOfflineRuntime()) {
        const accounts = getStoredBankAccounts();
        const account = accounts.find((a) => String(a.id) === String(id));
        if (!account) return thunkAPI.rejectWithValue('Bank account not found');

        let statement = getStoredBankTransactions().filter((t) => String(t.accountId) === String(id));
        if (fromDate) statement = statement.filter((t) => String(t.date) >= String(fromDate));
        if (toDate) statement = statement.filter((t) => String(t.date) <= String(toDate));

        const pageNum = page ?? 1;
        const limitNum = limit ?? 50;
        const start = (pageNum - 1) * limitNum;
        const paged = statement.slice(start, start + limitNum);

        return {
          bankAccount: account,
          statement: paged,
          pagination: {
            total: statement.length,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(statement.length / limitNum) || 1,
          },
        };
      }
      let url = `${API}/api/banks/${encodeURIComponent(id)}/statement`;
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (page) params.append('page', String(page));
      if (limit) params.append('limit', String(limit));
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: { ...getAuthHeaders() } });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return await ensureJson(res);
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
      if (isOfflineRuntime()) {
        let tx = getStoredBankTransactions();
        if (accountId) tx = tx.filter((t) => String(t.accountId) === String(accountId));
        if (fromDate) tx = tx.filter((t) => String(t.date) >= String(fromDate));
        if (toDate) tx = tx.filter((t) => String(t.date) <= String(toDate));
        return tx;
      }
      let url = `${API}/api/bank-transactions`;
      const params = new URLSearchParams();
      if (accountId) params.append('accountId', accountId);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: { ...getAuthHeaders() } });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      const parsed = await ensureJson(res);
      if (Array.isArray(parsed)) return parsed as BankTransaction[];
      if (Array.isArray(parsed?.data)) return parsed.data as BankTransaction[];
      return [];
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
      if (isOfflineRuntime()) {
        const accounts = getStoredBankAccounts();
        const id = String(payload.id ?? `bank-${Date.now()}`);
        const opening = Number(payload.openingBalance ?? 0);
        const created: BankAccount = {
          id,
          name: String(payload.name ?? ''),
          accountNumber: String(payload.accountNumber ?? ''),
          ifscCode: String(payload.ifscCode ?? ''),
          bankName: String(payload.bankName ?? ''),
          branchName: payload.branchName,
          accountType: String(payload.accountType ?? 'CURRENT'),
          openingBalance: opening,
          currentBalance: Number(payload.currentBalance ?? opening),
          isActive: payload.isActive ?? true,
        };
        const next = [created, ...accounts.filter((a) => String(a.id) !== id)];
        saveStoredBankAccounts(next);
        return created;
      }
      const res = await fetch(`${API}/api/banks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await ensureJson(res)) as BankAccount;
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
      if (isOfflineRuntime()) {
        const accounts = getStoredBankAccounts();
        const idx = accounts.findIndex((a) => String(a.id) === String(id));
        if (idx < 0) return thunkAPI.rejectWithValue('Bank account not found');
        const updated: BankAccount = { ...accounts[idx], ...changes, id: String(accounts[idx].id) } as BankAccount;
        const next = [...accounts];
        next[idx] = updated;
        saveStoredBankAccounts(next);
        return updated;
      }
      const res = await fetch(`${API}/api/banks/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return (await ensureJson(res)) as BankAccount;
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
      if (isOfflineRuntime()) {
        const accounts = getStoredBankAccounts();
        saveStoredBankAccounts(accounts.filter((a) => String(a.id) !== String(id)));
        const tx = getStoredBankTransactions();
        saveStoredBankTransactions(tx.filter((t) => String(t.accountId) !== String(id)));
        return id;
      }
      const res = await fetch(`${API}/api/banks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
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
      if (isOfflineRuntime()) {
        const accounts = getStoredBankAccounts();
        const idx = accounts.findIndex((a) => String(a.id) === String(id));
        if (idx < 0) return thunkAPI.rejectWithValue('Bank account not found');
        const next = [...accounts];
        next[idx] = { ...next[idx], currentBalance: Number(data?.balance ?? next[idx].currentBalance) };
        saveStoredBankAccounts(next);
        return { success: true };
      }
      const res = await fetch(`${API}/api/banks/${encodeURIComponent(id)}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const t = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${t}`);
      }
      return await ensureJson(res);
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
      if (isOfflineRuntime()) {
        if (!payload.accountId) return thunkAPI.rejectWithValue('accountId is required');
        const tx = getStoredBankTransactions();
        const id = String(payload.id ?? `btx-${Date.now()}`);
        const created: BankTransaction = {
          id,
          accountId: String(payload.accountId),
          date: String(payload.date ?? new Date().toISOString()),
          type: (payload.type as any) ?? 'credit',
          amount: Number(payload.amount ?? 0),
          description: payload.description,
          reference: payload.reference,
          referenceNumber: payload.referenceNumber,
          balance: Number(payload.balance ?? 0),
          paymentMode: payload.paymentMode,
          invoice: payload.invoice,
        };
        saveStoredBankTransactions([created, ...tx]);
        return created;
      }
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
      if (isOfflineRuntime()) {
        const tx = getStoredBankTransactions();
        const idx = tx.findIndex((t) => String(t.id) === String(id));
        if (idx < 0) return thunkAPI.rejectWithValue('Transaction not found');
        const updated: BankTransaction = { ...tx[idx], ...changes, id: String(tx[idx].id) } as BankTransaction;
        const next = [...tx];
        next[idx] = updated;
        saveStoredBankTransactions(next);
        return updated;
      }
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
      if (isOfflineRuntime()) {
        const tx = getStoredBankTransactions();
        saveStoredBankTransactions(tx.filter((t) => String(t.id) !== String(id)));
        return id;
      }
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
export const selectBanks = (state: any) => (state.banks ?? state.bank)?.accounts ?? [];
export const selectBankAccounts = (state: any) => (state.banks ?? state.bank)?.accounts ?? [];
export const selectCurrentAccount = (state: any) => (state.banks ?? state.bank)?.currentAccount ?? null;
export const selectBankSummary = (state: any) => (state.banks ?? state.bank)?.summary ?? null;
export const selectBankStatement = (state: any) => (state.banks ?? state.bank)?.statement ?? null;
export const selectBankTransactions = (state: any) => (state.banks ?? state.bank)?.transactions ?? [];
export const selectReconciliationData = (state: any) => (state.banks ?? state.bank)?.reconciliationData ?? null;
export const selectBankFilters = (state: any) => (state.banks ?? state.bank)?.filters ?? {};
export const selectBankLoading = (state: any) => !!((state.banks ?? state.bank)?.loading);
export const selectBankError = (state: any) => (state.banks ?? state.bank)?.error ?? null;
export default bankSlice.reducer;
