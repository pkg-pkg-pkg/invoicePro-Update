import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios'; // Ensure axios is installed

// --- Interfaces based on your Dashboard.tsx usage ---

interface DashboardSummary {
  totalSales: number;
  salesCount: number;
  totalPurchase: number;
  purchaseCount: number;
  totalOutstanding: number;
  outstandingCount: number;
  totalPayable: number;
  payableCount: number;
  cashInHand: number;
  bankBalance: number;
  profitLoss: number;
  overdueAmount: number;
  overdueCount: number;
}

interface SalesAnalyticsData {
  date: string;
  sales: number;
  tax: number;
}

interface TopProduct {
  productName: string;
  amount: number;
}

interface SalesAnalytics {
  analytics: SalesAnalyticsData[];
  topProducts: TopProduct[];
}

interface CustomerSummary {
  id: string;
  name: string;
  currentBalance: number;
}

interface SupplierSummary {
  id: string;
  name: string;
  currentBalance: number;
}

interface TransactionInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  grandTotal: number;
  paymentStatus: string;
  type: string; // e.g. 'SALES'
}

interface TransactionPayment {
  id: string;
  type: 'RECEIPT' | 'PAYMENT';
  date: string;
  paymentMode: string;
  amount: number;
}

interface RecentTransactions {
  invoices: TransactionInvoice[];
  payments: TransactionPayment[];
}

// --- Main State Interface ---
interface DashboardState {
  loading: boolean;
  error: string | null;
  period: 'today' | 'week' | 'month' | 'year';
  summary: DashboardSummary | null;
  salesAnalytics: SalesAnalytics | null;
  outstandingSummary: { customers: CustomerSummary[] } | null;
  payableSummary: { suppliers: SupplierSummary[] } | null;
  recentTransactions: RecentTransactions | null;
}

const initialState: DashboardState = {
  loading: false,
  error: null,
  period: 'month', // Default period
  summary: null,
  salesAnalytics: null,
  outstandingSummary: null,
  payableSummary: null,
  recentTransactions: null,
};

// --- Async Thunks (API Calls) ---

// 1. Fetch Summary Stats
export const fetchDashboardSummary = createAsyncThunk(
  'dashboard/fetchSummary',
  async (period: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`http://localhost:3000/api/dashboard/summary?period=${period}`);
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch summary');
    }
  }
);

// 2. Fetch Sales Analytics (Chart)
export const fetchSalesAnalytics = createAsyncThunk(
  'dashboard/fetchSalesAnalytics',
  async (params: { period: string; groupBy: string }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`http://localhost:3000/api/dashboard/analytics`, { params });
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch analytics');
    }
  }
);

// 3. Fetch Outstanding (Receivables)
export const fetchOutstandingSummary = createAsyncThunk(
  'dashboard/fetchOutstandingSummary',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('http://localhost:3000/api/dashboard/outstanding');
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch outstanding summary');
    }
  }
);

// 4. Fetch Payable (Payables)
export const fetchPayableSummary = createAsyncThunk(
  'dashboard/fetchPayableSummary',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('http://localhost:3000/api/dashboard/payable');
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch payable summary');
    }
  }
);

// 5. Fetch Recent Transactions
export const fetchRecentTransactions = createAsyncThunk(
  'dashboard/fetchRecentTransactions',
  async (limit: number = 5, { rejectWithValue }) => {
    try {
      const response = await axios.get(`http://localhost:3000/api/dashboard/recent-transactions?limit=${limit}`);
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch recent transactions');
    }
  }
);

// --- Slice Definition ---

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setPeriod: (state, action: PayloadAction<'today' | 'week' | 'month' | 'year'>) => {
      state.period = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Helper to handle generic loading state for all thunks
    const handlePending = (state: DashboardState) => {
      state.loading = true;
      state.error = null;
    };
    const handleRejected = (state: DashboardState, action: any) => {
      state.loading = false;
      state.error = action.payload as string;
    };

    builder
      // Summary
      .addCase(fetchDashboardSummary.pending, handlePending)
      .addCase(fetchDashboardSummary.fulfilled, (state, action) => {
        state.loading = false;
        state.summary = action.payload;
      })
      .addCase(fetchDashboardSummary.rejected, handleRejected)

      // Sales Analytics
      .addCase(fetchSalesAnalytics.pending, (state) => { 
         // Optional: Don't set global loading true for charts to avoid flickering whole page
         // state.loading = true; 
      })
      .addCase(fetchSalesAnalytics.fulfilled, (state, action) => {
        state.salesAnalytics = action.payload;
      })
      
      // Outstanding
      .addCase(fetchOutstandingSummary.fulfilled, (state, action) => {
        state.outstandingSummary = action.payload;
      })

      // Payable
      .addCase(fetchPayableSummary.fulfilled, (state, action) => {
        state.payableSummary = action.payload;
      })

      // Recent Transactions
      .addCase(fetchRecentTransactions.fulfilled, (state, action) => {
        state.recentTransactions = action.payload;
      });
  },
});

export const { setPeriod, clearError } = dashboardSlice.actions;
export default dashboardSlice.reducer;
