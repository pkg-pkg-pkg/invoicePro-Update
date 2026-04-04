import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { dashboardAggregator } from '../../services/dashboard/dashboardAggregator';
import {
  CustomerSummary,
  DashboardSummary,
  GstSnapshot,
  LowStockItem,
  RecentTransactions,
  SalesAnalytics,
  SummaryPeriod,
  SupplierSummary,
} from '../../types/dashboard';

// --- Main State Interface ---
interface DashboardState {
  loading: boolean;
  error: string | null;
  period: SummaryPeriod;
  summary: DashboardSummary | null;
  salesAnalytics: SalesAnalytics | null;
  outstandingSummary: { customers: CustomerSummary[] } | null;
  payableSummary: { suppliers: SupplierSummary[] } | null;
  recentTransactions: RecentTransactions | null;
  gstSnapshot: GstSnapshot | null;
  lowStock: LowStockItem[];
}

const initialState: DashboardState = {
  loading: false,
  error: null,
  period: 'today',
  summary: null,
  salesAnalytics: null,
  outstandingSummary: null,
  payableSummary: null,
  recentTransactions: null,
  gstSnapshot: null,
  lowStock: [],
};

export const fetchDashboardSummary = createAsyncThunk(
  'dashboard/fetchSummary',
  async (period: SummaryPeriod, { rejectWithValue }) => {
    try {
      return await dashboardAggregator.summary(period);
    } catch (error: any) {
      return rejectWithValue(error?.message ?? 'Failed to fetch summary');
    }
  }
);

export const fetchSalesAnalytics = createAsyncThunk(
  'dashboard/fetchSalesAnalytics',
  async (params: { period: SummaryPeriod; groupBy: 'day' | 'week' | 'month' }, { rejectWithValue }) => {
    try {
      return await dashboardAggregator.salesAnalytics(params);
    } catch (error: any) {
      return rejectWithValue(error?.message ?? 'Failed to fetch sales analytics');
    }
  }
);

export const fetchOutstandingSummary = createAsyncThunk('dashboard/fetchOutstandingSummary', async (_, { rejectWithValue }) => {
  try {
    return await dashboardAggregator.outstandingSummary();
  } catch (error: any) {
    return rejectWithValue(error?.message ?? 'Failed to fetch outstanding summary');
  }
});

export const fetchPayableSummary = createAsyncThunk('dashboard/fetchPayableSummary', async (_, { rejectWithValue }) => {
  try {
    return await dashboardAggregator.payableSummary();
  } catch (error: any) {
    return rejectWithValue(error?.message ?? 'Failed to fetch payable summary');
  }
});

export const fetchRecentTransactions = createAsyncThunk(
  'dashboard/fetchRecentTransactions',
  async (limit: number = 5, { rejectWithValue }) => {
    try {
      return await dashboardAggregator.recentTransactions(limit);
    } catch (error: any) {
      return rejectWithValue(error?.message ?? 'Failed to fetch recent transactions');
    }
  }
);

export const fetchGstSnapshot = createAsyncThunk(
  'dashboard/fetchGstSnapshot',
  async (period: SummaryPeriod, { rejectWithValue }) => {
    try {
      return await dashboardAggregator.gstSnapshot(period);
    } catch (error: any) {
      return rejectWithValue(error?.message ?? 'Failed to fetch GST snapshot');
    }
  }
);

export const fetchLowStock = createAsyncThunk('dashboard/fetchLowStock', async (_, { rejectWithValue }) => {
  try {
    return await dashboardAggregator.lowStock();
  } catch (error: any) {
    return rejectWithValue(error?.message ?? 'Failed to fetch low stock');
  }
});

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
      .addCase(fetchSalesAnalytics.pending, (_) => { 
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
      })

      // GST Snapshot
      .addCase(fetchGstSnapshot.fulfilled, (state, action) => {
        state.gstSnapshot = action.payload;
      })

      // Low Stock
      .addCase(fetchLowStock.fulfilled, (state, action) => {
        state.lowStock = action.payload;
      });
  },
});

export const { setPeriod, clearError } = dashboardSlice.actions;
export default dashboardSlice.reducer;
