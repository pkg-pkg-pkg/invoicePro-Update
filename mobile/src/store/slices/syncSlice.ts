import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SyncState {
  lastSyncAt: string | null;
  isSyncing: boolean;
  pendingChanges: number;
  error: string | null;
  endpointBase: string;
  lastError: string | null;
  snapshot?: {
    todaySales?: number;
    todayReceipts?: number;
    outstanding?: number;
    stockValue?: number;
    companyName?: string;
    recentInvoices?: Array<{ id: string; number: string; customer: string; amount: number; date: string }>;
    topCustomers?: Array<{ name: string; amount: number }>;
    publishedAt?: string;
  } | null;
}

const initialState: SyncState = {
  lastSyncAt: null,
  isSyncing: false,
  pendingChanges: 0,
  error: null,
  endpointBase: 'http://localhost:3399/mobile-sync',
  lastError: null,
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    setSyncStatus: (state, action: PayloadAction<Partial<SyncState>>) => {
      Object.assign(state, action.payload);
    },
    startSync: (state) => {
      state.isSyncing = true;
      state.error = null;
    },
    syncSuccess: (state) => {
      state.isSyncing = false;
      state.lastSyncAt = new Date().toISOString();
      state.pendingChanges = 0;
    },
    syncError: (state, action: PayloadAction<string>) => {
      state.isSyncing = false;
      state.error = action.payload;
    },
  },
});

export const { setSyncStatus, startSync, syncSuccess, syncError } = syncSlice.actions;
export default syncSlice.reducer;

