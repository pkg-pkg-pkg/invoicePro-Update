// src/store/slices/authSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

// User roles and permissions
export type UserRole = 'admin' | 'manager' | 'accountant' | 'sales' | 'viewer';

export interface UserPermissions {
  // Dashboard
  viewDashboard: boolean;
  viewAnalytics: boolean;

  // Sales & Invoices
  createInvoices: boolean;
  editInvoices: boolean;
  deleteInvoices: boolean;
  viewInvoices: boolean;
  printInvoices: boolean;
  viewVouchers: boolean;

  // Payments & Receipts
  createPayments: boolean;
  editPayments: boolean;
  deletePayments: boolean;
  viewPayments: boolean;

  // Customers & Suppliers
  createCustomers: boolean;
  editCustomers: boolean;
  deleteCustomers: boolean;
  viewCustomers: boolean;

  createSuppliers: boolean;
  editSuppliers: boolean;
  deleteSuppliers: boolean;
  viewSuppliers: boolean;

  // Products & Inventory
  createProducts: boolean;
  editProducts: boolean;
  deleteProducts: boolean;
  viewProducts: boolean;
  manageInventory: boolean;

  // Banking
  createBankAccounts: boolean;
  editBankAccounts: boolean;
  deleteBankAccounts: boolean;
  viewBankAccounts: boolean;
  viewBankStatements: boolean;

  // Masters
  viewLedgers: boolean;
  manageLedgers: boolean;
  viewInventoryMasters: boolean;

  // Reports & GST
  viewReports: boolean;
  exportReports: boolean;
  viewGSTReports: boolean;
  fileGST: boolean;

  // Settings & Configuration
  manageSettings: boolean;
  manageUsers: boolean;
  manageCompany: boolean;
  customizePrint: boolean;

