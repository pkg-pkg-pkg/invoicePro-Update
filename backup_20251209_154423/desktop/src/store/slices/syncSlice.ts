import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isSyncing: false,
  lastSynced: null,
  pendingChanges: 0,
  error: null,
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    startSync: (state) => {
      state.isSyncing = true;
      state.error = null;
    },
    syncSuccess: (state) => {
      state.isSyncing = false;
      state.lastSynced = new Date().toISOString();
      state.pendingChanges = 0;
    },
    syncFailure: (state, action) => {
      state.isSyncing = false;
      state.error = action.payload;
    },
    incrementPendingChanges: (state) => {
      state.pendingChanges += 1;
    },
  },
});

export const { startSync, syncSuccess, syncFailure, incrementPendingChanges } = syncSlice.actions;
export default syncSlice.reducer;
