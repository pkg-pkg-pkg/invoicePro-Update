import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { dashboardAggregator } from '../../services/dashboard/dashboardAggregator';
import {
  AgingSaleVoucher,
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
  /** GST tab period (independent from main `period` / summary range). */
  gstPeriod: SummaryPeriod;
  /** Today-only summary for dashboard header / quick metrics (optional fast path). */
  todaySummary: DashboardSummary | null;
  todayOverviewLoading: boolean;
  monthSummary: DashboardSummary | null;
  monthOverviewLoading: boolean;
  summary: DashboardSummary | null;
  salesAnalytics: SalesAnalytics | null;
  outstandingSummary: {
    customers: CustomerSummary[];
    salesVouchers: AgingSaleVoucher[];
  } | null;
  payableSummary: { suppliers: SupplierSummary[] } | null;
  recentTransactions: RecentTransactions | null;
  gstSnapshot: GstSnapshot | null;
  lowStock: LowStockItem[];
}

const initialState: DashboardState = {
  loading: false,
  error: null,
  period: 'today',
  gstPeriod: 'month',
  todaySummary: null,
  todayOverviewLoading: false,
  monthSummary: null,
  monthOverviewLoading: false,
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
  async (
    params: number | { limit?: number; invoicePeriod?: SummaryPeriod } = 5,
    { rejectWithValue }
  ) => {
    try {
      const limit = typeof params === 'number' ? params : params.limit ?? 5;
      const invoicePeriod = typeof params === 'number' ? undefined : params.invoicePeriod;
      return await dashboardAggregator.recentTransactions(limit, { invoicePeriod });
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

export const fetchGstSnapshotForDateRange = createAsyncThunk(
  'dashboard/fetchGstSnapshotForDateRange',
  async (params: { fromYmd: string; toYmd: string }, { rejectWithValue }) => {
    try {
      return await dashboardAggregator.gstSnapshotForDateRange(params.fromYmd, params.toYmd);
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

/** Calendar today overview for dashboard KPI cards. */
export const fetchTodayOverview = createAsyncThunk(
  'dashboard/fetchTodayOverview',
  async (_void: void, { rejectWithValue }) => {
    try {
      return await dashboardAggregator.summary('today');
    } catch (error: any) {
      return rejectWithValue(error?.message ?? 'Failed to fetch overview');
    }
  }
);

/** Current calendar month overview for dashboard metric cards. */
export const fetchMonthOverview = createAsyncThunk(
  'dashboard/fetchMonthOverview',
  async (_, { rejectWithValue }) => {
    try {
      return await dashboardAggregator.summary('month');
    } catch (error: any) {
      return rejectWithValue(error?.message ?? 'Failed to fetch month overview');
    }
  }
);

// --- Slice Definition ---

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setPeriod: (state, action: PayloadAction<SummaryPeriod>) => {
      state.period = action.payload;
    },
    setGstPeriod: (state, action: PayloadAction<SummaryPeriod>) => {
      state.gstPeriod = action.payload;
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
      .addCase(fetchGstSnapshotForDateRange.fulfilled, (state, action) => {
        state.gstSnapshot = action.payload;
      })

      // Low Stock
      .addCase(fetchLowStock.fulfilled, (state, action) => {
        state.lowStock = action.payload;
      })

      // Today overview (separate loading flag)
      .addCase(fetchTodayOverview.pending, (state) => {
        state.todayOverviewLoading = true;
      })
      .addCase(fetchTodayOverview.fulfilled, (state, action) => {
        state.todayOverviewLoading = false;
        state.todaySummary = action.payload;
      })
      .addCase(fetchTodayOverview.rejected, (state, action) => {
        state.todayOverviewLoading = false;
        state.error = (action.payload as string) ?? state.error;
      })

      // Month overview (separate loading flag)
      .addCase(fetchMonthOverview.pending, (state) => {
        state.monthOverviewLoading = true;
      })
      .addCase(fetchMonthOverview.fulfilled, (state, action) => {
        state.monthOverviewLoading = false;
        state.monthSummary = action.payload;
      })
      .addCase(fetchMonthOverview.rejected, (state, action) => {
        state.monthOverviewLoading = false;
        state.error = (action.payload as string) ?? state.error;
      });
  },
});

export const { setPeriod, setGstPeriod, clearError } = dashboardSlice.actions;
export default dashboardSlice.reducer;
