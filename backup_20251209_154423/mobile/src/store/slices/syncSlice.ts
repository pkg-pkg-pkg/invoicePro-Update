import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SyncState {
  lastSyncAt: Date | null;
  isSyncing: boolean;
  pendingChanges: number;
  error: string | null;
}

const initialState: SyncState = {
  lastSyncAt: null,
  isSyncing: false,
  pendingChanges: 0,
  error: null,
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
      state.lastSyncAt = new Date();
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