  // System
  backupData: boolean;
  restoreData: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  permissions: UserPermissions;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    viewDashboard: true,
    viewAnalytics: true,
    createInvoices: true,
    editInvoices: true,
    deleteInvoices: true,
    viewInvoices: true,
    printInvoices: true,
    viewVouchers: true,
    createPayments: true,
    editPayments: true,
    deletePayments: true,
    viewPayments: true,
    createCustomers: true,
    editCustomers: true,
    deleteCustomers: true,
    viewCustomers: true,
    createSuppliers: true,
    editSuppliers: true,
    deleteSuppliers: true,
    viewSuppliers: true,
    createProducts: true,
    editProducts: true,
    deleteProducts: true,
    viewProducts: true,
    manageInventory: true,
    createBankAccounts: true,
    editBankAccounts: true,
    deleteBankAccounts: true,
    viewBankAccounts: true,
    viewBankStatements: true,
    viewLedgers: true,
    manageLedgers: true,
    viewInventoryMasters: true,
    viewReports: true,
    exportReports: true,
    viewGSTReports: true,
    fileGST: true,
    manageSettings: true,
    manageUsers: true,
    manageCompany: true,
    customizePrint: true,
    backupData: true,
    restoreData: true,
  },
  manager: {
    viewDashboard: true,
    viewAnalytics: true,
    createInvoices: true,
    editInvoices: true,
    deleteInvoices: false,
    viewInvoices: true,
    printInvoices: true,
    viewVouchers: true,
    createPayments: true,
    editPayments: true,
    deletePayments: false,
    viewPayments: true,
    createCustomers: true,
    editCustomers: true,
    deleteCustomers: false,
    viewCustomers: true,
    createSuppliers: true,
    editSuppliers: true,
    deleteSuppliers: false,
    viewSuppliers: true,
    createProducts: true,
    editProducts: true,
    deleteProducts: false,
    viewProducts: true,
    manageInventory: true,
    createBankAccounts: false,
    editBankAccounts: false,
    deleteBankAccounts: false,
    viewBankAccounts: true,
    viewBankStatements: true,
    viewLedgers: true,
    manageLedgers: false,
    viewInventoryMasters: true,
    viewReports: true,
    exportReports: true,
    viewGSTReports: true,
    fileGST: false,
    manageSettings: false,
    manageUsers: false,
    manageCompany: false,
    customizePrint: true,
    backupData: false,
    restoreData: false,
  },
  accountant: {
    viewDashboard: true,
    viewAnalytics: true,
    createInvoices: true,
    editInvoices: true,
    deleteInvoices: false,
    viewInvoices: true,
    printInvoices: true,
    viewVouchers: true,
    createPayments: true,
    editPayments: true,
    deletePayments: false,
    viewPayments: true,
    createCustomers: false,
    editCustomers: false,
    deleteCustomers: false,
    viewCustomers: true,
    createSuppliers: false,
    editSuppliers: false,
    deleteSuppliers: false,
    viewSuppliers: true,
    createProducts: false,
    editProducts: false,
    deleteProducts: false,
    viewProducts: true,
    manageInventory: false,
    createBankAccounts: false,
    editBankAccounts: false,
    deleteBankAccounts: false,
    viewBankAccounts: true,
    viewBankStatements: true,
    viewLedgers: true,
    manageLedgers: false,
    viewInventoryMasters: true,
    viewReports: true,
    exportReports: true,
    viewGSTReports: true,
    fileGST: true,
    manageSettings: false,
    manageUsers: false,
    manageCompany: false,
    customizePrint: true,
    backupData: false,
    restoreData: false,
  },
  sales: {
    viewDashboard: true,
    viewAnalytics: false,
    createInvoices: true,
    editInvoices: false,
    deleteInvoices: false,
    viewInvoices: true,
    printInvoices: true,
    viewVouchers: true,
    createPayments: false,
    editPayments: false,
    deletePayments: false,
    viewPayments: true,
    createCustomers: true,
    editCustomers: true,
    deleteCustomers: false,
    viewCustomers: true,
    createSuppliers: false,
    editSuppliers: false,
    deleteSuppliers: false,
    viewSuppliers: false,
    createProducts: false,
    editProducts: false,
    deleteProducts: false,
    viewProducts: true,
    manageInventory: false,
    createBankAccounts: false,
    editBankAccounts: false,
    deleteBankAccounts: false,
    viewBankAccounts: false,
    viewBankStatements: false,
    viewLedgers: false,
    manageLedgers: false,
    viewInventoryMasters: false,
    viewReports: true,
    exportReports: false,
    viewGSTReports: false,
    fileGST: false,
    manageSettings: false,
    manageUsers: false,
    manageCompany: false,
    customizePrint: false,
    backupData: false,
    restoreData: false,
  },
  viewer: {
    viewDashboard: true,
    viewAnalytics: false,
    createInvoices: false,
    editInvoices: false,
    deleteInvoices: false,
    viewInvoices: true,
    printInvoices: true,
    viewVouchers: true,
    createPayments: false,
    editPayments: false,
    deletePayments: false,
    viewPayments: true,
    createCustomers: false,
    editCustomers: false,
    deleteCustomers: false,
    viewCustomers: true,
    createSuppliers: false,
    editSuppliers: false,
    deleteSuppliers: false,
    viewSuppliers: false,
    createProducts: false,
    editProducts: false,
    deleteProducts: false,
    viewProducts: true,
    manageInventory: false,
    createBankAccounts: false,
    editBankAccounts: false,
    deleteBankAccounts: false,
    viewBankAccounts: false,
    viewBankStatements: false,
    viewLedgers: false,
    manageLedgers: false,
    viewInventoryMasters: false,
    viewReports: true,
    exportReports: false,
    viewGSTReports: false,
    fileGST: false,
    manageSettings: false,
    manageUsers: false,
    manageCompany: false,
    customizePrint: false,
    backupData: false,
    restoreData: false,
  },
};

export interface AuthState {
  user: User | null;
  users: User[];
  token: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  users: [],
  token: null,
  loading: false,
  error: null,
  isAuthenticated: false,
};

// Example thunks: login / logout / fetchProfile
export const login = createAsyncThunk<any, { username: string; password: string }, { rejectValue: string }>(
  'auth/login',
  async (creds, thunkAPI) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      if (!res.ok) return thunkAPI.rejectWithValue('Invalid credentials');
      return (await res.json()) as any;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

export const logout = createAsyncThunk<void, void, { rejectValue: string }>(
  'auth/logout',
  async () => {
    // optionally call backend to logout
    return;
  }
);

export const fetchProfile = createAsyncThunk<any, void, { rejectValue: string }>(
  'auth/fetchProfile',
  async (_, thunkAPI) => {
    try {
      const res = await fetch('/api/auth/profile');
      if (!res.ok) return thunkAPI.rejectWithValue('Failed to fetch profile');
      return (await res.json()) as any;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    setUser(state, action: PayloadAction<any | null>) {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.user = action.payload.user ?? action.payload;
        state.token = action.payload.token ?? state.token;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Login failed';
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      })
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to fetch profile';
      });
  },
});

export const { clearError, setToken, setUser } = authSlice.actions;

export const selectAuthUser = (state: any) => state.auth?.user ?? null;
export const selectAuthToken = (state: any) => state.auth?.token ?? null;
export const selectAuthLoading = (state: any) => !!state.auth?.loading;
export const selectAuthError = (state: any) => state.auth?.error ?? null;
export const selectIsAuthenticated = (state: any) => !!state.auth?.isAuthenticated;

export default authSlice.reducer;
